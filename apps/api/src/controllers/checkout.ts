import { Request, Response } from "express";
import { Types } from "mongoose";
import Stripe from "stripe";
import { CheckoutStripeInput, CheckoutCodInput } from "@yourstore/shared";
import { env } from "../env.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { getStripeClient } from "../lib/stripe.js";
import {
  createOrderFromCart,
  restoreStock,
  releaseCoupon,
} from "../services/order.js";
import { sendOrderStatusEmail } from "../lib/email.js";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  UnauthorizedError,
} from "../lib/errors.js";
import { logger } from "../lib/logger.js";
 
// Stripe minimum charge in INR is ~₹50 (5000 paise)
const MIN_STRIPE_AMOUNT_INR = 50;

/**
 * POST /api/v1/checkout/cod
 * Authenticated, CSRF-protected endpoint for Cash on Delivery checkout.
 */
export async function createCodCheckout(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { addressId, couponCode } = req.body as CheckoutCodInput;

  const order = await createOrderFromCart(userId, addressId, couponCode, "cod");

  // Send order placed confirmation email asynchronously without blocking or failing checkout
  void sendOrderStatusEmail(order, "placed").catch(() => {});

  res.status(201).json({
    orderId: order._id.toString(),
  });
}

/**
 * POST /api/v1/checkout/stripe
 * Authenticated, CSRF-protected endpoint to initiate a Stripe Checkout Session.
 */
export async function createStripeCheckout(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { addressId, couponCode } = req.body as CheckoutStripeInput;

  // 1. Check for existing PendingPayment order created in the last 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const existingPendingOrder = await Order.findOne({
    user: userId,
    status: "PendingPayment",
    createdAt: { $gte: thirtyMinutesAgo },
  });

  if (existingPendingOrder) {
    throw new ConflictError(
      "You already have a pending checkout order in progress. Please complete your existing checkout or wait 30 minutes for it to expire.",
    );
  }

  // 2. Create the order using method = "stripe"
  // createOrderFromCart creates order in "PendingPayment" status, decrements stock atomically,
  // increments coupon atomically, and restores user's cart for Stripe orders.
  const order = await createOrderFromCart(userId, addressId, couponCode, "stripe");

  // Validate Stripe minimum charge amount
  if (order.pricing.total < MIN_STRIPE_AMOUNT_INR) {
    const cancelledOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: "PendingPayment" },
      {
        $set: { status: "Cancelled" },
        $push: {
          statusHistory: {
            status: "Cancelled",
            at: new Date(),
            by: userId,
            note: `Total below Stripe minimum ₹${MIN_STRIPE_AMOUNT_INR}`,
          },
        },
      },
      { new: false },
    );

    if (cancelledOrder) {
      const rollbackResults = await Promise.allSettled([
        restoreStock(cancelledOrder),
        releaseCoupon(cancelledOrder),
      ]);
      for (const res of rollbackResults) {
        if (res.status === "rejected") {
          logger.error({ err: res.reason }, "Failed to roll back resources after below-minimum check");
        }
      }
    }

    throw new BadRequestError(
      `Order total ₹${order.pricing.total} is below the minimum Stripe checkout amount of ₹${MIN_STRIPE_AMOUNT_INR}.`,
    );
  }

  const stripe = getStripeClient();

  try {
    // 3. Build line items for Stripe Checkout
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const item of order.items) {
      const product_data: Stripe.Checkout.SessionCreateParams.LineItem.PriceData.ProductData = {
        name: item.title,
      };
      if (item.image && item.image.startsWith("https://")) {
        product_data.images = [item.image];
      }

      const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
        price_data: {
          currency: "inr",
          product_data,
          unit_amount: Math.round(item.unitPrice * 100), // in paise
        },
        quantity: item.qty,
      };
      line_items.push(lineItem);
    }

    if (order.pricing.shipping > 0) {
      line_items.push({
        price_data: {
          currency: "inr",
          product_data: {
            name: "Shipping",
          },
          unit_amount: Math.round(order.pricing.shipping * 100),
        },
        quantity: 1,
      });
    }

    if (order.pricing.tax > 0) {
      line_items.push({
        price_data: {
          currency: "inr",
          product_data: {
            name: `Tax (${env.TAX_PERCENT}%)`,
          },
          unit_amount: Math.round(order.pricing.tax * 100),
        },
        quantity: 1,
      });
    }

    // Discounts
    let discountPaise = 0;
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (order.pricing.discount > 0) {
      discountPaise = Math.round(order.pricing.discount * 100);
      const couponObj = await stripe.coupons.create({
        amount_off: discountPaise,
        currency: "inr",
        duration: "once",
        name: order.couponCode ? `Discount (${order.couponCode})` : "Order Discount",
      });
      discounts.push({ coupon: couponObj.id });
    }

    // Compute sum of line_items minus discount
    let lineItemsSumPaise = 0;
    for (const line of line_items) {
      const unitAmt = line.price_data?.unit_amount ?? 0;
      const qty = line.quantity ?? 1;
      lineItemsSumPaise += unitAmt * qty;
    }
    const computedStripeTotalPaise = lineItemsSumPaise - discountPaise;
    const expectedOrderTotalPaise = Math.round(order.pricing.total * 100);

    if (computedStripeTotalPaise !== expectedOrderTotalPaise) {
      throw new BadRequestError(
        `Stripe checkout line items total (₹${computedStripeTotalPaise / 100}) does not match order pricing total (₹${order.pricing.total})`,
      );
    }

    const expiresAtUnix = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes from now

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items,
      expires_at: expiresAtUnix,
      metadata: {
        orderId: order._id.toString(),
        userId,
      },
      client_reference_id: order._id.toString(),
      success_url: `${env.CLIENT_ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CLIENT_ORIGIN}/checkout/cancel?order_id=${order._id.toString()}`,
    };

    if (discounts.length > 0) {
      sessionParams.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Save stripeSessionId on the order
    await Order.updateOne(
      { _id: order._id },
      { $set: { "payment.stripeSessionId": session.id } },
    );

    res.status(200).json({
      orderId: order._id.toString(),
      sessionId: session.id,
      url: session.url,
    });
  } catch (stripeErr) {
    logger.error({ err: stripeErr }, "Stripe checkout session creation failed");

    // Compensate on Stripe failure:
    const cancelledOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: "PendingPayment" },
      {
        $set: { status: "Cancelled" },
        $push: {
          statusHistory: {
            status: "Cancelled",
            at: new Date(),
            by: userId,
            note: "Stripe checkout creation failure",
          },
        },
      },
      { new: false },
    );

    if (cancelledOrder) {
      const rollbackPromises: Promise<unknown>[] = [
        restoreStock(cancelledOrder),
        releaseCoupon(cancelledOrder),
      ];

      // If user's cart was cleared, restore it from the order items
      const userDoc = await User.findById(userId);
      if (userDoc && (!userDoc.cart || userDoc.cart.length === 0)) {
        const cartItemsToRestore = cancelledOrder.items.map((i) => {
          const itemObj: { productId: Types.ObjectId; variantSku?: string; qty: number } = {
            productId: i.productId,
            qty: i.qty,
          };
          if (i.variantSku) {
            itemObj.variantSku = i.variantSku;
          }
          return itemObj;
        });
        rollbackPromises.push(
          User.updateOne({ _id: userId }, { $set: { cart: cartItemsToRestore } }),
        );
      }

      const results = await Promise.allSettled(rollbackPromises);
      for (const res of results) {
        if (res.status === "rejected") {
          logger.error({ err: res.reason }, "Failed to roll back resources during Stripe checkout failure compensation");
        }
      }
    }

    if (stripeErr instanceof BadRequestError) {
      throw stripeErr;
    }

    throw new InternalServerError("Failed to initialize Stripe checkout session");
  }
}

