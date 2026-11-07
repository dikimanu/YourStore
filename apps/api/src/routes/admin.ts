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
  AdminEnquiriesQuerySchema,
  AdminAuditLogsQuerySchema,
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
  adminGetEnquiries,
  adminGetAuditLogs,
} from "../controllers/adminLists.js";

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

// Product management
router.get("/products", validateQuery(ProductQuerySchema), asyncHandler(adminListProducts));
router.get("/products/:id", asyncHandler(adminGetProduct));
router.post("/products", validateBody(CreateProductInputSchema), asyncHandler(adminCreateProduct));
router.put("/products/:id", validateBody(UpdateProductInputSchema), asyncHandler(adminUpdateProduct));
router.delete("/products/:id", asyncHandler(adminDeleteProduct));

// Order management
router.get("/orders", validateQuery(AdminOrdersQuerySchema), asyncHandler(adminGetOrders));

// Customers, Enquiries, Audit Logs management
router.get("/customers", validateQuery(AdminCustomersQuerySchema), asyncHandler(adminGetCustomers));
router.get("/enquiries", validateQuery(AdminEnquiriesQuerySchema), asyncHandler(adminGetEnquiries));
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

// Coupon management
router.get("/coupons", validateQuery(AdminCouponQuerySchema), asyncHandler(adminListCoupons));
router.post("/coupons", validateBody(CreateCouponInputSchema), asyncHandler(adminCreateCoupon));
router.patch("/coupons/:id", validateBody(UpdateCouponInputSchema), asyncHandler(adminUpdateCoupon));
router.delete("/coupons/:id", asyncHandler(adminDeleteCoupon));

export default router;

