import { describe, it, expect } from "vitest";
import request from "supertest";
import express, { Request, Response } from "express";
import { z } from "zod";
import { validate, validateBody } from "../middleware/validate.js";
import { errorHandler, notFoundHandler } from "../middleware/errorHandler.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  InternalServerError,
} from "../lib/errors.js";

describe("Validation Middleware & Error Handling", () => {
  const setupTestApp = () => {
    const app = express();
    app.use(express.json());
    return app;
  };

  describe("Zod validation middleware", () => {
    it("validates body successfully and attaches parsed data", async () => {
      const app = setupTestApp();
      const schema = z.object({
        email: z.string().email(),
        count: z.number().int().positive(),
      });

      app.post("/test-body", validateBody(schema), (req: Request, res: Response) => {
        res.json({ data: req.body as Record<string, unknown> });
      });
      app.use(errorHandler);

      const res = await request(app)
        .post("/test-body")
        .send({ email: "user@example.com", count: 5 });

      expect(res.status).toBe(200);
      const body = res.body as { data: { email: string; count: number } };
      expect(body.data.email).toBe("user@example.com");
      expect(body.data.count).toBe(5);
    });

    it("returns consistent 400 VALIDATION_ERROR on invalid input", async () => {
      const app = setupTestApp();
      const schema = z.object({
        email: z.string().email(),
        count: z.number().int().positive(),
      });

      app.post("/test-body", validateBody(schema), (req: Request, res: Response) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app)
        .post("/test-body")
        .send({ email: "invalid-email", count: -1 });

      expect(res.status).toBe(400);
      const body = res.body as {
        error: {
          code: string;
          message: string;
          details: Array<{ path: string; message: string }>;
        };
      };
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("Validation failed");
      expect(Array.isArray(body.error.details)).toBe(true);
      expect(body.error.details.length).toBeGreaterThanOrEqual(2);
    });

    it("validates query and params", async () => {
      const app = setupTestApp();
      const querySchema = z.object({ page: z.coerce.number().min(1) });
      const paramsSchema = z.object({ id: z.string().min(5) });

      app.get(
        "/items/:id",
        validate({ query: querySchema, params: paramsSchema }),
        (req: Request, res: Response) => {
          res.json({ params: req.params, query: req.query });
        },
      );
      app.use(errorHandler);

      const resValid = await request(app).get("/items/12345?page=2");
      expect(resValid.status).toBe(200);

      const resInvalidParam = await request(app).get("/items/12?page=2");
      expect(resInvalidParam.status).toBe(400);

      const resInvalidQuery = await request(app).get("/items/12345?page=0");
      expect(resInvalidQuery.status).toBe(400);
    });
  });

  describe("Consistent error format", () => {
    it("formats AppError subclasses with { error: { code, message, details? } }", async () => {
      const app = setupTestApp();

      app.get("/bad-request", () => {
        throw new BadRequestError("Invalid request parameter", { field: "param" });
      });
      app.get("/unauthorized", () => {
        throw new UnauthorizedError();
      });
      app.get("/forbidden", () => {
        throw new ForbiddenError();
      });
      app.get("/not-found", () => {
        throw new NotFoundError("Product not found");
      });
      app.get("/conflict", () => {
        throw new ConflictError("Email already in use");
      });
      app.get("/too-many", () => {
        throw new TooManyRequestsError();
      });
      app.get("/internal", () => {
        throw new InternalServerError();
      });

      app.use(errorHandler);

      const resBad = await request(app).get("/bad-request");
      expect(resBad.status).toBe(400);
      const badBody = resBad.body as { error: { code: string; message: string; details: unknown } };
      expect(badBody.error.code).toBe("BAD_REQUEST");
      expect(badBody.error.message).toBe("Invalid request parameter");
      expect(badBody.error.details).toEqual({ field: "param" });

      const resAuth = await request(app).get("/unauthorized");
      expect(resAuth.status).toBe(401);
      const authBody = resAuth.body as { error: { code: string; message: string } };
      expect(authBody.error.code).toBe("UNAUTHORIZED");

      const resForb = await request(app).get("/forbidden");
      expect(resForb.status).toBe(403);
      const forbBody = resForb.body as { error: { code: string; message: string } };
      expect(forbBody.error.code).toBe("FORBIDDEN");

      const resNotFound = await request(app).get("/not-found");
      expect(resNotFound.status).toBe(404);
      const notFoundBody = resNotFound.body as { error: { code: string; message: string } };
      expect(notFoundBody.error.code).toBe("NOT_FOUND");
      expect(notFoundBody.error.message).toBe("Product not found");

      const resConflict = await request(app).get("/conflict");
      expect(resConflict.status).toBe(409);
      const conflictBody = resConflict.body as { error: { code: string; message: string } };
      expect(conflictBody.error.code).toBe("CONFLICT");

      const resRate = await request(app).get("/too-many");
      expect(resRate.status).toBe(429);
      const rateBody = resRate.body as { error: { code: string; message: string } };
      expect(rateBody.error.code).toBe("RATE_LIMIT_EXCEEDED");

      const resInternal = await request(app).get("/internal");
      expect(resInternal.status).toBe(500);
      const intBody = resInternal.body as { error: { code: string; message: string } };
      expect(intBody.error.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("returns 404 in consistent format for unknown routes", async () => {
      const app = setupTestApp();
      app.use(notFoundHandler);
      app.use(errorHandler);

      const res = await request(app).get("/random-unknown-endpoint");
      expect(res.status).toBe(404);
      const body = res.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("Cannot GET /random-unknown-endpoint");
    });

    it("handles malformed JSON body with 400 BAD_REQUEST", async () => {
      const app = setupTestApp();
      app.post("/test-json", (_req: Request, res: Response) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app)
        .post("/test-json")
        .set("Content-Type", "application/json")
        .send("{ broken json: ");

      expect(res.status).toBe(400);
      const body = res.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("BAD_REQUEST");
      expect(body.error.message).toContain("Malformed JSON payload");
    });
  });
});
