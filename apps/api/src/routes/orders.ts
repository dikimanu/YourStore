import { Router } from "express";
import { RequestReturnInputSchema } from "@yourstore/shared";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { getMyOrders, getOrderById, cancelOrder, requestOrderReturn, getOrderInvoice } from "../controllers/orders.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// All routes under orders require authentication
router.use(authenticate);

// GET /api/v1/orders
router.get("/", asyncHandler(getMyOrders));

// GET /api/v1/orders/:id/invoice
router.get("/:id/invoice", asyncHandler(getOrderInvoice));

// GET /api/v1/orders/:id
router.get("/:id", asyncHandler(getOrderById));

// POST /api/v1/orders/:id/cancel
router.post("/:id/cancel", asyncHandler(cancelOrder));

// POST /api/v1/orders/:id/return
router.post("/:id/return", validateBody(RequestReturnInputSchema), asyncHandler(requestOrderReturn));

export default router;
