import { Request, Response } from "express";
import { Types } from "mongoose";
import { RequestReturnInput } from "@yourstore/shared";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { restoreStock, releaseCoupon } from "../services/order.js";
import { getStripeClient } from "../lib/stripe.js";
import { sendOrderStatusEmail } from "../lib/email.js";
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

  void sendOrderStatusEmail(cancelledOrder, "cancelled").catch(() => {});

  res.status(200).json({ message: "Order cancelled successfully" });
}

/**
 * POST /api/v1/orders/:id/return
 * Request a return on a Delivered order within 7 days.
 * Atomic conditional update on (_id, user, status = 'Delivered', returnRequest exists: false).
 */
export async function requestOrderReturn(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new NotFoundError("Order not found");
  }

  const { reason } = req.body as RequestReturnInput;

  // 1. Strict IDOR verification: Check if order exists for this user
  const existingOrder = await Order.findOne({
    _id: id,
    user: new Types.ObjectId(userId),
  });

  if (!existingOrder) {
    throw new NotFoundError("Order not found");
  }

  if (existingOrder.status !== "Delivered") {
    throw new BadRequestError(`Cannot request return for order with status "${existingOrder.status}". Order must be Delivered.`);
  }

  if (existingOrder.returnRequest) {
    throw new BadRequestError("A return request has already been submitted for this order");
  }

  // 2. Check 7-day return window from Delivered date in statusHistory
  const deliveredHistory = [...existingOrder.statusHistory]
    .reverse()
    .find((h) => h.status === "Delivered");

  const deliveredAt = deliveredHistory ? new Date(deliveredHistory.at).getTime() : new Date(existingOrder.updatedAt).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - deliveredAt > sevenDaysMs) {
    throw new BadRequestError("Return window has expired. Returns are only allowed within 7 days of delivery.");
  }

  const now = new Date();

  // 3. Atomic conditional update
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: id,
      user: new Types.ObjectId(userId),
      status: "Delivered",
      returnRequest: { $exists: false },
    },
    {
      $set: {
        status: "ReturnRequested",
        returnRequest: {
          reason,
          requestedAt: now,
        },
      },
      $push: {
        statusHistory: {
          status: "ReturnRequested",
          at: now,
          by: userId,
          note: `Return requested: ${reason}`,
        },
      },
    },
    { new: true },
  );

  if (!updatedOrder) {
    throw new BadRequestError("Return request could not be submitted or order was modified concurrently");
  }

  res.status(200).json({
    message: "Return request submitted successfully",
    order: updatedOrder,
  });
}

/**
 * GET /api/v1/orders/:id/invoice
 * Stream an invoice PDF generated on the fly using pdfkit.
 * Authenticated: order owner or admin. 404 for others.
 * Allowed only for orders that are Placed or later (not PendingPayment or Cancelled).
 */
export async function getOrderInvoice(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new NotFoundError("Order not found");
  }

  const order = await Order.findById(id).lean();
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const isOwner = order.user.toString() === userId;
  const isAdmin = userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new NotFoundError("Order not found");
  }

  // Not allowed for PendingPayment or Cancelled
  if (order.status === "PendingPayment" || order.status === "Cancelled") {
    throw new BadRequestError(`Invoices are not available for orders in "${order.status}" status`);
  }

  // Generate and stream PDF with PDFKit
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="invoice-${order._id.toString()}.pdf"`,
  );

  doc.pipe(res);

  // Invoice Header
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("YourStore", { align: "left" })
    .fontSize(10)
    .font("Helvetica")
    .text("TAX INVOICE / RECEIPT", { align: "right" })
    .moveDown();

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Invoice / Order ID: #${order._id.toString()}`)
    .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`)
    .text(`Order Status: ${order.status}`)
    .text(`Payment: ${order.payment.method.toUpperCase()} (${order.payment.status})`)
    .moveDown();

  // Shipping Address
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Billed & Delivered To:")
    .fontSize(10)
    .font("Helvetica")
    .text(order.shippingAddress.name)
    .text(order.shippingAddress.line1)
    .text(order.shippingAddress.line2 || "")
    .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`)
    .text(`Phone: ${order.shippingAddress.phone}`)
    .moveDown();

  // Line Items Table Header
  const tableTop = doc.y;
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Item", 50, tableTop)
    .text("Qty", 320, tableTop, { width: 50, align: "center" })
    .text("Unit Price (INR)", 380, tableTop, { width: 90, align: "right" })
    .text("Total (INR)", 480, tableTop, { width: 80, align: "right" });

  doc.moveTo(50, tableTop + 15).lineTo(560, tableTop + 15).stroke();

  let position = tableTop + 25;
  doc.font("Helvetica");

  for (const item of order.items) {
    const itemDesc = item.variantSku ? `${item.title} (${item.variantSku})` : item.title;
    const lineTotal = item.unitPrice * item.qty;

    doc
      .fontSize(9)
      .text(itemDesc, 50, position, { width: 260 })
      .text(item.qty.toString(), 320, position, { width: 50, align: "center" })
      .text(`Rs. ${item.unitPrice.toLocaleString("en-IN")}`, 380, position, { width: 90, align: "right" })
      .text(`Rs. ${lineTotal.toLocaleString("en-IN")}`, 480, position, { width: 80, align: "right" });

    position += 20;
  }

  doc.moveTo(50, position).lineTo(560, position).stroke();
  position += 10;

  // Pricing Breakdown
  doc
    .fontSize(10)
    .text(`Subtotal: Rs. ${order.pricing.subtotal.toLocaleString("en-IN")}`, 380, position, { width: 180, align: "right" });
  position += 15;

  if (order.pricing.shipping > 0) {
    doc.text(`Shipping: Rs. ${order.pricing.shipping.toLocaleString("en-IN")}`, 380, position, { width: 180, align: "right" });
    position += 15;
  }

  if (order.pricing.tax > 0) {
    doc.text(`Tax: Rs. ${order.pricing.tax.toLocaleString("en-IN")}`, 380, position, { width: 180, align: "right" });
    position += 15;
  }

  if (order.pricing.discount > 0) {
    doc.text(`Discount: -Rs. ${order.pricing.discount.toLocaleString("en-IN")}`, 380, position, { width: 180, align: "right" });
    position += 15;
  }

  doc
    .font("Helvetica-Bold")
    .text(`Total: Rs. ${order.pricing.total.toLocaleString("en-IN")}`, 380, position, { width: 180, align: "right" });

  // Footer Note
  doc
    .fontSize(9)
    .font("Helvetica")
    .text("Thank you for shopping with YourStore!", 50, position + 50, { align: "center" });

  doc.end();
}
