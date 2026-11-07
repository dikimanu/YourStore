import { Router } from "express";
import { ProductQuerySchema } from "@yourstore/shared";
import { validateQuery } from "../middleware/validate.js";
import {
  listProducts,
  getProductBySlug,
  getProductSuggestions,
  getRelatedProducts,
} from "../controllers/product.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// Public routes
router.get("/", validateQuery(ProductQuerySchema), asyncHandler(listProducts));
router.get("/suggestions", asyncHandler(getProductSuggestions));
router.get("/related/:id", asyncHandler(getRelatedProducts));
router.get("/:slug", asyncHandler(getProductBySlug));

export default router;
