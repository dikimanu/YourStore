import { Router } from "express";
import {
  CreateProductInputSchema,
  UpdateProductInputSchema,
  ProductQuerySchema,
  SignUploadInputSchema,
} from "@yourstore/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  adminListProducts,
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
} from "../controllers/product.js";
import { signUpload } from "../controllers/upload.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// All routes under adminRouter require authentication and admin role
router.use(authenticate, requireRole("admin"));

// Upload signing
router.post(
  "/uploads/sign",
  validateBody(SignUploadInputSchema),
  signUpload,
);

// Product management
router.get("/products", validateQuery(ProductQuerySchema), asyncHandler(adminListProducts));
router.get("/products/:id", asyncHandler(adminGetProduct));
router.post("/products", validateBody(CreateProductInputSchema), asyncHandler(adminCreateProduct));
router.put("/products/:id", validateBody(UpdateProductInputSchema), asyncHandler(adminUpdateProduct));
router.delete("/products/:id", asyncHandler(adminDeleteProduct));

export default router;

