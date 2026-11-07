import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";

// Mock the Stripe client
const mockCreateSession = vi.fn();
const mockExpireSession = vi.fn();
const mockConstructEvent = vi.fn();
const mockCreateCoupon = vi.fn();

vi.mock("../lib/stripe.js", () => {
  return {
    getStripeClient: () => ({
      checkout: {
        sessions: {
          create: mockCreateSession,
          expire: mockExpireSession,
        },
      },
      coupons: {
        create: mockCreateCoupon,
      },
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    }),
  };
});

import { User, IUser, IAddress } from "../models/User.js";
import { Product } from "../models/Product.js";
import { Coupon } from "../models/Coupon.js";
import { Order, IOrder } from "../models/Order.js";
import { AuditLog } from "../models/AuditLog.js";
import { generateAccessToken } from "../lib/token.js";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["STRIPE_SECRET_KEY"] = "sk_test_mock_stripe_key";
process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_mock_webhook_secret";
process.env["SHIPPING_FLAT"] = "50";
process.env["FREE_SHIPPING_THRESHOLD"] = "500";
process.env["TAX_PERCENT"] = "18";
process.env["VITEST"] = "true";

import { env } from "../env.js";
env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock_webhook_secret";
env.STRIPE_SECRET_KEY = "sk_test_mock_stripe_key";

const { app } = await import("../index.js");

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface OrdersResponseBody {
  orders: IOrder[];
  total: number;
  page: number;
  totalPages: number;
}

interface SingleOrderResponseBody {
  order: IOrder;
}

interface CodCheckoutResponseBody {
  orderId: string;
}

