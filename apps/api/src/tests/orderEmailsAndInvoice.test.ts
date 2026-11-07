import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Mock Stripe
vi.mock("../lib/stripe.js", () => {
  const mockStripe = {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "cs_mock_123", url: "https://stripe.com/pay" }),
        expire: vi.fn().mockResolvedValue({}),
      },
      coupons: {
        create: vi.fn().mockResolvedValue({ id: "coupon_mock_123" }),
      },
    },
    refunds: {
      create: vi.fn().mockResolvedValue({ id: "re_mock_123" }),
    },
  };
  return {
    getStripeClient: vi.fn(() => mockStripe),
  };
});

// Mock Resend/email module
vi.mock("../lib/email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/email.js")>();
  return {
    ...actual,
    sendEmail: vi.fn().mockResolvedValue(true),
    sendOrderStatusEmail: vi.fn().mockImplementation(actual.sendOrderStatusEmail),
  };
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";

import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { Order } from "../models/Order.js";
import { generateAccessToken } from "../lib/token.js";
import { sendOrderStatusEmail, sendEmail } from "../lib/email.js";
import { env } from "../env.js";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

const TEST_ADDRESS = {
  label: "Home",
  name: "John Doe",
  phone: "9876543210",
  line1: "123 Elm Street",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001",
};

const TEST_PRICING = {
  subtotal: 1500,
  shipping: 0,
  tax: 270,
  discount: 0,
  total: 1770,
};