/**
 * POST /api/v1/webhooks/stripe
 * Public webhook endpoint for Stripe events. Mounted with express.raw().
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET is not configured");
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    const rawBody = req.body as Buffer;
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  // Idempotency: Insert eventId first
  try {
    await WebhookEvent.create({
      eventId: event.id,
      type: event.type,
      processedAt: new Date(),
    });
  } catch (dbErr: unknown) {
    // If duplicate key error (code 11000), event already handled
    const err = dbErr as { code?: number };
    if (err.code === 11000) {
      logger.info({ eventId: event.id }, "Stripe event already processed (idempotent skip)");
      res.status(200).json({ received: true });
      return;
    }
    logger.error({ err: dbErr }, "Failed to record webhook event in database");
    res.status(500).json({ error: "Database error" });
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.["orderId"] || session.client_reference_id;

      if (orderId) {
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        // Atomic conditional update on status = "PendingPayment"
        const updatePayload: Record<string, unknown> = {
          status: "Placed",
          "payment.status": "paid",
        };
        if (paymentIntentId) {
          updatePayload["payment.paymentIntentId"] = paymentIntentId;
        }

        const updatedOrder = await Order.findOneAndUpdate(
          { _id: orderId, status: "PendingPayment" },
          {
            $set: updatePayload,
            $push: {
              statusHistory: {
                status: "Placed",
                at: new Date(),
                by: "stripe_webhook",
                note: `Payment completed via Stripe. Session ${session.id}`,
              },
            },
          },
          { new: true },
        );

        if (updatedOrder) {
          // Clear user's cart now that order is paid and placed
          await User.updateOne({ _id: updatedOrder.user }, { $set: { cart: [] } });
          logger.info({ orderId, eventId: event.id }, "Order placed and user cart cleared");
          void sendOrderStatusEmail(updatedOrder, "placed").catch(() => {});
        } else {
          logger.error(
            {
              orderId,
              eventId: event.id,
              sessionId: session.id,
              paymentIntentId,
            },
            "PAID session for an order that is not PendingPayment: manual refund needed",
          );
        }
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const orderId = session.metadata?.["orderId"] || session.client_reference_id;

      if (orderId) {
        // Atomic conditional update: Cancel ONLY if still PendingPayment
        const cancelledOrder = await Order.findOneAndUpdate(
          { _id: orderId, status: "PendingPayment" },
          {
            $set: { status: "Cancelled", "payment.status": "failed" },
            $push: {
              statusHistory: {
                status: "Cancelled",
                at: new Date(),
                by: "stripe_webhook",
                note: `Stripe checkout session expired: ${session.id}`,
              },
            },
          },
          { new: false },
        );

        // restoreStock and releaseCoupon ONLY if the document was actually updated
        if (cancelledOrder) {
          await restoreStock(cancelledOrder);
          await releaseCoupon(cancelledOrder);
          logger.info({ orderId, eventId: event.id }, "Expired order cancelled; stock and coupon restored");
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (processErr) {
    logger.error({ err: processErr, eventId: event.id }, "Error processing Stripe webhook event");
    // Delete event record on processing failure so Stripe's retry can reprocess
    await WebhookEvent.deleteOne({ eventId: event.id }).catch(() => {});
    res.status(500).json({ error: "Internal error processing event" });
  }
}