describe("Phase 3 Part D: Orders & Order Management (Real MongoDB)", () => {
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
    vi.clearAllMocks();
    await Promise.all([
      Product.deleteMany({}),
      Coupon.deleteMany({}),
      Order.deleteMany({}),
      User.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
  });

  async function createTestUser(
    emailPrefix: string,
    role: "user" | "admin" = "user",
  ): Promise<{ user: IUser; addressId: string; token: string }> {
    const addressId = new Types.ObjectId();
    const sampleAddress: IAddress = {
      _id: addressId,
      label: "Home",
      name: "User Test",
      phone: "9876543210",
      line1: "123 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
    };

    const user = await User.create({
      name: `User ${emailPrefix}`,
      email: `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@yourstore.in`,
      passwordHash: "dummyHashForTesting123!",
      role,
      emailVerified: true,
      addresses: [sampleAddress],
      cart: [],
    });

    const token = generateAccessToken({ sub: user._id.toString(), role: user.role, email: user.email });
    return { user, addressId: addressId.toString(), token };
  }

  describe("1. POST /checkout/cod", () => {
    it("creates a Placed order with pending payment and clears the cart", async () => {
      const { user, addressId, token } = await createTestUser("cod_user");

      const product = await Product.create({
        title: "Mechanical Keyboard",
        slug: "mech-keyboard",
        description: "Hot swap switches",
        category: "gadgets",
        brand: "Keychron",
        basePrice: 4000,
        stock: 5,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      await User.updateOne(
        { _id: user._id },
        { $set: { cart: [{ productId: product._id, qty: 1 }] } },
      );

      const res = await request(app)
        .post("/api/v1/checkout/cod")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ addressId });

      expect(res.status).toBe(201);
      const body = res.body as CodCheckoutResponseBody;
      expect(body.orderId).toBeDefined();

      // Verify order properties
      const order = await Order.findById(body.orderId);
      expect(order).not.toBeNull();
      expect(order?.status).toBe("Placed");
      expect(order?.payment.method).toBe("cod");
      expect(order?.payment.status).toBe("pending");

      // Verify stock decremented
      const productAfter = await Product.findById(product._id);
      expect(productAfter?.stock).toBe(4);

      // Verify cart stayed cleared for COD
      const userAfter = await User.findById(user._id);
      expect(userAfter?.cart).toHaveLength(0);
    });
  });

  describe("2. GET /orders & GET /orders/:id (with IDOR checks)", () => {
    it("lists only the authenticated user's orders with pagination", async () => {
      const { user: userA, token: tokenA } = await createTestUser("user_a");
      const { user: userB } = await createTestUser("user_b");

      const product = await Product.create({
        title: "Product 1",
        slug: "prod-1",
        description: "Desc",
        category: "gadgets",
        brand: "Brand",
        basePrice: 1000,
        stock: 10,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      // Create 2 orders for User A and 1 order for User B
      await Order.create({
        user: userA._id,
        items: [{ productId: product._id, title: "Item 1", unitPrice: 1000, qty: 1 }],
        shippingAddress: { label: "Home", name: "User A", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 1000, shipping: 0, tax: 180, discount: 0, total: 1180 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        statusHistory: [],
      });

      await Order.create({
        user: userA._id,
        items: [{ productId: product._id, title: "Item 2", unitPrice: 1000, qty: 1 }],
        shippingAddress: { label: "Home", name: "User A", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 1000, shipping: 0, tax: 180, discount: 0, total: 1180 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        statusHistory: [],
      });

      await Order.create({
        user: userB._id,
        items: [{ productId: product._id, title: "Item 3", unitPrice: 1000, qty: 1 }],
        shippingAddress: { label: "Home", name: "User B", phone: "9876543210", line1: "B", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 1000, shipping: 0, tax: 180, discount: 0, total: 1180 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        statusHistory: [],
      });

      const res = await request(app)
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const body = res.body as OrdersResponseBody;
      expect(body.orders).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.page).toBe(1);
      expect(body.totalPages).toBe(1);
    });

    it("prevents IDOR: User B cannot read User A's order (returns 404)", async () => {
      const { user: userA } = await createTestUser("user_a_idor");
      const { token: tokenB } = await createTestUser("user_b_idor");

      const product = await Product.create({
        title: "Headphones",
        slug: "headphones",
        description: "Desc",
        category: "gadgets",
        brand: "Brand",
        basePrice: 2000,
        stock: 5,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const orderA = await Order.create({
        user: userA._id,
        items: [{ productId: product._id, title: "Headphones", unitPrice: 2000, qty: 1 }],
        shippingAddress: { label: "Home", name: "User A", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 2000, shipping: 0, tax: 360, discount: 0, total: 2360 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        statusHistory: [],
      });

      // User B attempts to read User A's order
      const res = await request(app)
        .get(`/api/v1/orders/${orderA._id.toString()}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("Order not found");
    });
  });

  describe("3. POST /orders/:id/cancel", () => {
    it("prevents IDOR: User B cannot cancel User A's order (returns 404)", async () => {
      const { user: userA } = await createTestUser("user_a_cancel");
      const { token: tokenB } = await createTestUser("user_b_cancel");

      const product = await Product.create({
        title: "Desk Lamp",
        slug: "desk-lamp",
        description: "LED lamp",
        category: "home",
        brand: "Philips",
        basePrice: 1500,
        stock: 5,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const orderA = await Order.create({
        user: userA._id,
        items: [{ productId: product._id, title: "Desk Lamp", unitPrice: 1500, qty: 1 }],
        shippingAddress: { label: "Home", name: "User A", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 1500, shipping: 0, tax: 270, discount: 0, total: 1770 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        statusHistory: [],
      });

      const res = await request(app)
        .post(`/api/v1/orders/${orderA._id.toString()}/cancel`)
        .set("Authorization", `Bearer ${tokenB}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(404);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("Order not found");
    });

    it("rejects cancellation if order status is Dispatched or later (returns 400)", async () => {
      const { user, token } = await createTestUser("user_dispatched");

      const product = await Product.create({
        title: "Chair",
        slug: "chair",
        description: "Office chair",
        category: "home",
        brand: "Featherlite",
        basePrice: 8000,
        stock: 3,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Chair", unitPrice: 8000, qty: 1 }],
        shippingAddress: { label: "Home", name: "User", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 8000, shipping: 0, tax: 1440, discount: 0, total: 9440 },
        payment: { method: "cod", status: "pending" },
        status: "Dispatched",
        statusHistory: [],
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/cancel`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain('Cannot cancel order in "Dispatched" status');
    });

    it("restores stock and coupon exactly once, and a second cancel attempt does not double-restore", async () => {
      const { user, token } = await createTestUser("user_cancel_once");

      const product = await Product.create({
        title: "Smart Watch",
        slug: "smart-watch",
        description: "Fitness tracker",
        category: "gadgets",
        brand: "Noise",
        basePrice: 3000,
        stock: 3, // stock was decremented from 5 to 3
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const coupon = await Coupon.create({
        code: "WATCH500",
        type: "fixed",
        value: 500,
        minOrder: 2000,
        expiresAt: new Date(Date.now() + 86400000),
        usageLimit: 5,
        usedCount: 2, // usedCount was incremented from 1 to 2
        isActive: true,
      });

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Smart Watch", unitPrice: 3000, qty: 2 }],
        shippingAddress: { label: "Home", name: "User", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 6000, shipping: 0, tax: 990, discount: 500, total: 6490 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        couponCode: "WATCH500",
        statusHistory: [],
      });

      // 1. First cancel attempt
      const res1 = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/cancel`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res1.status).toBe(200);

      const orderAfter1 = await Order.findById(order._id);
      expect(orderAfter1?.status).toBe("Cancelled");

      // Verify stock restored (3 + 2 = 5)
      const productAfter1 = await Product.findById(product._id);
      expect(productAfter1?.stock).toBe(5);

      // Verify coupon decremented (2 - 1 = 1)
      const couponAfter1 = await Coupon.findById(coupon._id);
      expect(couponAfter1?.usedCount).toBe(1);

      // 2. Second cancel attempt
      const res2 = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/cancel`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res2.status).toBe(400);

      // Stock must still be 5 (not 7)
      const productAfter2 = await Product.findById(product._id);
      expect(productAfter2?.stock).toBe(5);

      // Coupon usedCount must still be 1 (not 0)
      const couponAfter2 = await Coupon.findById(coupon._id);
      expect(couponAfter2?.usedCount).toBe(1);
    });

    it("cancelling a PendingPayment stripe order expires the Stripe session and restores user cart", async () => {
      const { user, token } = await createTestUser("user_cancel_stripe");

      const product = await Product.create({
        title: "Earbuds",
        slug: "earbuds",
        description: "TWS",
        category: "gadgets",
        brand: "Boat",
        basePrice: 1500,
        stock: 5,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Earbuds", unitPrice: 1500, qty: 1 }],
        shippingAddress: { label: "Home", name: "User", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 1500, shipping: 0, tax: 270, discount: 0, total: 1770 },
        payment: { method: "stripe", status: "pending", stripeSessionId: "cs_cancel_test_999" },
        status: "PendingPayment",
        statusHistory: [],
      });

      mockExpireSession.mockResolvedValue({ id: "cs_cancel_test_999", status: "expired" });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/cancel`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(200);

      // Verify mockExpireSession was called with sessionId
      expect(mockExpireSession).toHaveBeenCalledWith("cs_cancel_test_999");

      // Verify user's cart restored
      const userAfter = await User.findById(user._id);
      expect(userAfter?.cart).toHaveLength(1);
      expect(userAfter?.cart[0]?.productId.toString()).toBe(product._id.toString());
    });
  });

  describe("4. Admin Orders Endpoints", () => {
    it("non-admin user gets 403 Forbidden when calling admin endpoints", async () => {
      const { token: userToken } = await createTestUser("non_admin", "user");

      const listRes = await request(app)
        .get("/api/v1/admin/orders")
        .set("Authorization", `Bearer ${userToken}`);
      expect(listRes.status).toBe(403);

      const fakeId = new Types.ObjectId().toString();
      const patchRes = await request(app)
        .patch(`/api/v1/admin/orders/${fakeId}/status`)
        .set("Authorization", `Bearer ${userToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "Processing" });
      expect(patchRes.status).toBe(403);
    });

    it("rejects invalid status transitions (e.g. Placed -> Delivered skipping steps)", async () => {
      const { token: adminToken } = await createTestUser("admin_user", "admin");
      const { user } = await createTestUser("customer_user");

      const product = await Product.create({
        title: "Test Item",
        slug: "test-item",
        description: "Desc",
        category: "gadgets",
        brand: "Brand",
        basePrice: 1000,
        stock: 5,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Test Item", unitPrice: 1000, qty: 1 }],
        shippingAddress: { label: "Home", name: "User", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 1000, shipping: 0, tax: 180, discount: 0, total: 1180 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        statusHistory: [],
      });

      // Attempt to jump directly from Placed to Delivered
      const res = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "Delivered" });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("Invalid status transition");
    });

    it("executes forward transitions sequentially and marks COD order paid upon delivery with AuditLog", async () => {
      const { user: admin, token: adminToken } = await createTestUser("admin_seq", "admin");
      const { user } = await createTestUser("customer_seq");

      const product = await Product.create({
        title: "Laptop Stand",
        slug: "laptop-stand",
        description: "Aluminum stand",
        category: "gadgets",
        brand: "Portronics",
        basePrice: 1200,
        stock: 10,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Laptop Stand", unitPrice: 1200, qty: 1 }],
        shippingAddress: { label: "Home", name: "User", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 1200, shipping: 0, tax: 216, discount: 0, total: 1416 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        statusHistory: [],
      });

      const orderIdStr = order._id.toString();

      // 1. Placed -> Processing
      const res1 = await request(app)
        .patch(`/api/v1/admin/orders/${orderIdStr}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "Processing" });
      expect(res1.status).toBe(200);
      expect((res1.body as SingleOrderResponseBody).order.status).toBe("Processing");

      // 2. Processing -> Dispatched
      const res2 = await request(app)
        .patch(`/api/v1/admin/orders/${orderIdStr}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "Dispatched" });
      expect(res2.status).toBe(200);
      expect((res2.body as SingleOrderResponseBody).order.status).toBe("Dispatched");

      // 3. Dispatched -> OutForDelivery
      const res3 = await request(app)
        .patch(`/api/v1/admin/orders/${orderIdStr}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "OutForDelivery" });
      expect(res3.status).toBe(200);
      expect((res3.body as SingleOrderResponseBody).order.status).toBe("OutForDelivery");

      // 4. OutForDelivery -> Delivered
      const res4 = await request(app)
        .patch(`/api/v1/admin/orders/${orderIdStr}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "Delivered" });
      expect(res4.status).toBe(200);

      // Verify COD payment marked as paid upon delivery
      const deliveredOrder = (res4.body as SingleOrderResponseBody).order;
      expect(deliveredOrder.status).toBe("Delivered");
      expect(deliveredOrder.payment.status).toBe("paid");

      // Verify AuditLog entries created
      const auditEntries = await AuditLog.find({ targetId: orderIdStr });
      expect(auditEntries.length).toBe(4);
      expect(auditEntries[0]?.action).toBe("order.status_update");
      expect(auditEntries[0]?.actor).toBe(admin._id.toString());
    });

    it("admin can list orders and filter by status and email", async () => {
      const { token: adminToken } = await createTestUser("admin_filter", "admin");
      const { user: user1 } = await createTestUser("user1_filter");
      const { user: user2 } = await createTestUser("user2_filter");

      const product = await Product.create({
        title: "Pen",
        slug: "pen",
        description: "Ballpoint",
        category: "home",
        brand: "Reynolds",
        basePrice: 50,
        stock: 100,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      await Order.create({
        user: user1._id,
        items: [{ productId: product._id, title: "Pen", unitPrice: 50, qty: 1 }],
        shippingAddress: { label: "Home", name: "User 1", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 50, shipping: 50, tax: 18, discount: 0, total: 118 },
        payment: { method: "cod", status: "pending" },
        status: "Placed",
        statusHistory: [],
      });

      await Order.create({
        user: user2._id,
        items: [{ productId: product._id, title: "Pen", unitPrice: 50, qty: 2 }],
        shippingAddress: { label: "Home", name: "User 2", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
        pricing: { subtotal: 100, shipping: 50, tax: 27, discount: 0, total: 177 },
        payment: { method: "cod", status: "pending" },
        status: "Processing",
        statusHistory: [],
      });

      // Filter by status=Placed
      const statusRes = await request(app)
        .get("/api/v1/admin/orders?status=Placed")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(statusRes.status).toBe(200);
      const statusBody = statusRes.body as OrdersResponseBody;
      expect(statusBody.orders).toHaveLength(1);
      expect(statusBody.orders[0]?.status).toBe("Placed");

      // Filter by email=user2.email
      const emailRes = await request(app)
        .get(`/api/v1/admin/orders?email=${encodeURIComponent(user2.email)}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(emailRes.status).toBe(200);
      const emailBody = emailRes.body as OrdersResponseBody;
      expect(emailBody.orders).toHaveLength(1);
      expect(emailBody.orders[0]?.status).toBe("Processing");
    });
  });
});
