import { Request, Response } from "express";
import { Types } from "mongoose";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { restoreStock, releaseCoupon } from "../services/order.js";
import { getStripeClient } from "../lib/stripe.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/**
 * GET /api/v1/orders
 * List authenticated user's orders (lean, newest first, paginated).
 */
export async function getMyOrders(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const page = Math.max(1, parseInt(typeof req.query["page"] === "string" ? req.query["page"] : "1", 10) || 1);
  const rawLimit = parseInt(typeof req.query["limit"] === "string" ? req.query["limit"] : "10", 10) || 10;
  const limit = Math.max(1, Math.min(50, rawLimit));

  const filter = { user: new Types.ObjectId(userId) };

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    orders,
    total,
    page,
    totalPages,
  });
}

/**
 * GET /api/v1/orders/:id
 * Retrieve a single order by ID (with strict ownership check for IDOR prevention).
 */
export async function getOrderById(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new NotFoundError("Order not found");
  }

  const order = await Order.findById(id).lean();
  if (!order || order.user.toString() !== userId) {
    throw new NotFoundError("Order not found");
  }

  res.status(200).json({ order });
}

/**
 * POST /api/v1/orders/:id/cancel
 * Cancel an order (owner only, allowed in PendingPayment, Placed, Processing only).
 */
export async function cancelOrder(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new NotFoundError("Order not found");
  }

  // 1. Ownership check & check status
  const existingOrder = await Order.findById(id);
  if (!existingOrder || existingOrder.user.toString() !== userId) {
    throw new NotFoundError("Order not found");
  }

  const cancellableStatuses = ["PendingPayment", "Placed", "Processing"];
  if (!cancellableStatuses.includes(existingOrder.status)) {
    throw new BadRequestError(`Cannot cancel order in "${existingOrder.status}" status`);
  }

  // 2. Atomic conditional status update to Cancelled
  const cancelledOrder = await Order.findOneAndUpdate(
    {
      _id: id,
      user: new Types.ObjectId(userId),
      status: { $in: cancellableStatuses },
    },
    {
      $set: { status: "Cancelled" },
      $push: {
        statusHistory: {
          status: "Cancelled",
          at: new Date(),
          by: userId,
          note: "Cancelled by user",
        },
      },
    },
    { new: false },
  );

  if (!cancelledOrder) {
    throw new BadRequestError("Order could not be cancelled or was already cancelled");
  }

  // 3. Compensation: restore stock and release coupon
  const rollbackPromises: Promise<unknown>[] = [
    restoreStock(cancelledOrder),
    releaseCoupon(cancelledOrder),
  ];

  const wasPendingPayment = cancelledOrder.status === "PendingPayment";
  const isStripe = cancelledOrder.payment?.method === "stripe";

  // For a PendingPayment stripe order, expire stripe session and restore user cart
  if (wasPendingPayment && isStripe) {
    const sessionId = cancelledOrder.payment.stripeSessionId;
    if (sessionId) {
      try {
        const stripe = getStripeClient();
        await stripe.checkout.sessions.expire(sessionId);
      } catch (stripeErr) {
        logger.warn({ err: stripeErr }, "Stripe session expire failed or session already expired");
      }
    }

    if (cancelledOrder.items && cancelledOrder.items.length > 0) {
      const cartItemsToRestore = cancelledOrder.items.map((i) => {
        const itemObj: { productId: Types.ObjectId; variantSku?: string | undefined; qty: number } = {
          productId: i.productId,
          qty: i.qty,
        };
        if (i.variantSku !== undefined) {
          itemObj.variantSku = i.variantSku;
        }
        return itemObj;
      });
      rollbackPromises.push(
        User.updateOne({ _id: userId }, { $set: { cart: cartItemsToRestore } }),
      );
    }
  }

  const results = await Promise.allSettled(rollbackPromises);
  for (const resItem of results) {
    if (resItem.status === "rejected") {
      logger.error({ err: resItem.reason }, "Failed to roll back resources on order cancellation");
    }
  }

  res.status(200).json({ message: "Order cancelled successfully" });
}
