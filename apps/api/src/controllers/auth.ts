import { Request, Response } from "express";
import crypto from "node:crypto";
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "@yourstore/shared";
import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
  RefreshTokenPayload,
} from "../lib/token.js";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  AppError,
} from "../lib/errors.js";
import { createAuditLog } from "../lib/auditLog.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function getRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  if (!cookies) return undefined;
  const token = cookies["refreshToken"];
  return typeof token === "string" ? token : undefined;
}

function getRefreshTokenFromBody(req: Request): string | undefined {
  const body = req.body as Record<string, unknown> | undefined;
  if (!body) return undefined;
  const token = body["refreshToken"];
  return typeof token === "string" ? token : undefined;
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body as RegisterInput;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const emailVerificationTokenHash = hashToken(verificationToken);
  const emailVerificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);

  const user = new User({
    name,
    email,
    passwordHash,
    role: "user",
    emailVerified: false,
    emailVerificationTokenHash,
    emailVerificationExpiresAt,
  });

  const accessToken = generateAccessToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  });
  const refreshToken = generateRefreshToken(user._id.toString());

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  // Send verification email via Resend asynchronously without blocking response
  void sendVerificationEmail(user.email, verificationToken);

  res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());
  res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

  res.status(201).json({ user: user.toJSON() });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const user = await User.findOne({ email }).select("+passwordHash +refreshTokenHash");

  // Identical error message for unknown email
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // Check if account is locked
  if (user.isLocked()) {
    throw new AppError(
      423,
      "ACCOUNT_LOCKED",
      "Account is temporarily locked due to repeated failed login attempts. Please try again later.",
    );
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    user.failedLoginCount = (user.failedLoginCount || 0) + 1;

    if (user.failedLoginCount >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await createAuditLog({
        actor: user._id.toString(),
        action: "ACCOUNT_LOCKOUT",
        targetType: "User",
        targetId: user._id.toString(),
        meta: { failedAttempts: user.failedLoginCount },
      });
    }

    await user.save();

    // Identical error message for wrong password
    throw new UnauthorizedError("Invalid email or password");
  }

  // Login successful: reset failed count and lock
  user.failedLoginCount = 0;
  user.lockUntil = null;

  const accessToken = generateAccessToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  });
  const refreshToken = generateRefreshToken(user._id.toString());

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());
  res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

  res.status(200).json({ user: user.toJSON() });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const rawToken = getRefreshCookie(req) || getRefreshTokenFromBody(req);

  if (!rawToken) {
    throw new UnauthorizedError("Refresh token is required");
  }

  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    res.clearCookie("accessToken", getClearCookieOptions());
    res.clearCookie("refreshToken", getClearCookieOptions());
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const incomingHash = hashToken(rawToken);
  const user = await User.findById(payload.sub).select("+refreshTokenHash");

  if (!user) {
    res.clearCookie("accessToken", getClearCookieOptions());
    res.clearCookie("refreshToken", getClearCookieOptions());
    throw new UnauthorizedError("User not found");
  }

  // Token reuse detection: if hash doesn't match the current stored hash
  if (!user.refreshTokenHash || user.refreshTokenHash !== incomingHash) {
    // Invalidate all active sessions for this user immediately
    user.refreshTokenHash = null;
    await user.save();

    res.clearCookie("accessToken", getClearCookieOptions());
    res.clearCookie("refreshToken", getClearCookieOptions());

    await createAuditLog({
      actor: user._id.toString(),
      action: "REFRESH_TOKEN_REUSE_DETECTED",
      targetType: "User",
      targetId: user._id.toString(),
    });

    throw new UnauthorizedError("Invalid refresh token or token reuse detected");
  }

  // Token rotation: issue a fresh access token and a fresh refresh token
  const newAccessToken = generateAccessToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  });
  const newRefreshToken = generateRefreshToken(user._id.toString());

  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save();

  res.cookie("accessToken", newAccessToken, getAccessTokenCookieOptions());
  res.cookie("refreshToken", newRefreshToken, getRefreshTokenCookieOptions());

  res.status(200).json({ success: true });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = getRefreshCookie(req) || getRefreshTokenFromBody(req);

  if (rawToken) {
    try {
      const payload = verifyRefreshToken(rawToken);
      await User.findByIdAndUpdate(payload.sub, { refreshTokenHash: null });
    } catch {
      // In case token is already expired, proceed with clearing
    }
  } else if (req.user?.id) {
    await User.findByIdAndUpdate(req.user.id, { refreshTokenHash: null });
  }

  res.clearCookie("accessToken", getClearCookieOptions());
  res.clearCookie("refreshToken", getClearCookieOptions());

  res.status(200).json({ success: true, message: "Logged out successfully" });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  res.status(200).json({ user: user.toJSON() });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body as VerifyEmailInput;

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
  }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

  if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
    throw new BadRequestError("Invalid or expired verification token");
  }

  // Single-use: mark verified and invalidate token
  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpiresAt = null;
  await user.save();

  await createAuditLog({
    actor: user._id.toString(),
    action: "EMAIL_VERIFIED",
    targetType: "User",
    targetId: user._id.toString(),
  });

  res.status(200).json({ success: true, message: "Email verified successfully" });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordInput;

  // Generic success response to avoid revealing whether an email exists
  const successResponse = {
    success: true,
    message: "If an account exists with this email, a password reset link has been sent.",
  };

  const user = await User.findOne({ email }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");
  if (!user) {
    res.status(200).json(successResponse);
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordTokenHash = hashToken(resetToken);
  user.resetPasswordExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
  await user.save();

  void sendPasswordResetEmail(user.email, resetToken);

  res.status(200).json(successResponse);
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as ResetPasswordInput;

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
  }).select("+resetPasswordTokenHash +resetPasswordExpiresAt +passwordHash +refreshTokenHash");

  if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
    throw new BadRequestError("Invalid or expired password reset token");
  }

  // Single-use: update password, invalidate reset token and all active refresh sessions
  user.passwordHash = await hashPassword(password);
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpiresAt = null;
  user.refreshTokenHash = null; // Invalidate existing sessions
  user.failedLoginCount = 0;
  user.lockUntil = null;
  await user.save();

  await createAuditLog({
    actor: user._id.toString(),
    action: "PASSWORD_RESET_COMPLETED",
    targetType: "User",
    targetId: user._id.toString(),
  });

  res.clearCookie("accessToken", getClearCookieOptions());
  res.clearCookie("refreshToken", getClearCookieOptions());

  res.status(200).json({ success: true, message: "Password reset successful. Please log in with your new password." });
}
