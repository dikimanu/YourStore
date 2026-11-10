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
 * Rate limiter for authentication routes.
 * Skips /login, /logout, /refresh, and /me to allow unlimited login/logout/session checks.
 * Has a generous limit (500 attempts) for other endpoints to defend against automated abuse without blocking standard user flows.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req: Request) => {
    // Explicitly bypass login, logout, refresh, and me endpoints
    const unconstrainedPaths = ["/login", "/logout", "/refresh", "/me"];
    if (unconstrainedPaths.some((p) => req.path.endsWith(p))) {
      return true;
    }
    return process.env["NODE_ENV"] === "test" && !req.headers["x-test-rate-limit"];
  },
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
