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
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { AuditLog } from "../models/AuditLog.js";
import { generateAccessToken } from "../lib/token.js";
import {
  AdminCustomersResponse,
  AdminAuditLogsResponse,
  AdminOrdersResponse,
} from "@yourstore/shared";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

describe("Admin Lists API (Customers, Enquiries, AuditLogs, Orders)", () => {
  let adminId: string;
  let adminToken: string;
  let userId: string;
  let userToken: string;

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
      User.deleteMany({}),
      Order.deleteMany({}),
      Product.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
  });

  async function createUsers() {
    const adminUser = await User.create({
      name: "Admin User",
      email: "admin@test.com",
      passwordHash: "dummyhash_admin",
      refreshTokenHash: "tokenhash_admin",
      role: "admin",
      emailVerified: true,
    });
    adminId = adminUser._id.toString();
    adminToken = generateAccessToken({ sub: adminId, role: "admin", email: "admin@test.com" });

    const regularUser = await User.create({
      name: "John Customer",
      email: "john@test.com",
      passwordHash: "dummyhash_user",
      refreshTokenHash: "tokenhash_user",
      role: "user",
      emailVerified: true,
    });
    userId = regularUser._id.toString();
    userToken = generateAccessToken({ sub: userId, role: "user", email: "john@test.com" });
  }

  // 1. Auth guarding
  it("guest gets 401 on every new route", async () => {
    const res1 = await request(app).get("/api/v1/admin/customers");
    expect(res1.status).toBe(401);

    const res3 = await request(app).get("/api/v1/admin/audit-logs");
    expect(res3.status).toBe(401);
  });

  it("normal user gets 403 on every new route", async () => {
    await createUsers();
    const headers = { Cookie: `accessToken=${userToken}` };

    const res1 = await request(app).get("/api/v1/admin/customers").set(headers);
    expect(res1.status).toBe(403);

    const res3 = await request(app).get("/api/v1/admin/audit-logs").set(headers);
    expect(res3.status).toBe(403);
  });

  it("invalid query returns 400", async () => {
    await createUsers();
    const headers = { Cookie: `accessToken=${adminToken}` };

    // invalid limit > 100
    const res1 = await request(app).get("/api/v1/admin/customers?limit=150").set(headers);
    expect(res1.status).toBe(400);

    // invalid order paymentMethod
    const res3 = await request(app).get("/api/v1/admin/orders?paymentMethod=paypal").set(headers);
    expect(res3.status).toBe(400);
  });

  it("regex special characters in search do not crash", async () => {
    await createUsers();
    const headers = { Cookie: `accessToken=${adminToken}` };

    const specialQuery = ".*+?^${}()|[]\\";
    const res1 = await request(app).get(`/api/v1/admin/customers?search=${encodeURIComponent(specialQuery)}`).set(headers);
    expect(res1.status).toBe(200);

    const res3 = await request(app).get(`/api/v1/admin/orders?search=${encodeURIComponent(specialQuery)}`).set(headers);
    expect(res3.status).toBe(200);
  });

  // 2. Customers list
  it("customers list never exposes passwordHash, refreshTokenHash, tokens or lock fields", async () => {
    await createUsers();
    const headers = { Cookie: `accessToken=${adminToken}` };

    const res = await request(app).get("/api/v1/admin/customers").set(headers);
    expect(res.status).toBe(200);
    const body = res.body as AdminCustomersResponse;
    expect(body.customers.length).toBeGreaterThan(0);

    for (const c of body.customers) {
      expect((c as Record<string, unknown>)["passwordHash"]).toBeUndefined();
      expect((c as Record<string, unknown>)["refreshTokenHash"]).toBeUndefined();
      expect((c as Record<string, unknown>)["lockUntil"]).toBeUndefined();
      expect((c as Record<string, unknown>)["failedLoginCount"]).toBeUndefined();
      expect((c as Record<string, unknown>)["emailVerificationTokenHash"]).toBeUndefined();
      expect((c as Record<string, unknown>)["resetPasswordTokenHash"]).toBeUndefined();
    }
  });

  it("orderCount and totalSpent are correct and exclude Cancelled and Pending orders", async () => {
    await createUsers();
    const headers = { Cookie: `accessToken=${adminToken}` };

    const dummyAddress = {
      label: "Home",
      name: "John Customer",
      phone: "9876543210",
      line1: "123 Main St",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
    };
    const prodId = new Types.ObjectId();

    // 1 Placed order for ₹1500 (included)
    await Order.create({
      user: new Types.ObjectId(userId),
      items: [{ productId: prodId, title: "Item 1", unitPrice: 1500, qty: 1 }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 1500, shipping: 0, tax: 0, discount: 0, total: 1500 },
      payment: { method: "cod", status: "pending" },
      status: "Placed",
    });

    // 1 Delivered order for ₹500 (included)
    await Order.create({
      user: new Types.ObjectId(userId),
      items: [{ productId: prodId, title: "Item 1", unitPrice: 500, qty: 1 }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 500, shipping: 0, tax: 0, discount: 0, total: 500 },
      payment: { method: "stripe", status: "paid" },
      status: "Delivered",
    });

    // 1 Cancelled order for ₹2000 (excluded)
    await Order.create({
      user: new Types.ObjectId(userId),
      items: [{ productId: prodId, title: "Item 1", unitPrice: 2000, qty: 1 }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 2000, shipping: 0, tax: 0, discount: 0, total: 2000 },
      payment: { method: "stripe", status: "refunded" },
      status: "Cancelled",
    });

    // 1 PendingPayment order for ₹3000 (excluded)
    await Order.create({
      user: new Types.ObjectId(userId),
      items: [{ productId: prodId, title: "Item 1", unitPrice: 3000, qty: 1 }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 3000, shipping: 0, tax: 0, discount: 0, total: 3000 },
      payment: { method: "stripe", status: "pending" },
      status: "PendingPayment",
    });

    const res = await request(app).get(`/api/v1/admin/customers?search=john`).set(headers);
    expect(res.status).toBe(200);
    const body = res.body as AdminCustomersResponse;
    const target = body.customers.find((c) => c.id === userId);
    expect(target).toBeDefined();
    expect(target?.orderCount).toBe(2);
    expect(target?.totalSpent).toBe(2000);
  });

  // 4. AuditLog filter by action
  it("audit log filter by action", async () => {
    await createUsers();
    const headers = { Cookie: `accessToken=${adminToken}` };

    await AuditLog.create({
      actor: new Types.ObjectId(adminId),
      action: "product.create",
      targetType: "Product",
      targetId: "prod_1",
      at: new Date(),
    });

    await AuditLog.create({
      actor: new Types.ObjectId(adminId),
      action: "order.refund",
      targetType: "Order",
      targetId: "ord_1",
      at: new Date(),
    });

    const res = await request(app).get("/api/v1/admin/audit-logs?action=order.refund").set(headers);
    expect(res.status).toBe(200);
    const body = res.body as AdminAuditLogsResponse;
    expect(body.logs.length).toBe(1);
    expect(body.logs[0]?.action).toBe("order.refund");
  });

  // 5. Order filters: date range, paymentMethod, search
  it("order filters (date range, paymentMethod, search) return the right orders", async () => {
    await createUsers();
    const headers = { Cookie: `accessToken=${adminToken}` };

    const dummyAddress = {
      label: "Home",
      name: "Alice Smith",
      phone: "9876543210",
      line1: "123 Main St",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
    };
    const prodId = new Types.ObjectId();

    // Order 1: Stripe, 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const order1 = await Order.create({
      user: new Types.ObjectId(userId),
      items: [{ productId: prodId, title: "Item 1", unitPrice: 100, qty: 1 }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 100, shipping: 0, tax: 0, discount: 0, total: 100 },
      payment: { method: "stripe", status: "paid" },
      status: "Processing",
      createdAt: tenDaysAgo,
    });

    // Order 2: COD, today
    const order2 = await Order.create({
      user: new Types.ObjectId(userId),
      items: [{ productId: prodId, title: "Item 2", unitPrice: 200, qty: 1 }],
      shippingAddress: { ...dummyAddress, name: "Bob Jones" },
      pricing: { subtotal: 200, shipping: 0, tax: 0, discount: 0, total: 200 },
      payment: { method: "cod", status: "pending" },
      status: "Placed",
      createdAt: new Date(),
    });

    // Filter by paymentMethod = cod
    const resCod = await request(app).get("/api/v1/admin/orders?paymentMethod=cod").set(headers);
    expect(resCod.status).toBe(200);
    const bodyCod = resCod.body as AdminOrdersResponse;
    expect(bodyCod.orders.length).toBe(1);
    expect(bodyCod.orders[0]?.payment.method).toBe("cod");

    // Filter by search customer name "Alice"
    const resAlice = await request(app).get("/api/v1/admin/orders?search=Alice").set(headers);
    expect(resAlice.status).toBe(200);
    const bodyAlice = resAlice.body as AdminOrdersResponse;
    expect(bodyAlice.orders.length).toBe(1);
    expect(bodyAlice.orders[0]?.id || (bodyAlice.orders[0] as unknown as { _id: string })._id).toBe(order1._id.toString());

    // Filter by date range (last 5 days only)
    const fiveDaysAgoStr = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const resDate = await request(app).get(`/api/v1/admin/orders?from=${fiveDaysAgoStr}`).set(headers);
    expect(resDate.status).toBe(200);
    const bodyDate = resDate.body as AdminOrdersResponse;
    expect(bodyDate.orders.length).toBe(1);
    expect(bodyDate.orders[0]?.id || (bodyDate.orders[0] as unknown as { _id: string })._id).toBe(order2._id.toString());
  });
});
