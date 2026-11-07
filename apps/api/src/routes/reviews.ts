import { Router } from "express";
import { CreateReviewInputSchema, ReviewQuerySchema } from "@yourstore/shared";
import { authenticate } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  createReview,
  getProductReviews,
  deleteReview,
} from "../controllers/reviews.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// GET /api/v1/reviews?productId=... (public, paginated)
router.get("/", validateQuery(ReviewQuerySchema), asyncHandler(getProductReviews));

// POST /api/v1/reviews (authenticated, CSRF-protected via global csrfProtection)
router.post(
  "/",
  authenticate,
  validateBody(CreateReviewInputSchema),
  asyncHandler(createReview),
);

// DELETE /api/v1/reviews/:id (owner or admin only)
router.delete("/:id", authenticate, asyncHandler(deleteReview));

export default router;
