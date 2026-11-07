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
import { generateAccessToken } from "../lib/token.js";
import { AdminStatsResponse } from "@yourstore/shared";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

describe("Admin Stats API (/api/v1/admin/stats)", () => {
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
    ]);
  });

  async function createUsers() {
    const adminUser = await User.create({
      name: "Admin User",
      email: "admin@test.com",
      passwordHash: "dummyhash",
      role: "admin",
      emailVerified: true,
    });
    adminId = adminUser._id.toString();
    adminToken = generateAccessToken({ sub: adminId, role: "admin", email: "admin@test.com" });

    const regularUser = await User.create({
      name: "Normal User",
      email: "user@test.com",
      passwordHash: "dummyhash",
      role: "user",
      emailVerified: true,
    });
    userId = regularUser._id.toString();
    userToken = generateAccessToken({ sub: userId, role: "user", email: "user@test.com" });
  }

  it("guest gets 401", async () => {
    const res = await request(app).get("/api/v1/admin/stats");
    expect(res.status).toBe(401);
  });

  it("normal user gets 403", async () => {
    await createUsers();
    const res = await request(app)
      .get("/api/v1/admin/stats")
      .set("Cookie", [`accessToken=${userToken}`]);
    expect(res.status).toBe(403);
  });

  it("invalid days value returns 400", async () => {
    await createUsers();
    const res = await request(app)
      .get("/api/v1/admin/stats?days=14")
      .set("Cookie", [`accessToken=${adminToken}`]);
    expect(res.status).toBe(400);
  });

  it("admin gets 200 with the expected shape and zero-filled days (default 30 days)", async () => {
    await createUsers();
    const res = await request(app)
      .get("/api/v1/admin/stats")
      .set("Cookie", [`accessToken=${adminToken}`]);

    expect(res.status).toBe(200);
    const body = res.body as AdminStatsResponse;
    expect(body).toHaveProperty("salesByDay");
    expect(body).toHaveProperty("orderCounts");
    expect(body).toHaveProperty("totals");
    expect(body).toHaveProperty("topProducts");
    expect(body).toHaveProperty("lowStock");

    expect(Array.isArray(body.salesByDay)).toBe(true);
    expect(body.salesByDay).toHaveLength(30);

    const first = body.salesByDay[0];
    if (first) {
      expect(first).toHaveProperty("date");
      expect(first).toHaveProperty("revenue", 0);
      expect(first).toHaveProperty("orders", 0);
    }
  });

  it("revenue excludes Cancelled, PendingPayment, ReturnRequested, Returned, Refunded orders", async () => {
    await createUsers();

    const dummyAddress = {
      label: "Home",
      name: "John Doe",
      phone: "9876543210",
      line1: "123 Main St",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
    };

    const dummyProdId = new Types.ObjectId();

    // 1 Placed order with total 1000
    await Order.create({
      user: new Types.ObjectId(userId),
      items: [{
        productId: dummyProdId,
        title: "Item 1",
        unitPrice: 500,
        qty: 2,
      }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 1000, shipping: 0, tax: 0, discount: 0, total: 1000 },
      payment: { method: "cod", status: "pending" },
      status: "Placed",
      createdAt: new Date(),
    });

    // 1 Delivered order with total 500
    await Order.create({
      user: new Types.ObjectId(userId),
      items: [{
        productId: dummyProdId,
        title: "Item 1",
        unitPrice: 500,
        qty: 1,
      }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 500, shipping: 0, tax: 0, discount: 0, total: 500 },
      payment: { method: "stripe", status: "paid" },
      status: "Delivered",
      createdAt: new Date(),
    });

    // 1 Cancelled order with total 2000 (should be excluded from revenue)
    await Order.create({
      user: new Types.ObjectId(userId),
      items: [{
        productId: dummyProdId,
        title: "Item 1",
        unitPrice: 2000,
        qty: 1,
      }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 2000, shipping: 0, tax: 0, discount: 0, total: 2000 },
      payment: { method: "cod", status: "failed" },
      status: "Cancelled",
      createdAt: new Date(),
    });

    // 1 PendingPayment order with total 3000 (should be excluded from revenue)
    await Order.create({
      user: new Types.ObjectId(userId),
      items: [{
        productId: dummyProdId,
        title: "Item 1",
        unitPrice: 3000,
        qty: 1,
      }],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 3000, shipping: 0, tax: 0, discount: 0, total: 3000 },
      payment: { method: "stripe", status: "pending" },
      status: "PendingPayment",
      createdAt: new Date(),
    });

    const res = await request(app)
      .get("/api/v1/admin/stats?days=7")
      .set("Cookie", [`accessToken=${adminToken}`]);

    expect(res.status).toBe(200);
    const body = res.body as AdminStatsResponse;
    expect(body.totals.revenue).toBe(1500);
    expect(body.totals.orders).toBe(2);
    expect(body.totals.averageOrderValue).toBe(750);
    expect(body.orderCounts["Placed"]).toBe(1);
    expect(body.orderCounts["Delivered"]).toBe(1);
    expect(body.orderCounts["Cancelled"]).toBe(1);
    expect(body.orderCounts["PendingPayment"]).toBe(1);
  });

  it("topProducts sorted by units sold descending", async () => {
    await createUsers();

    const dummyAddress = {
      label: "Home",
      name: "John",
      phone: "9876543210",
      line1: "123 Main St",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
    };

    const prod1 = new Types.ObjectId();
    const prod2 = new Types.ObjectId();

    await Order.create({
      user: new Types.ObjectId(userId),
      items: [
        { productId: prod1, title: "Product One", unitPrice: 100, qty: 3 },
        { productId: prod2, title: "Product Two", unitPrice: 200, qty: 8 },
      ],
      shippingAddress: dummyAddress,
      pricing: { subtotal: 1900, shipping: 0, tax: 0, discount: 0, total: 1900 },
      payment: { method: "cod", status: "pending" },
      status: "Placed",
      createdAt: new Date(),
    });

    const res = await request(app)
      .get("/api/v1/admin/stats?days=7")
      .set("Cookie", [`accessToken=${adminToken}`]);

    expect(res.status).toBe(200);
    const body = res.body as AdminStatsResponse;
    expect(body.topProducts).toHaveLength(2);
    const topFirst = body.topProducts[0];
    const topSecond = body.topProducts[1];
    expect(topFirst?.productId).toBe(prod2.toString());
    expect(topFirst?.units).toBe(8);
    expect(topFirst?.revenue).toBe(1600);
    expect(topSecond?.productId).toBe(prod1.toString());
    expect(topSecond?.units).toBe(3);
    expect(topSecond?.revenue).toBe(300);
  });

  it("lowStock includes variant low stock and excludes inactive and enquiry products", async () => {
    await createUsers();

    // 1. Purchasable active product without variants, stock 3 (included)
    const p1 = await Product.create({
      title: "Simple Low Stock",
      slug: "simple-low-stock",
      description: "Desc",
      category: "electronics",
      brand: "Brand",
      basePrice: 500,
      stock: 3,
      listingType: "purchasable",
      isActive: true,
    });

    // 2. Purchasable active product with variants: one variant has stock 2 (included), another stock 10 (not low stock)
    const p2 = await Product.create({
      title: "Variant Low Stock Product",
      slug: "variant-low-stock-product",
      description: "Desc",
      category: "clothing",
      brand: "Brand",
      basePrice: 800,
      variants: [
        { sku: "VAR-RED-S", options: { size: "S", color: "Red" }, stock: 2 },
        { sku: "VAR-RED-M", options: { size: "M", color: "Red" }, stock: 10 },
      ],
      listingType: "purchasable",
      isActive: true,
    });

    // 3. Inactive product with stock 1 (excluded because isActive = false)
    await Product.create({
      title: "Inactive Product",
      slug: "inactive-product",
      description: "Desc",
      category: "gadgets",
      brand: "Brand",
      basePrice: 200,
      stock: 1,
      listingType: "purchasable",
      isActive: false,
    });

    // 4. Enquiry product with stock 2 (excluded because listingType = enquiry)
    await Product.create({
      title: "Enquiry Vehicle",
      slug: "enquiry-vehicle",
      description: "Desc",
      category: "vehicles",
      brand: "Brand",
      basePrice: 500000,
      stock: 2,
      listingType: "enquiry",
      isActive: true,
    });

    // 5. In-stock product with stock 20 (excluded because stock > 5)
    await Product.create({
      title: "High Stock Product",
      slug: "high-stock-product",
      description: "Desc",
      category: "home",
      brand: "Brand",
      basePrice: 1200,
      stock: 20,
      listingType: "purchasable",
      isActive: true,
    });

    const res = await request(app)
      .get("/api/v1/admin/stats?days=30")
      .set("Cookie", [`accessToken=${adminToken}`]);

    expect(res.status).toBe(200);
    const body = res.body as AdminStatsResponse;
    expect(body.lowStock).toHaveLength(2);

    // Sorted by lowest stock: stock 2 comes before stock 3
    const low0 = body.lowStock[0];
    const low1 = body.lowStock[1];
    expect(low0?.productId).toBe(p2._id.toString());
    expect(low0?.sku).toBe("VAR-RED-S");
    expect(low0?.stock).toBe(2);

    expect(low1?.productId).toBe(p1._id.toString());
    expect(low1?.stock).toBe(3);
    expect(low1?.sku).toBeUndefined();
  });
});
