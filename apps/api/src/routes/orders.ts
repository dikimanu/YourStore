import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getMyOrders, getOrderById, cancelOrder } from "../controllers/orders.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// All routes under orders require authentication
router.use(authenticate);

// GET /api/v1/orders
router.get("/", asyncHandler(getMyOrders));

// GET /api/v1/orders/:id
router.get("/:id", asyncHandler(getOrderById));

// POST /api/v1/orders/:id/cancel
router.post("/:id/cancel", asyncHandler(cancelOrder));

export default router;
