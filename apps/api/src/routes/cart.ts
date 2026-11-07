import { Router } from "express";
import {
  CartItemInputSchema,
  UpdateCartItemInputSchema,
  RemoveCartItemInputSchema,
  MergeCartInputSchema,
} from "@yourstore/shared";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  mergeCart,
} from "../controllers/cart.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// All cart endpoints require an authenticated user
router.use(authenticate);

router.get("/", asyncHandler(getCart));
router.post("/items", validateBody(CartItemInputSchema), asyncHandler(addToCart));
router.patch("/items", validateBody(UpdateCartItemInputSchema), asyncHandler(updateCartItem));
router.delete("/items", validateBody(RemoveCartItemInputSchema), asyncHandler(removeCartItem));
router.post("/merge", validateBody(MergeCartInputSchema), asyncHandler(mergeCart));

export default router;
