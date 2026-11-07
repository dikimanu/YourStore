import { Request, Response } from "express";
import { Types } from "mongoose";
import { OrderStatus, ORDER_STATUSES, AdminReturnDecision } from "@yourstore/shared";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { createAuditLog } from "../lib/auditLog.js";
import { restoreStock } from "../services/order.js";
import { getStripeClient } from "../lib/stripe.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../lib/errors.js";

const VALID_FORWARD_TRANSITIONS: Record<string, OrderStatus> = {
  Placed: "Processing",
  Processing: "Dispatched",
  Dispatched: "OutForDelivery",
  OutForDelivery: "Delivered",
};

/**
 * GET /api/v1/admin/orders
 * List orders with optional filters (orderId, email, status, pagination).
 */
export async function adminGetOrders(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(typeof req.query["page"] === "string" ? req.query["page"] : "1", 10) || 1);
  const rawLimit = parseInt(typeof req.query["limit"] === "string" ? req.query["limit"] : "20", 10) || 20;
  const limit = Math.max(1, Math.min(100, rawLimit));

  const filter: Record<string, unknown> = {};

  // Filter by orderId
  const orderId = typeof req.query["orderId"] === "string" ? req.query["orderId"].trim() : undefined;
  if (orderId) {
    if (!Types.ObjectId.isValid(orderId)) {
      res.status(200).json({ orders: [], total: 0, page, totalPages: 0 });
      return;
    }
    filter["_id"] = new Types.ObjectId(orderId);
  }

  // Filter by user email
  const email = typeof req.query["email"] === "string" ? req.query["email"].trim().toLowerCase() : undefined;
  if (email) {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(200).json({ orders: [], total: 0, page, totalPages: 0 });
      return;
    }
    filter["user"] = user._id;
  }

  // Filter by status
  const status = typeof req.query["status"] === "string" ? req.query["status"].trim() : undefined;
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
    filter["status"] = status;
  }

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
 * PATCH /api/v1/admin/orders/:id/status
 * Transition an order status sequentially:
 * Placed -> Processing -> Dispatched -> OutForDelivery -> Delivered
 */
export async function adminUpdateOrderStatus(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.id;
  if (!adminId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new NotFoundError("Order not found");
  }

  const { status: targetStatus } = req.body as { status?: OrderStatus };
  if (!targetStatus) {
    throw new BadRequestError("Target status is required");
  }

  const order = await Order.findById(id);
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const expectedNext = VALID_FORWARD_TRANSITIONS[order.status];
  if (!expectedNext || expectedNext !== targetStatus) {
    throw new BadRequestError(
      `Invalid status transition from "${order.status}" to "${targetStatus}". Next allowed status: ${expectedNext ?? "none"}`,
    );
  }

  const updatePayload: Record<string, unknown> = {
    status: targetStatus,
  };

  // If COD order reaches Delivered, mark payment as paid
  if (targetStatus === "Delivered" && order.payment.method === "cod") {
    updatePayload["payment.status"] = "paid";
  }

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: id, status: order.status },
    {
      $set: updatePayload,
      $push: {
        statusHistory: {
          status: targetStatus,
          at: new Date(),
          by: adminId,
          note: `Status updated to ${targetStatus} by admin`,
        },
      },
    },
    { new: true },
  );

  if (!updatedOrder) {
    throw new ConflictError("Order was modified concurrently. Please refresh and try again.");
  }

  // Create audit log entry for admin status change
  await createAuditLog({
    actor: adminId,
    action: "order.status_update",
    targetType: "Order",
    targetId: id,
    meta: {
      from: order.status,
      to: targetStatus,
      paymentStatusUpdated: targetStatus === "Delivered" && order.payment.method === "cod",
    },
  });

  res.status(200).json({ order: updatedOrder });
}

/**
 * GET /api/v1/admin/returns
 * Admin only, paginated, lean. Lists orders with status ReturnRequested, Returned, or Refunded.
 */
export async function adminGetReturns(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(typeof req.query["page"] === "string" ? req.query["page"] : "1", 10) || 1);
  const rawLimit = parseInt(typeof req.query["limit"] === "string" ? req.query["limit"] : "20", 10) || 20;
  const limit = Math.max(1, Math.min(100, rawLimit));

  const filter = {
    status: { $in: ["ReturnRequested", "Returned", "Refunded"] },
  };

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ "returnRequest.requestedAt": -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name email")
      .lean(),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    orders,
    total,
    page,
    totalPages,
    limit,
  });
}

