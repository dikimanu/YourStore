import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import { env } from "../env.js";
import { AppError } from "../lib/errors.js";

/**
 * Helmet with strict Content Security Policy (CSP).
 * Only allows scripts and assets from self, and images from self and Cloudinary.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
});

/**
 * Strict CORS middleware allowing only the configured CLIENT_ORIGIN.
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Requests with no origin (e.g. mobile apps, curl, or same-origin server calls) or matching CLIENT_ORIGIN
    if (!origin || origin === env.CLIENT_ORIGIN) {
      callback(null, true);
    } else {
      callback(new AppError(403, "CORS_ERROR", `Origin '${origin}' not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
});

/**
 * Express Mongo Sanitize middleware to prevent NoSQL query injection.
 * Strips any keys in body, query, or params starting with '$' or containing '.'.
 */
export const sanitizeMongo = mongoSanitize();
