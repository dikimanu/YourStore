import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ApiErrorResponse } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { env } from "../env.js";

interface MongoError extends Error {
  code?: number;
  keyPattern?: Record<string, number>;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If response headers are already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // 1. Known AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, err.message);
    }
    const response: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // 2. Zod validation error
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const response: ApiErrorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details,
      },
    };
    res.status(400).json(response);
    return;
  }

  // 3. JSON syntax error (malformed request body)
  if (err instanceof SyntaxError && "body" in err && (err as { status?: number }).status === 400) {
    const response: ApiErrorResponse = {
      error: {
        code: "BAD_REQUEST",
        message: "Malformed JSON payload in request body",
      },
    };
    res.status(400).json(response);
    return;
  }

  // 4. MongoDB duplicate key error (code 11000)
  const mongoErr = err as MongoError;
  if (mongoErr && mongoErr.code === 11000) {
    const keys = mongoErr.keyPattern ? Object.keys(mongoErr.keyPattern).join(", ") : "resource";
    const response: ApiErrorResponse = {
      error: {
        code: "CONFLICT",
        message: `A record with this ${keys} already exists.`,
      },
    };
    res.status(409).json(response);
    return;
  }

  // 5. Unhandled / generic server errors
  logger.error(
    {
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      path: req.path,
      method: req.method,
    },
    "Unhandled exception caught by error middleware",
  );

  const response: ApiErrorResponse = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred. Please try again later."
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred.",
    },
  };

  res.status(500).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiErrorResponse = {
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.path}`,
    },
  };
  res.status(404).json(response);
}