/**
 * PATCH /api/v1/admin/orders/:id/return
 * Admin decision on a ReturnRequested order.
 * - reject: sets status back to Delivered, records decision and note, appends statusHistory.
 * - approve: sets status to Returned, restores stock, records decision and note, appends statusHistory.
 * Writes AuditLog.
 */
export async function adminDecideReturn(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.id;
  if (!adminId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new NotFoundError("Order not found");
  }

  const { decision, note } = req.body as AdminReturnDecision;

  const order = await Order.findById(id);
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (order.status !== "ReturnRequested") {
    throw new BadRequestError(`Cannot decide return on order with status "${order.status}". Status must be ReturnRequested.`);
  }

  const now = new Date();

  if (decision === "reject") {
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, status: "ReturnRequested" },
      {
        $set: {
          status: "Delivered",
          "returnRequest.decision": "reject",
          "returnRequest.decidedAt": now,
          "returnRequest.decidedBy": adminId,
          ...(note ? { "returnRequest.note": note } : {}),
        },
        $push: {
          statusHistory: {
            status: "Delivered",
            at: now,
            by: adminId,
            note: note ? `Return rejected: ${note}` : "Return rejected by admin",
          },
        },
      },
      { new: true },
    );

    if (!updatedOrder) {
      throw new ConflictError("Order was modified concurrently. Please refresh and try again.");
    }

    await createAuditLog({
      actor: adminId,
      action: "order.return_reject",
      targetType: "Order",
      targetId: id,
      meta: { decision: "reject", note },
    });

    res.status(200).json({ order: updatedOrder });
    return;
  }

  // decision === "approve"
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: id, status: "ReturnRequested" },
    {
      $set: {
        status: "Returned",
        "returnRequest.decision": "approve",
        "returnRequest.decidedAt": now,
        "returnRequest.decidedBy": adminId,
        ...(note ? { "returnRequest.note": note } : {}),
      },
      $push: {
        statusHistory: {
          status: "Returned",
          at: now,
          by: adminId,
          note: note ? `Return approved: ${note}` : "Return approved by admin",
        },
      },
    },
    { new: true },
  );

  if (!updatedOrder) {
    throw new ConflictError("Order was modified concurrently. Please refresh and try again.");
  }

  // Restore product stock using existing restoreStock function
  await restoreStock(order);

  await createAuditLog({
    actor: adminId,
    action: "order.return_approve",
    targetType: "Order",
    targetId: id,
    meta: { decision: "approve", note },
  });

  res.status(200).json({ order: updatedOrder });
}

/**
 * PATCH /api/v1/admin/orders/:id/refund
 * Admin processes refund for an order in Returned status.
 * - Stripe: creates a Stripe refund for paymentIntentId with idempotencyKey "refund-" + order._id.
 * - COD: just record the refund.
 * Atomic conditional update on status = 'Returned' ensures impossible to refund twice.
 * Writes AuditLog.
 */
export async function adminRefundOrder(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.id;
  if (!adminId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new NotFoundError("Order not found");
  }

  const order = await Order.findById(id);
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (order.status !== "Returned") {
    throw new BadRequestError(`Cannot refund order with status "${order.status}". Status must be Returned.`);
  }

  // If Stripe order, process Stripe refund first with idempotency key
  if (order.payment.method === "stripe") {
    const paymentIntentId = order.payment.paymentIntentId;
    if (!paymentIntentId) {
      throw new BadRequestError("Missing paymentIntentId on Stripe order to process refund");
    }

    const stripe = getStripeClient();
    await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `refund-${order._id.toString()}` },
    );
  }

  const now = new Date();

  // Atomic conditional update on status = "Returned" (impossible to refund twice concurrently)
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: id, status: "Returned" },
    {
      $set: {
        status: "Refunded",
        "payment.status": "refunded",
      },
      $push: {
        statusHistory: {
          status: "Refunded",
          at: now,
          by: adminId,
          note: `Refund issued by admin (${order.payment.method})`,
        },
      },
    },
    { new: true },
  );

  if (!updatedOrder) {
    throw new ConflictError("Order was already refunded or modified concurrently");
  }

  await createAuditLog({
    actor: adminId,
    action: "order.refund",
    targetType: "Order",
    targetId: id,
    meta: {
      method: order.payment.method,
      amount: order.pricing.total,
    },
  });

  res.status(200).json({
    message: "Refund processed successfully",
    order: updatedOrder,
  });
}
