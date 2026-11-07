import { Router } from "express";
import { CheckoutStripeInputSchema } from "@yourstore/shared";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createStripeCheckout } from "../controllers/checkout.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// POST /api/v1/checkout/stripe
// Authenticated and state-changing (CSRF-protected via global middleware)
router.post(
  "/stripe",
  authenticate,
  validateBody(CheckoutStripeInputSchema),
  asyncHandler(createStripeCheckout),
);

export default router;
