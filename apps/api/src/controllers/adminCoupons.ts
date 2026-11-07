import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  CreateCouponInput,
  UpdateCouponInput,
  AdminCouponQuery,
} from "@yourstore/shared";
import { Coupon } from "../models/Coupon.js";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors.js";
import { createAuditLog } from "../lib/auditLog.js";

/**
 * GET /api/v1/admin/coupons
 * Search by code, filter active/expired/inactive, paginated, lean.
 */
export async function adminListCoupons(req: Request, res: Response): Promise<void> {
  const { search, status, page = 1, limit = 20 } = (req.query ?? {}) as unknown as AdminCouponQuery;

  const filter: Record<string, unknown> = {};

  if (search && search.trim()) {
    // Escape regex characters
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter["code"] = { $regex: escaped, $options: "i" };
  }

  const now = new Date();
  if (status === "active") {
    filter["isActive"] = true;
    filter["$or"] = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ];
  } else if (status === "expired") {
    filter["expiresAt"] = { $lte: now };
  } else if (status === "inactive") {
    filter["isActive"] = false;
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Coupon.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limitNum) || 1;

  res.status(200).json({
    coupons,
    total,
    page: pageNum,
    totalPages,
    limit: limitNum,
  });
}

/**
 * POST /api/v1/admin/coupons
 * Creates a new coupon. 409 on duplicate code. Writes AuditLog.
 */
export async function adminCreateCoupon(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateCouponInput;
  const adminId = req.user?.id;

  const existing = await Coupon.findOne({ code: input.code });
  if (existing) {
    throw new ConflictError(`Coupon code "${input.code}" already exists`);
  }

  const coupon = await Coupon.create({
    code: input.code,
    type: input.type,
    value: input.value,
    minOrder: input.minOrder ?? 0,
    expiresAt: input.expiresAt,
    usageLimit: input.usageLimit,
    usedCount: 0,
    isActive: input.isActive ?? true,
  });

  if (adminId) {
    await createAuditLog({
      actor: adminId,
      action: "coupon.create",
      targetType: "Coupon",
      targetId: coupon._id.toString(),
      meta: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        usageLimit: coupon.usageLimit,
        expiresAt: coupon.expiresAt,
      },
    });
  }

  res.status(201).json({ coupon });
}

/**
 * PATCH /api/v1/admin/coupons/:id
 * Updates an existing coupon.
 * Cannot change code or usedCount. Cannot set usageLimit below usedCount.
 * Writes AuditLog.
 */
export async function adminUpdateCoupon(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const input = req.body as UpdateCouponInput;
  const adminId = req.user?.id;

  if (!id || !mongoose.isValidObjectId(id)) {
    throw new BadRequestError("Invalid coupon ID");
  }

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new NotFoundError("Coupon not found");
  }

  // Check code/usedCount rejection if somehow supplied
  const rawBody = req.body as Record<string, unknown>;
  if (rawBody["code"] !== undefined && rawBody["code"] !== coupon.code) {
    throw new BadRequestError("Coupon code cannot be changed");
  }
  if (rawBody["usedCount"] !== undefined && rawBody["usedCount"] !== coupon.usedCount) {
    throw new BadRequestError("Coupon used count cannot be manually modified");
  }

  // Validate usageLimit cannot be below usedCount
  if (input.usageLimit !== undefined && input.usageLimit !== null) {
    if (input.usageLimit < coupon.usedCount) {
      throw new BadRequestError(
        `Usage limit (${input.usageLimit}) cannot be less than current used count (${coupon.usedCount})`,
      );
    }
    coupon.usageLimit = input.usageLimit;
  } else if (input.usageLimit === null) {
    // If set to null, remove limit
    coupon.set("usageLimit", undefined);
  }

  const targetType = input.type ?? coupon.type;
  const targetValue = input.value !== undefined ? input.value : coupon.value;
  if (targetType === "percent" && (targetValue < 1 || targetValue > 100)) {
    throw new BadRequestError("Percentage discount cannot exceed 100%");
  }

  if (input.type !== undefined) {
    coupon.type = input.type;
  }
  if (input.value !== undefined) {
    coupon.value = input.value;
  }
  if (input.minOrder !== undefined) {
    coupon.minOrder = input.minOrder;
  }
  if (input.expiresAt !== undefined) {
    if (input.expiresAt === null) {
      coupon.set("expiresAt", undefined);
    } else {
      coupon.expiresAt = input.expiresAt;
    }
  }
  if (input.isActive !== undefined) {
    coupon.isActive = input.isActive;
  }

  await coupon.save();

  if (adminId) {
    await createAuditLog({
      actor: adminId,
      action: "coupon.update",
      targetType: "Coupon",
      targetId: coupon._id.toString(),
      meta: {
        code: coupon.code,
        changes: input,
      },
    });
  }

  res.status(200).json({ coupon });
}

/**
 * DELETE /api/v1/admin/coupons/:id
 * Soft delete: sets isActive = false. Never removes the document.
 * Writes AuditLog.
 */
export async function adminDeleteCoupon(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.id;

  if (!id || !mongoose.isValidObjectId(id)) {
    throw new BadRequestError("Invalid coupon ID");
  }

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new NotFoundError("Coupon not found");
  }

  coupon.isActive = false;
  await coupon.save();

  if (adminId) {
    await createAuditLog({
      actor: adminId,
      action: "coupon.delete",
      targetType: "Coupon",
      targetId: coupon._id.toString(),
      meta: {
        code: coupon.code,
        softDeleted: true,
      },
    });
  }

  res.status(200).json({
    message: "Coupon deactivated successfully",
    coupon,
  });
}
