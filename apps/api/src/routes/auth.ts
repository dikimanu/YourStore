import { Router } from "express";
import {
  RegisterInputSchema,
  LoginInputSchema,
  ForgotPasswordInputSchema,
  ResetPasswordInputSchema,
  VerifyEmailInputSchema,
} from "@yourstore/shared";
import { validateBody } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

router.post("/register", validateBody(RegisterInputSchema), asyncHandler(register));
router.post("/login", validateBody(LoginInputSchema), asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", authenticate, asyncHandler(getMe));
router.post("/verify-email", validateBody(VerifyEmailInputSchema), asyncHandler(verifyEmail));
router.post("/forgot-password", validateBody(ForgotPasswordInputSchema), asyncHandler(forgotPassword));
router.post("/reset-password", validateBody(ResetPasswordInputSchema), asyncHandler(resetPassword));

export default router;
