import { Request, Response } from "express";
import { ValidateCouponInput } from "@yourstore/shared";
import { Coupon } from "../models/Coupon.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";

/**
 * POST /api/v1/coupons/validate
 * Validates a coupon code server-side against subtotal, isActive, expiresAt, minOrder, usageLimit vs usedCount.
 * Computes discount for given subtotal.
 * Does NOT increment usedCount here.
 */
export async function validateCoupon(req: Request, res: Response): Promise<void> {
  const { code, subtotal } = req.body as ValidateCouponInput;

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon || !coupon.isActive) {
    throw new NotFoundError("Coupon not found or inactive");
  }

  // Check expiration
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now()) {
    throw new BadRequestError("Coupon has expired");
  }

  // Check usage limit
  if (coupon.usageLimit !== undefined && coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new BadRequestError("Coupon usage limit has been reached");
  }

  // Check minimum order amount
  if (subtotal < coupon.minOrder) {
    throw new BadRequestError(
      `Minimum order amount of ₹${coupon.minOrder} required to use this coupon`,
    );
  }

  let discount = 0;
  if (coupon.type === "percent") {
    // Percent discount: (subtotal * value) / 100
    discount = Math.round(((subtotal * coupon.value) / 100) * 100) / 100;
    // Discount cannot exceed subtotal
    discount = Math.min(discount, subtotal);
  } else if (coupon.type === "fixed") {
    // Fixed amount discount: capped at subtotal
    discount = Math.min(coupon.value, subtotal);
  }

  const newSubtotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  res.status(200).json({
    valid: true,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minOrder: coupon.minOrder,
    discount,
    newSubtotal,
  });
}
