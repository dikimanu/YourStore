import { Router } from "express";
import { CreateEnquiryInputSchema, AdminEnquiryReplySchema } from "@yourstore/shared";
import { optionalAuthenticate, authenticate, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { enquiryLimiter } from "../middleware/rateLimit.js";
import { createEnquiry, adminReplyEnquiry } from "../controllers/enquiries.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// POST /api/v1/enquiries
// Rate limited (5 per hour per IP), optional auth, CSRF protected (via global csrfProtection), Zod validated
router.post(
  "/",
  enquiryLimiter,
  optionalAuthenticate,
  validateBody(CreateEnquiryInputSchema),
  asyncHandler(createEnquiry),
);

export default router;
