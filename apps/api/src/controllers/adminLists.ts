import { Request, Response } from "express";
import { FilterQuery, Types } from "mongoose";
import {
  AdminCustomersResponse,
  AdminAuditLogsResponse,
  OrderStatus,
} from "@yourstore/shared";
import { User, IUser } from "../models/User.js";
import { Order } from "../models/Order.js";
import { AuditLog } from "../models/AuditLog.js";
import { escapeRegex } from "../lib/regex.js";

const QUALIFYING_STATUSES: OrderStatus[] = [
  "Placed",
  "Processing",
  "Dispatched",
  "OutForDelivery",
  "Delivered",
];

/**
 * GET /api/v1/admin/customers
 * Query: search (name or email, escaped regex), page, limit (max 100).
 * Return id, name, email, role, emailVerified, createdAt, plus orderCount and totalSpent
 * computed with one aggregation over qualifying orders, not N+1 queries.
 * Never expose passwordHash, refreshTokenHash, tokens or lock fields.
 */
export async function adminGetCustomers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(typeof req.query["page"] === "string" ? req.query["page"] : "1", 10) || 1);
  const rawLimit = parseInt(typeof req.query["limit"] === "string" ? req.query["limit"] : "20", 10) || 20;
  const limit = Math.max(1, Math.min(100, rawLimit));

  const filter: FilterQuery<IUser> = {};

  const search = typeof req.query["search"] === "string" ? req.query["search"].trim() : undefined;
  if (search) {
    const escaped = escapeRegex(search);
    const searchRegex = new RegExp(escaped, "i");
    filter.$or = [
      { name: { $regex: searchRegex } },
      { email: { $regex: searchRegex } },
    ];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select("_id name email role emailVerified createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<{ _id: Types.ObjectId; name: string; email: string; role: IUser["role"]; emailVerified: boolean; createdAt: Date }[]>(),
  ]);

  const totalPages = Math.ceil(total / limit);

  if (users.length === 0) {
    const emptyResponse: AdminCustomersResponse = {
      customers: [],
      total,
      page,
      totalPages,
    };
    res.status(200).json(emptyResponse);
    return;
  }

  const userIds = users.map((u) => u._id);

  // One aggregation over qualifying orders for all fetched users to get orderCount and totalSpent
  const metricsAgg = await Order.aggregate<{
    _id: Types.ObjectId;
    orderCount: number;
    totalSpent: number;
  }>([
    {
      $match: {
        user: { $in: userIds },
        status: { $in: QUALIFYING_STATUSES },
      },
    },
    {
      $group: {
        _id: "$user",
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$pricing.total" },
      },
    },
  ]);

  const metricsMap = new Map<string, { orderCount: number; totalSpent: number }>();
  for (const m of metricsAgg) {
    metricsMap.set(m._id.toString(), {
      orderCount: m.orderCount,
      totalSpent: Math.round(m.totalSpent * 100) / 100,
    });
  }

  const customers = users.map((u) => {
    const m = metricsMap.get(u._id.toString());
    return {
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      emailVerified: Boolean(u.emailVerified),
      createdAt: u.createdAt,
      orderCount: m ? m.orderCount : 0,
      totalSpent: m ? m.totalSpent : 0,
    };
  });

  const response: AdminCustomersResponse = {
    customers,
    total,
    page,
    totalPages,
  };

  res.status(200).json(response);
}

/**
 * GET /api/v1/admin/audit-logs
 * Query: action, targetType, page, limit.
 * Populate actor name only. Newest first.
 */
export async function adminGetAuditLogs(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(typeof req.query["page"] === "string" ? req.query["page"] : "1", 10) || 1);
  const rawLimit = parseInt(typeof req.query["limit"] === "string" ? req.query["limit"] : "20", 10) || 20;
  const limit = Math.max(1, Math.min(100, rawLimit));

  const filter: Record<string, unknown> = {};

  const action = typeof req.query["action"] === "string" ? req.query["action"].trim() : undefined;
  if (action) {
    const escaped = escapeRegex(action);
    filter["action"] = new RegExp(`^${escaped}$`, "i");
  }

  const targetType = typeof req.query["targetType"] === "string" ? req.query["targetType"].trim() : undefined;
  if (targetType) {
    const escaped = escapeRegex(targetType);
    filter["targetType"] = new RegExp(`^${escaped}$`, "i");
  }

  const [total, rawLogs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("actor", "name")
      .lean<{
        _id: Types.ObjectId;
        actor: { _id?: Types.ObjectId; name?: string } | string;
        action: string;
        targetType: string;
        targetId?: string | null;
        meta?: Record<string, unknown> | null;
        at: Date;
      }[]>(),
  ]);

  const totalPages = Math.ceil(total / limit);

  const logs = rawLogs.map((log) => {
    let formattedActor: { id?: string; name?: string } | string;
    if (log.actor && typeof log.actor === "object") {
      const a = log.actor;
      const actorObj: { id?: string; name?: string } = {};
      if (a._id) actorObj.id = a._id.toString();
      if (a.name) actorObj.name = a.name;
      formattedActor = actorObj;
    } else {
      formattedActor = String(log.actor || "System");
    }

    return {
      id: log._id.toString(),
      actor: formattedActor,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      meta: log.meta,
      at: log.at,
    };
  });

  const response: AdminAuditLogsResponse = {
    logs,
    total,
    page,
    totalPages,
  };

  res.status(200).json(response);
}
