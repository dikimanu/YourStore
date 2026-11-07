import { Request, Response } from "express";
import { Types } from "mongoose";
import { OrderStatus, ORDER_STATUSES } from "@yourstore/shared";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { createAuditLog } from "../lib/auditLog.js";
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
