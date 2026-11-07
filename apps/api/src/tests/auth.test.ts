import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { Types } from "mongoose";
import { User, IUser } from "../models/User.js";
import { hashPassword } from "../lib/password.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../lib/token.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { errorHandler } from "../middleware/errorHandler.js";

// Ensure environment variables are loaded for tests
process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

describe("Phase 1 Part B: Authentication & Security", () => {
  // In-memory mock store for users to isolate unit/integration tests without external DB
  const memoryUsers = new Map<string, IUser>();

  beforeEach(() => {
    memoryUsers.clear();
    vi.restoreAllMocks();

    // Mock User.findOne
    vi.spyOn(User, "findOne").mockImplementation((filter: unknown) => {
      const email = (filter as { email?: string })?.email;
      const found = email
        ? Array.from(memoryUsers.values()).find((u) => u.email === email)
        : null;

      return {
        select: vi.fn().mockImplementation(() => Promise.resolve(found ?? null)),
        then: (resolve: (val: unknown) => void) => Promise.resolve(found ?? null).then(resolve),
      } as unknown as ReturnType<typeof User.findOne>;
    });

    // Mock User.findById
    vi.spyOn(User, "findById").mockImplementation((id: unknown) => {
      const idStr = id?.toString();
      const found = idStr ? memoryUsers.get(idStr) : null;

      return {
        select: vi.fn().mockImplementation(() => Promise.resolve(found ?? null)),
        then: (resolve: (val: unknown) => void) => Promise.resolve(found ?? null).then(resolve),
      } as unknown as ReturnType<typeof User.findById>;
    });

    // Mock User.findByIdAndUpdate
    vi.spyOn(User, "findByIdAndUpdate").mockImplementation((id: unknown, update: unknown) => {
      const idStr = id?.toString();
      const user = idStr ? memoryUsers.get(idStr) : null;
      if (user && typeof update === "object" && update !== null) {
        Object.assign(user, update);
      }
      return Promise.resolve(user ?? null) as unknown as ReturnType<typeof User.findByIdAndUpdate>;
    });

    // Mock user.save() on document creation
    vi.spyOn(User.prototype, "save").mockImplementation(function (this: IUser) {
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      memoryUsers.set(this._id.toString(), this);
      return Promise.resolve(this);
    });
  });

  describe("CSRF Protection", () => {
    it("rejects state-changing requests without custom CSRF header", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "csrf.test@example.com",
          password: "Password123!",
        });

      expect(res.status).toBe(403);
      const body = res.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("CSRF_ERROR");
      expect(body.error.message).toContain("missing required custom header");
    });

    it("accepts requests with X-Requested-With header", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          name: "Test User",
          email: "csrf.pass@example.com",
          password: "Password123!",
        });

      expect(res.status).toBe(201);
    });
  });

  describe("Registration & Argon2 Password Hashing", () => {
    it("registers user, hashes password with argon2, sets httpOnly cookies, and returns safe user JSON", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          name: "Alice Developer",
          email: "alice@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(201);
      const body = res.body as { user: Record<string, unknown> };
      expect(body.user["name"]).toBe("Alice Developer");
      expect(body.user["email"]).toBe("alice@example.com");
      expect(body.user["role"]).toBe("user");
      expect(body.user["passwordHash"]).toBeUndefined();
      expect(body.user["refreshTokenHash"]).toBeUndefined();

      // Verify cookies
      const cookies = (res.headers["set-cookie"] as unknown as string[]) || [];
      expect(cookies).toBeDefined();
      const accessTokenCookie = cookies.find((c) => c.startsWith("accessToken="));
      const refreshTokenCookie = cookies.find((c) => c.startsWith("refreshToken="));

      expect(accessTokenCookie).toContain("HttpOnly");
      expect(accessTokenCookie).toContain("SameSite=Lax");
      expect(refreshTokenCookie).toContain("HttpOnly");
      expect(refreshTokenCookie).toContain("SameSite=Lax");

      // Verify stored user in database has argon2 hash
      const storedUser = Array.from(memoryUsers.values()).find((u) => u.email === "alice@example.com");
      expect(storedUser).toBeDefined();
      expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(storedUser?.refreshTokenHash).toBeDefined();
    });

    it("rejects registration with conflict if email already exists", async () => {
      // First registration
      await request(app)
        .post("/api/v1/auth/register")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          name: "Duplicate User",
          email: "duplicate@example.com",
          password: "Password123!",
        });

      // Second registration with same email
      const res = await request(app)
        .post("/api/v1/auth/register")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          name: "Duplicate User 2",
          email: "duplicate@example.com",
          password: "Password123!",
        });

      expect(res.status).toBe(409);
      const body = res.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("CONFLICT");
      expect(body.error.message).toContain("already exists");
    });
  });

  describe("Login & Account Lockout", () => {
    beforeEach(async () => {
      // Seed a test user
      const passwordHash = await hashPassword("CorrectPassword123!");
      const user = new User({
        name: "Login User",
        email: "login@example.com",
        passwordHash,
        role: "user",
        failedLoginCount: 0,
        lockUntil: null,
      });
      await user.save();
    });

    it("logs in successfully with correct credentials and issues new tokens", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          email: "login@example.com",
          password: "CorrectPassword123!",
        });

      expect(res.status).toBe(200);
      const body = res.body as { user: Record<string, unknown> };
      expect(body.user["email"]).toBe("login@example.com");

      const cookies = (res.headers["set-cookie"] as unknown as string[]) || [];
      expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
    });

    it("returns identical errors for unknown email and wrong password", async () => {
      // 1. Unknown email
      const resUnknown = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          email: "unknown.user@example.com",
          password: "SomePassword123!",
        });

      expect(resUnknown.status).toBe(401);
      const bodyUnknown = resUnknown.body as { error: { code: string; message: string } };
      expect(bodyUnknown.error.code).toBe("UNAUTHORIZED");
      expect(bodyUnknown.error.message).toBe("Invalid email or password");

      // 2. Existing user with wrong password
      const resWrongPwd = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          email: "login@example.com",
          password: "WrongPassword123!",
        });

      expect(resWrongPwd.status).toBe(401);
      const bodyWrongPwd = resWrongPwd.body as { error: { code: string; message: string } };
      expect(bodyWrongPwd.error.code).toBe("UNAUTHORIZED");
      expect(bodyWrongPwd.error.message).toBe("Invalid email or password");
    });

    it("locks the account after 5 failed login attempts and blocks subsequent logins", async () => {
      // 5 consecutive failed attempts
      for (let i = 1; i <= 5; i++) {
        const failRes = await request(app)
          .post("/api/v1/auth/login")
          .set("X-Requested-With", "XMLHttpRequest")
          .send({
            email: "login@example.com",
            password: `WrongPassword${i}!`,
          });
        expect(failRes.status).toBe(401);
      }

      // Verify user document has failedLoginCount = 5 and lockUntil is set
      const user = Array.from(memoryUsers.values()).find((u) => u.email === "login@example.com");
      expect(user?.failedLoginCount).toBe(5);
      expect(user?.lockUntil).toBeInstanceOf(Date);
      expect(user?.isLocked()).toBe(true);

      // 6th attempt (even with correct password) should be locked
      const lockedRes = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          email: "login@example.com",
          password: "CorrectPassword123!",
        });

      expect(lockedRes.status).toBe(423);
      const body = lockedRes.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("ACCOUNT_LOCKED");
      expect(body.error.message).toContain("Account is temporarily locked");
    });
  });

  describe("Token Rotation & Reuse Detection", () => {
    let testUser: IUser;
    let originalRefreshToken: string;

    beforeEach(async () => {
      const passwordHash = await hashPassword("Password123!");
      testUser = new User({
        name: "Rotation User",
        email: "rotation@example.com",
        passwordHash,
        role: "user",
      });
      originalRefreshToken = generateRefreshToken(testUser._id.toString());
      testUser.refreshTokenHash = hashToken(originalRefreshToken);
      await testUser.save();
    });

    it("refreshes token successfully and rotates refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [`refreshToken=${originalRefreshToken}`]);

      expect(res.status).toBe(200);
      const cookies = (res.headers["set-cookie"] as unknown as string[]) || [];
      expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);

      // Verify user now has a different refreshTokenHash in DB
      const updatedUser = memoryUsers.get(testUser._id.toString());
      expect(updatedUser?.refreshTokenHash).not.toBe(hashToken(originalRefreshToken));
    });

    it("detects token reuse, invalidates all sessions, and returns 401", async () => {
      // 1. Legitimate refresh: rotates the token
      const res1 = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [`refreshToken=${originalRefreshToken}`]);
      expect(res1.status).toBe(200);

      // 2. Attacker (or replay) presents the OLD originalRefreshToken
      const reuseRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [`refreshToken=${originalRefreshToken}`]);

      expect(reuseRes.status).toBe(401);
      const body = reuseRes.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("token reuse detected");

      // Verify the user's refreshTokenHash was cleared completely to protect the account
      const updatedUser = memoryUsers.get(testUser._id.toString());
      expect(updatedUser?.refreshTokenHash).toBeNull();
    });
  });

  describe("Logout", () => {
    it("clears cookies and removes refresh token hash from user", async () => {
      const passwordHash = await hashPassword("Password123!");
      const user = new User({
        name: "Logout User",
        email: "logout@example.com",
        passwordHash,
        role: "user",
      });
      const refreshToken = generateRefreshToken(user._id.toString());
      user.refreshTokenHash = hashToken(refreshToken);
      await user.save();

      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [`refreshToken=${refreshToken}`]);

      expect(res.status).toBe(200);
      const cookies = (res.headers["set-cookie"] as unknown as string[]) || [];
      // Cookies should be cleared (expired in past or set to empty)
      expect(cookies.some((c) => c.includes("accessToken=;"))).toBe(true);
      expect(cookies.some((c) => c.includes("refreshToken=;"))).toBe(true);

      // User session should be invalidated in database
      const updatedUser = memoryUsers.get(user._id.toString());
      expect(updatedUser?.refreshTokenHash).toBeNull();
    });
  });

  describe("GET /auth/me", () => {
    it("returns authenticated user details when valid access token cookie is provided", async () => {
      const passwordHash = await hashPassword("Password123!");
      const user = new User({
        name: "Current User",
        email: "me@example.com",
        passwordHash,
        role: "user",
      });
      await user.save();

      const accessToken = generateAccessToken({
        sub: user._id.toString(),
        role: "user",
        email: user.email,
      });

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", [`accessToken=${accessToken}`]);

      expect(res.status).toBe(200);
      const body = res.body as { user: Record<string, unknown> };
      expect(body.user["name"]).toBe("Current User");
      expect(body.user["email"]).toBe("me@example.com");
      expect(body.user["passwordHash"]).toBeUndefined();
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
      const body = res.body as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Role Protection Middleware", () => {
    let regularUserToken: string;
    let adminUserToken: string;
    let roleApp: express.Express;

    beforeEach(async () => {
      roleApp = express();
      roleApp.use(cookieParser());
      roleApp.get("/admin-only", authenticate, requireRole("admin"), (_req, res) => {
        res.json({ secret: "admin-classified-data" });
      });
      roleApp.use(errorHandler);

      const regularUser = new User({
        name: "Regular User",
        email: "user@example.com",
        passwordHash: "hash",
        role: "user",
      });
      await regularUser.save();

      const adminUser = new User({
        name: "Admin User",
        email: "admin@example.com",
        passwordHash: "hash",
        role: "admin",
      });
      await adminUser.save();

      regularUserToken = generateAccessToken({
        sub: regularUser._id.toString(),
        role: "user",
        email: regularUser.email,
      });

      adminUserToken = generateAccessToken({
        sub: adminUser._id.toString(),
        role: "admin",
        email: adminUser.email,
      });
    });

    it("denies access with 403 Forbidden to regular users on admin-only route", async () => {
      const res = await request(roleApp)
        .get("/admin-only")
        .set("Authorization", `Bearer ${regularUserToken}`);

      expect(res.status).toBe(403);
      const body = res.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("permission");
    });

    it("allows access with 200 OK to admin users on admin-only route", async () => {
      const res = await request(roleApp)
        .get("/admin-only")
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(res.status).toBe(200);
      const body = res.body as { secret: string };
      expect(body.secret).toBe("admin-classified-data");
    });

    it("denies unauthenticated requests with 401 Unauthorized", async () => {
      const res = await request(roleApp).get("/admin-only");
      expect(res.status).toBe(401);
      const body = res.body as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
