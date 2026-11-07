import { describe, it, expect } from "vitest";
import request from "supertest";

// Set required env vars before importing app
process.env["JWT_ACCESS_SECRET"] = "test_access_secret_32chars_long!!";
process.env["JWT_REFRESH_SECRET"] = "test_refresh_secret_32chars_long!";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../src/index.js");

describe("GET /health", () => {
  it("returns status ok and db down when no MONGO_URI set", async () => {
    const res = await request(app).get("/health");
    const body = res.body as { status: string; db: string; uptime: number };

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("down");
    expect(typeof body.uptime).toBe("number");
  });
});

