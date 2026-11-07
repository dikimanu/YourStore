import { rateLimit } from "express-rate-limit";
import { Request, Response } from "express";
import { ApiErrorResponse } from "../lib/errors.js";

/**
 * Standard API rate limiter applied globally.
 * Allows 100 requests per 15-minute window per IP.
 * Skips the /health check endpoint.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req: Request) =>
    req.path === "/health" ||
    (process.env["NODE_ENV"] === "test" && !req.headers["x-test-rate-limit"]),
  handler: (_req: Request, res: Response) => {
    const response: ApiErrorResponse = {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests from this IP. Please try again after 15 minutes.",
      },
    };
    res.status(429).json(response);
  },
});

/**
 * Tighter rate limiter specifically for authentication routes (login, register, password reset).
 * Allows 10 attempts per 15-minute window per IP to defend against brute force and credential stuffing.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req: Request) =>
    process.env["NODE_ENV"] === "test" && !req.headers["x-test-rate-limit"],
  handler: (_req: Request, res: Response) => {
    const response: ApiErrorResponse = {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many authentication attempts. Please try again after 15 minutes.",
      },
    };
    res.status(429).json(response);
  },
});

/**
 * Strict rate limiter for vehicle enquiries and dealership visit bookings.
 * Allows 5 submissions per hour per IP.
 */
export const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req: Request) =>
    process.env["NODE_ENV"] === "test" && !req.headers["x-test-rate-limit"],
  handler: (_req: Request, res: Response) => {
    const response: ApiErrorResponse = {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many enquiries submitted from this IP. Please try again after an hour.",
      },
    };
    res.status(429).json(response);
  },
});
