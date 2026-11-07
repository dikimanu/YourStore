import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";

import { User } from "../models/User.js";
import { Coupon } from "../models/Coupon.js";
import { AuditLog } from "../models/AuditLog.js";
import { generateAccessToken } from "../lib/token.js";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

interface CouponBody {
  _id: string;
  id?: string;
  code: string;
  type: string;
  value: number;
  minOrder: number;
  isActive: boolean;
  usedCount: number;
  usageLimit?: number | null;
}

interface CouponResponse {
  coupon: CouponBody;
}

interface CouponListResponse {
  coupons: CouponBody[];
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

describe("Admin Coupons API (/api/v1/admin/coupons)", () => {
  beforeAll(async () => {
    const mongoUriTest = process.env["MONGO_URI_TEST"];
    if (!mongoUriTest) {
      throw new Error("Missing required environment variable MONGO_URI_TEST for test execution.");
    }

    const cleanUri = mongoUriTest.split("?")[0] || "";
    const dbName = cleanUri.substring(cleanUri.lastIndexOf("/") + 1);

    if (!dbName.endsWith("_test")) {
      throw new Error(
        `Safety check failed: database name "${dbName}" in MONGO_URI_TEST must end with "_test".`,
      );
    }

    await mongoose.connect(mongoUriTest);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await Promise.all([
      Coupon.deleteMany({}),
      User.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
  });

  async function createTestUser(role: "user" | "admin" = "user") {
    const user = await User.create({
      name: role === "admin" ? "Admin User" : "Normal User",
      email: `${role}-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "dummy_hash_value_12345",
      role,
      emailVerified: true,
    });
    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    });
    return { user, token };
  }

  it("rejects guests with 401 on admin coupon routes", async () => {
    const fakeId = new Types.ObjectId().toString();

    const getRes = await request(app).get("/api/v1/admin/coupons");
    expect(getRes.status).toBe(401);

    const postRes = await request(app)
      .post("/api/v1/admin/coupons")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        code: "GUEST10",
        type: "percent",
        value: 10,
      });
    expect(postRes.status).toBe(401);

    const patchRes = await request(app)
      .patch(`/api/v1/admin/coupons/${fakeId}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ value: 15 });
    expect(patchRes.status).toBe(401);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/coupons/${fakeId}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(deleteRes.status).toBe(401);
  });

  it("rejects non-admin users with 403 on all admin coupon routes", async () => {
    const { token } = await createTestUser("user");
    const fakeId = new Types.ObjectId().toString();

    const getRes = await request(app)
      .get("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(403);

    const postRes = await request(app)
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        code: "USER10",
        type: "percent",
        value: 10,
      });
    expect(postRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/v1/admin/coupons/${fakeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ value: 15 });
    expect(patchRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/coupons/${fakeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(deleteRes.status).toBe(403);
  });

  it("allows admin to create a coupon and writes AuditLog entry", async () => {
    const { user: admin, token } = await createTestUser("admin");

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const res = await request(app)
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        code: "SAVE20",
        type: "percent",
        value: 20,
        minOrder: 500,
        expiresAt: futureDate,
        usageLimit: 50,
      });

    expect(res.status).toBe(201);
    const body = res.body as CouponResponse;
    expect(body.coupon).toBeDefined();
    expect(body.coupon.code).toBe("SAVE20");
    expect(body.coupon.value).toBe(20);
    expect(body.coupon.minOrder).toBe(500);

    // Verify AuditLog written
    const audit = await AuditLog.findOne({
      action: "coupon.create",
      targetType: "Coupon",
      targetId: body.coupon.id ?? body.coupon._id,
    });
    expect(audit).not.toBeNull();
    expect(audit?.actor.toString()).toBe(admin._id.toString());
  });

  it("returns 409 Conflict when creating a duplicate coupon code", async () => {
    const { token } = await createTestUser("admin");

    await Coupon.create({
      code: "DUP2026",
      type: "fixed",
      value: 100,
      minOrder: 0,
      isActive: true,
      usedCount: 0,
    });

    const res = await request(app)
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        code: "dup2026", // should be uppercase and conflict
        type: "fixed",
        value: 150,
      });

    expect(res.status).toBe(409);
    const body = res.body as ErrorBody;
    expect(body.error.message).toMatch(/already exists/i);
  });

