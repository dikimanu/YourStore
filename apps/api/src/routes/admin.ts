import { Router } from "express";
import {
  CreateProductInputSchema,
  UpdateProductInputSchema,
  ProductQuerySchema,
  SignUploadInputSchema,
  AdminOrderStatusUpdateSchema,
  CreateCouponInputSchema,
  UpdateCouponInputSchema,
  AdminCouponQuerySchema,
  AdminReturnDecisionSchema,
  AdminOrdersQuerySchema,
  AdminCustomersQuerySchema,
  AdminAuditLogsQuerySchema,
  CsvImportRequestSchema,
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
import {
  adminGetOrders,
  adminUpdateOrderStatus,
  adminGetReturns,
  adminDecideReturn,
  adminRefundOrder,
} from "../controllers/adminOrders.js";
import {
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
} from "../controllers/adminCoupons.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AdminStatsQuerySchema } from "@yourstore/shared";
import { getAdminStats } from "../controllers/adminStats.js";
import {
  adminGetCustomers,
  adminGetAuditLogs,
} from "../controllers/adminLists.js";
import {
  adminImportPreview,
  adminImportCommit,
} from "../controllers/adminProductImport.js";

const router = Router();

// All routes under adminRouter require authentication and admin role
router.use(authenticate, requireRole("admin"));

// Admin statistics
router.get("/stats", validateQuery(AdminStatsQuerySchema), asyncHandler(getAdminStats));

// Upload signing
router.post(
  "/uploads/sign",
  validateBody(SignUploadInputSchema),
  signUpload,
);

// CSV product import
router.post("/products/import/preview", validateBody(CsvImportRequestSchema), asyncHandler(adminImportPreview));
router.post("/products/import/commit", validateBody(CsvImportRequestSchema), asyncHandler(adminImportCommit));

// Product management
router.get("/products", validateQuery(ProductQuerySchema), asyncHandler(adminListProducts));
router.get("/products/:id", asyncHandler(adminGetProduct));
router.post("/products", validateBody(CreateProductInputSchema), asyncHandler(adminCreateProduct));
router.put("/products/:id", validateBody(UpdateProductInputSchema), asyncHandler(adminUpdateProduct));
router.delete("/products/:id", asyncHandler(adminDeleteProduct));

// Order management
router.get("/orders", validateQuery(AdminOrdersQuerySchema), asyncHandler(adminGetOrders));

// Customers, Audit Logs management
router.get("/customers", validateQuery(AdminCustomersQuerySchema), asyncHandler(adminGetCustomers));
router.get("/audit-logs", validateQuery(AdminAuditLogsQuerySchema), asyncHandler(adminGetAuditLogs));
router.patch(
  "/orders/:id/status",
  validateBody(AdminOrderStatusUpdateSchema),
  asyncHandler(adminUpdateOrderStatus),
);

// Returns & Refunds management
router.get("/returns", asyncHandler(adminGetReturns));
router.patch(
  "/orders/:id/return",
  validateBody(AdminReturnDecisionSchema),
  asyncHandler(adminDecideReturn),
);
router.patch("/orders/:id/refund", asyncHandler(adminRefundOrder));

export default router;
