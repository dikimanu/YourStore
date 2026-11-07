import { Router } from "express";
import { RegisterInputSchema, LoginInputSchema } from "@yourstore/shared";
import { validateBody } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { register, login, refresh, logout, getMe } from "../controllers/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

router.post("/register", validateBody(RegisterInputSchema), asyncHandler(register));
router.post("/login", validateBody(LoginInputSchema), asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", authenticate, asyncHandler(getMe));

export default router;
