import "dotenv/config";
import { env } from "./env.js";
import express from "express";
import cookieParser from "cookie-parser";
import { connectDb } from "./db.js";
import { securityHeaders, corsMiddleware, sanitizeMongo } from "./middleware/security.js";
import { generalLimiter, authLimiter } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import productsRouter from "./routes/products.js";
import adminRouter from "./routes/admin.js";
import { logger } from "./lib/logger.js";

const app = express();

// Trust reverse proxy (e.g. Render, Vercel)
app.set("trust proxy", 1);

// Security headers with strict CSP
app.use(securityHeaders);

// Strict CORS (only CLIENT_ORIGIN)
app.use(corsMiddleware);

// Rate limiting (general limiter applied to all endpoints, skips /health)
app.use(generalLimiter);

// Pino request logger without PII
app.use(requestLogger);

// Request body and cookie parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Express Mongo Sanitize (prevent NoSQL injection)
app.use(sanitizeMongo);

// CSRF protection for state-changing requests
app.use(csrfProtection);

// Mount routes
app.use(healthRouter);
app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/admin", adminRouter);

// 404 and Error handling middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export { app, authLimiter };

if (process.env["VITEST"] !== "true") {
  connectDb().catch((err) => {
    logger.warn({ err: (err as Error).message }, "MongoDB connection failed (db will show as down)");
  });

  app.listen(env.PORT, () => {
    logger.info(`🚀 API listening on http://localhost:${env.PORT}`);
  });
}
