import { Request, Response, NextFunction } from "express";
import { UserRole } from "@yourstore/shared";
import { UnauthorizedError, ForbiddenError } from "../lib/errors.js";
import { verifyAccessToken, AccessTokenPayload } from "../lib/token.js";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication middleware that verifies the JWT access token
 * from httpOnly cookies or the Authorization: Bearer header.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    // 1. Try httpOnly cookie
    const cookies = req.cookies as Record<string, unknown> | undefined;
    if (cookies && typeof cookies["accessToken"] === "string") {
      token = cookies["accessToken"];
    }

    // 2. Try Authorization header
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }

    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired access token");
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Optional authentication middleware: if token is provided, attaches req.user.
 * If not provided or invalid, continues without throwing error.
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    const cookies = req.cookies as Record<string, unknown> | undefined;
    if (cookies && typeof cookies["accessToken"] === "string") {
      token = cookies["accessToken"];
    }

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (token) {
      try {
        const payload = verifyAccessToken(token);
        req.user = {
          id: payload.sub,
          role: payload.role,
          email: payload.email,
        };
      } catch {
        // Token invalid or expired, continue as guest
      }
    }

    return next();
  } catch {
    return next();
  }
}

/**
 * Role authorization middleware. Requires user to have one of the specified roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("You do not have permission to access this resource"));
    }

    return next();
  };
}
