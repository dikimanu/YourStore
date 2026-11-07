import { describe, it, expect } from "vitest";
import request from "supertest";
import express, { Request, Response } from "express";
import { sanitizeMongo } from "../middleware/security.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { errorHandler } from "../middleware/errorHandler.js";

// Set required env vars
process.env["JWT_ACCESS_SECRET"] = "test_access_secret_32chars_long!!";
process.env["JWT_REFRESH_SECRET"] = "test_refresh_secret_32chars_long!";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

describe("Security Middleware", () => {
  describe("Helmet & CSP Headers", () => {
    it("sets strict security and CSP headers", async () => {
      const res = await request(app).get("/health");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toBeDefined();
      const csp = res.headers["content-security-policy"] as string;
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("https://res.cloudinary.com");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe("CORS Protection", () => {
    it("allows requests from the configured CLIENT_ORIGIN", async () => {
      const res = await request(app)
        .get("/health")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    });

    it("rejects requests from unauthorized origins with consistent error format", async () => {
      const res = await request(app)
        .get("/health")
        .set("Origin", "http://unauthorized-evil-site.com");

      expect(res.status).toBe(403);
      const body = res.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("CORS_ERROR");
      expect(body.error.message).toContain("not allowed by CORS");
    });
  });

  describe("express-mongo-sanitize", () => {
    it("strips prohibited NoSQL operators starting with $", async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use(sanitizeMongo);
      testApp.post("/test-sanitize", (req: Request, res: Response) => {
        res.json({ received: req.body as Record<string, unknown> });
      });

      const res = await request(testApp)
        .post("/test-sanitize")
        .send({
          username: "admin",
          $where: "malicious code",
          query: { $gt: "" },
        });

      const body = res.body as { received: Record<string, unknown> };
      expect(body.received["$where"]).toBeUndefined();
      expect(body.received["username"]).toBe("admin");
      expect((body.received["query"] as Record<string, unknown>)?.["$gt"]).toBeUndefined();
    });
  });

  describe("Auth Rate Limiter", () => {
    it("rate limits repeated requests and returns consistent 429 error", async () => {
      const testApp = express();
      testApp.use(authLimiter);
      testApp.post("/auth/login", (_req: Request, res: Response) => {
        res.json({ ok: true });
      });
      testApp.use(errorHandler);

      // Consume the limit (limit is 10)
      for (let i = 0; i < 10; i++) {
        await request(testApp).post("/auth/login").set("x-test-rate-limit", "true");
      }

      // 11th request should be blocked
      const blockedRes = await request(testApp)
        .post("/auth/login")
        .set("x-test-rate-limit", "true");
      expect(blockedRes.status).toBe(429);
      const body = blockedRes.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(body.error.message).toContain("Too many authentication attempts");
    });
  });
});
