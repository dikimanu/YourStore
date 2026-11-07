import { Router } from "express";
import { ValidateCouponInputSchema } from "@yourstore/shared";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { validateCoupon } from "../controllers/coupon.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// Coupons routes require authentication
router.use(authenticate);

router.post("/validate", validateBody(ValidateCouponInputSchema), asyncHandler(validateCoupon));

export default router;