  it("rejects percentage value greater than 100", async () => {
    const { token } = await createTestUser("admin");

    const res = await request(app)
      .post("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        code: "OVER100",
        type: "percent",
        value: 105,
      });

    expect(res.status).toBe(400);
  });

  it("allows admin to update coupon, rejects setting usageLimit below usedCount, and writes AuditLog", async () => {
    const { user: admin, token } = await createTestUser("admin");

    const coupon = await Coupon.create({
      code: "PROMO50",
      type: "fixed",
      value: 50,
      minOrder: 200,
      usageLimit: 10,
      usedCount: 5,
      isActive: true,
    });

    // Attempting to set usageLimit to 3 (below usedCount 5) should fail with 400
    const failRes = await request(app)
      .patch(`/api/v1/admin/coupons/${coupon.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        usageLimit: 3,
      });

    expect(failRes.status).toBe(400);
    const failBody = failRes.body as ErrorBody;
    expect(failBody.error.message).toMatch(/cannot be less than.*used count/i);

    // Setting valid usageLimit and value
    const updateRes = await request(app)
      .patch(`/api/v1/admin/coupons/${coupon.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        usageLimit: 20,
        value: 75,
      });

    expect(updateRes.status).toBe(200);
    const updateBody = updateRes.body as CouponResponse;
    expect(updateBody.coupon.usageLimit).toBe(20);
    expect(updateBody.coupon.value).toBe(75);

    // Verify AuditLog written
    const audit = await AuditLog.findOne({
      action: "coupon.update",
      targetType: "Coupon",
      targetId: coupon._id.toString(),
    });
    expect(audit).not.toBeNull();
    expect(audit?.actor.toString()).toBe(admin._id.toString());
  });

  it("performs soft delete on coupon (isActive = false, document remains) and writes AuditLog", async () => {
    const { user: admin, token } = await createTestUser("admin");

    const coupon = await Coupon.create({
      code: "DELETEME",
      type: "fixed",
      value: 100,
      isActive: true,
      usedCount: 2,
    });

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/coupons/${coupon.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(deleteRes.status).toBe(200);
    const deleteBody = deleteRes.body as CouponResponse;
    expect(deleteBody.coupon.isActive).toBe(false);

    // Verify document still exists in MongoDB
    const persisted = await Coupon.findById(coupon.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.isActive).toBe(false);

    // Verify AuditLog written
    const audit = await AuditLog.findOne({
      action: "coupon.delete",
      targetType: "Coupon",
      targetId: coupon._id.toString(),
    });
    expect(audit).not.toBeNull();
    expect(audit?.actor.toString()).toBe(admin._id.toString());
  });

  it("lists coupons with search and filter", async () => {
    const { token } = await createTestUser("admin");

    await Coupon.create([
      { code: "ALPHA1", type: "percent", value: 10, isActive: true },
      { code: "ALPHA2", type: "percent", value: 20, isActive: false },
      { code: "BETA1", type: "fixed", value: 50, isActive: true },
    ]);

    const resAll = await request(app)
      .get("/api/v1/admin/coupons")
      .set("Authorization", `Bearer ${token}`);
    expect(resAll.status).toBe(200);
    expect((resAll.body as CouponListResponse).coupons.length).toBe(3);

    const resSearch = await request(app)
      .get("/api/v1/admin/coupons?search=alpha")
      .set("Authorization", `Bearer ${token}`);
    expect(resSearch.status).toBe(200);
    expect((resSearch.body as CouponListResponse).coupons.length).toBe(2);

    const resInactive = await request(app)
      .get("/api/v1/admin/coupons?status=inactive")
      .set("Authorization", `Bearer ${token}`);
    expect(resInactive.status).toBe(200);
    const inactiveBody = resInactive.body as CouponListResponse;
    expect(inactiveBody.coupons.length).toBe(1);
    expect(inactiveBody.coupons[0]?.code).toBe("ALPHA2");
  });
});