describe("Phase 5 Part D: Order Emails & Invoice PDF", () => {
  beforeAll(async () => {
    const mongoUriTest = process.env["MONGO_URI_TEST"];
    if (!mongoUriTest) {
      throw new Error("Missing MONGO_URI_TEST");
    }
    await mongoose.connect(mongoUriTest);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
    ]);
  });

  async function createTestUser(role: "user" | "admin" = "user") {
    const user = await User.create({
      name: role === "admin" ? "Admin User" : "Test User",
      email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "dummyHash123",
      role,
      emailVerified: true,
      addresses: [
        {
          label: "Home",
          name: "Test Customer",
          phone: "9876543210",
          line1: "456 Market Road",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        },
      ],
      cart: [],
    });

    const token = generateAccessToken({ sub: user._id.toString(), role: user.role, email: user.email });
    return { user, token };
  }

  async function createPurchasableProduct(stock = 10, price = 1500) {
    return Product.create({
      title: "Smartphone Pro",
      slug: `smartphone-pro-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: "Latest smartphone",
      category: "gadgets",
      brand: "BrandX",
      basePrice: price,
      images: [],
      stock,
      listingType: "purchasable",
      isActive: true,
    });
  }

  // =========================================================================
  // 1. Order Status Emails
  // =========================================================================

  describe("1. Order Status Emails", () => {
    it("calls sendOrderStatusEmail on COD checkout order placement", async () => {
      // Ensure RESEND_API_KEY is defined in env for the test
      const originalKey = env.RESEND_API_KEY;
      env.RESEND_API_KEY = "re_test_key";

      const { user, token } = await createTestUser("user");
      const product = await createPurchasableProduct(10, 1500);

      // Put item in cart
      user.cart = [{ productId: product._id, qty: 1 }];
      await user.save();

      const addressId = user.addresses[0]!._id!.toString();

      const res = await request(app)
        .post("/api/v1/checkout/cod")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ addressId });

      expect(res.status).toBe(201);
      expect(sendOrderStatusEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "Placed",
        }),
        "placed",
      );

      env.RESEND_API_KEY = originalKey;
    });

    it("calls sendOrderStatusEmail on admin order status advancement (Dispatched and Delivered)", async () => {
      const originalKey = env.RESEND_API_KEY;
      env.RESEND_API_KEY = "re_test_key";

      const { user } = await createTestUser("user");
      const { token: adminToken } = await createTestUser("admin");
      const product = await createPurchasableProduct();

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Phone", unitPrice: 1500, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "cod", status: "pending" },
        status: "Processing",
        statusHistory: [{ status: "Processing", at: new Date(), by: "admin" }],
      });

      // Admin advances status to Dispatched
      const dispatchRes = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "Dispatched" });

      expect(dispatchRes.status).toBe(200);
      expect(sendOrderStatusEmail).toHaveBeenCalledWith(
        expect.objectContaining({ _id: order._id }),
        "dispatched",
      );

      // Admin advances status to OutForDelivery (required step before Delivered)
      const outRes = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "OutForDelivery" });
      expect(outRes.status).toBe(200);
      // Admin advances status to Delivered
      const deliverRes = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ status: "Delivered" });

      expect(deliverRes.status).toBe(200);
      expect(sendOrderStatusEmail).toHaveBeenCalledWith(
        expect.objectContaining({ _id: order._id }),
        "delivered",
      );

      env.RESEND_API_KEY = originalKey;
    });

    it("email failure does not fail the checkout or status request", async () => {
      const originalKey = env.RESEND_API_KEY;
      env.RESEND_API_KEY = "re_test_key";

      // Simulate failure in sendEmail
      vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Resend network timeout"));

      const { user, token } = await createTestUser("user");
      const product = await createPurchasableProduct(10, 1500);

      user.cart = [{ productId: product._id, qty: 1 }];
      await user.save();

      const addressId = user.addresses[0]!._id!.toString();

      const res = await request(app)
        .post("/api/v1/checkout/cod")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ addressId });

      // Request must succeed even when email throws an error
      expect(res.status).toBe(201);
      expect((res.body as { orderId?: string }).orderId).toBeDefined();

      env.RESEND_API_KEY = originalKey;
    });
  });

  // =========================================================================
  // 2. Invoice PDF Streaming
  // =========================================================================

  describe("2. Invoice PDF (GET /api/v1/orders/:id/invoice)", () => {
    it("returns 401 for unauthenticated guest", async () => {
      const fakeId = new Types.ObjectId().toString();
      const res = await request(app).get(`/api/v1/orders/${fakeId}/invoice`);
      expect(res.status).toBe(401);
    });

    it("returns 404 when user A attempts to access user B's order invoice", async () => {
      const { user: userA } = await createTestUser("user");
      const { token: tokenB } = await createTestUser("user");
      const product = await createPurchasableProduct();

      const order = await Order.create({
        user: userA._id,
        items: [{ productId: product._id, title: "Product A", unitPrice: 1500, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "cod", status: "paid" },
        status: "Placed",
        statusHistory: [{ status: "Placed", at: new Date(), by: "user" }],
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order._id.toString()}/invoice`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("blocks invoice download for PendingPayment and Cancelled orders", async () => {
      const { user, token } = await createTestUser("user");
      const product = await createPurchasableProduct();

      // PendingPayment
      const pendingOrder = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Product A", unitPrice: 1500, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "stripe", status: "pending" },
        status: "PendingPayment",
        statusHistory: [{ status: "PendingPayment", at: new Date(), by: "user" }],
      });

      const pendingRes = await request(app)
        .get(`/api/v1/orders/${pendingOrder._id.toString()}/invoice`)
        .set("Authorization", `Bearer ${token}`);

      expect(pendingRes.status).toBe(400);

      // Cancelled
      const cancelledOrder = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Product A", unitPrice: 1500, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "cod", status: "failed" },
        status: "Cancelled",
        statusHistory: [{ status: "Cancelled", at: new Date(), by: "user" }],
      });

      const cancelledRes = await request(app)
        .get(`/api/v1/orders/${cancelledOrder._id.toString()}/invoice`)
        .set("Authorization", `Bearer ${token}`);

      expect(cancelledRes.status).toBe(400);
    });

    it("returns a streamed PDF with Content-Type application/pdf for order owner", async () => {
      const { user, token } = await createTestUser("user");
      const product = await createPurchasableProduct();

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Purchased Phone", unitPrice: 1500, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "cod", status: "paid" },
        status: "Placed",
        statusHistory: [{ status: "Placed", at: new Date(), by: "user" }],
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order._id.toString()}/invoice`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      // PDF documents start with %PDF
      expect(res.body).toBeInstanceOf(Buffer);
      const pdfHeader = (res.body as Buffer).subarray(0, 4).toString("utf-8");
      expect(pdfHeader).toBe("%PDF");
    });
  });
});
