import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Endpoints that are called by external webhooks (e.g., Stripe) and cannot include custom client headers
const EXEMPT_PATHS = ["/api/v1/webhooks/stripe"];

/**
 * CSRF protection middleware for state-changing HTTP requests.
 * Uses custom header verification (X-Requested-With or X-CSRF-Token).
 * Standard browsers cannot send custom headers cross-origin without CORS preflight approval.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Exempt external webhooks
  if (EXEMPT_PATHS.some((path) => req.path.startsWith(path))) {
    return next();
  }

  const csrfHeader = req.headers["x-requested-with"] || req.headers["x-csrf-token"];

  if (!csrfHeader) {
    return next(
      new AppError(
        403,
        "CSRF_ERROR",
        "CSRF protection: missing required custom header (X-Requested-With or X-CSRF-Token)",
      ),
    );
  }

  return next();
}
