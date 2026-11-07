import { Router } from "express";
import { WishlistInputSchema } from "@yourstore/shared";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../controllers/wishlist.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// All wishlist routes require authentication
router.use(authenticate);

// GET /api/v1/wishlist
router.get("/", asyncHandler(getWishlist));

// POST /api/v1/wishlist
router.post("/", validateBody(WishlistInputSchema), asyncHandler(addToWishlist));

// DELETE /api/v1/wishlist/:productId
router.delete("/:productId", asyncHandler(removeFromWishlist));

export default router;
