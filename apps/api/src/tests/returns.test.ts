import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { vi, type Mock } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Mock Stripe before importing app
vi.mock("../lib/stripe.js", () => {
  const mockRefundsCreate = vi.fn().mockResolvedValue({ id: "re_mock_refund" });
  const mockStripeClient = {
    refunds: { create: mockRefundsCreate },
    checkout: { sessions: { expire: vi.fn().mockResolvedValue({}) } },
  };
  return {
    getStripeClient: vi.fn(() => mockStripeClient),
    _mockStripeClient: mockStripeClient,
  };
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";

import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { Order } from "../models/Order.js";
import { AuditLog } from "../models/AuditLog.js";
import { generateAccessToken } from "../lib/token.js";
import { getStripeClient } from "../lib/stripe.js";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["STRIPE_SECRET_KEY"] = "sk_test_mock_key";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

interface OrderBody {
  status: string;
  returnRequest?: { reason: string; note?: string };
  payment: { status: string };
  statusHistory: Array<{ status: string }>;
}

interface OrderResponse {
  order: OrderBody;
}

interface OrdersResponse {
  orders: OrderBody[];
}
/** Minimal shared address object for order creation */
const TEST_ADDRESS = {
  label: "Home",
  name: "Test Customer",
  phone: "9876543210",
  line1: "123 Test Street",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

/** Minimal shared pricing */
const TEST_PRICING = {
  subtotal: 2000,
  shipping: 50,
  tax: 360,
  discount: 0,
  total: 2410,
};

describe("Returns & Refunds API", () => {
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
      User.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
  });

  // ---- Helpers ----

  async function createUser(role: "user" | "admin" = "user") {
    const user = await User.create({
      name: role === "admin" ? "Admin Test" : "Normal User",
      email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      passwordHash: "dummy_hash_no_login_needed",
      role,
      emailVerified: true,
    });
    const token = generateAccessToken({ sub: user._id.toString(), role: user.role, email: user.email });
    return { user, token };
  }

  async function createProduct(stock = 10) {
    return Product.create({
      title: "Return Test Product",
      slug: `return-test-product-${Date.now()}`,
      description: "A product for testing returns",
      category: "electronics",
      brand: "TestBrand",
      basePrice: 2000,
      images: [],
      stock,
      listingType: "purchasable",
      isActive: true,
    });
  }

  async function createDeliveredOrder(
    userId: Types.ObjectId,
    productId: Types.ObjectId,
    deliveredAt: Date = new Date(),
    paymentMethod: "cod" | "stripe" = "cod",
    paymentIntentId?: string,
  ) {
    return Order.create({
      user: userId,
      items: [{ productId, title: "Return Test Product", unitPrice: 2000, qty: 1 }],
      shippingAddress: TEST_ADDRESS,
      pricing: TEST_PRICING,
      payment: {
        method: paymentMethod,
        status: "paid",
        ...(paymentIntentId ? { paymentIntentId } : {}),
      },
      status: "Delivered",
      statusHistory: [
        { status: "Placed", at: new Date(deliveredAt.getTime() - 86400000 * 10), by: "system" },
        { status: "Delivered", at: deliveredAt, by: "admin" },
      ],
    });
  }

  // ==========================================================================
  // POST /api/v1/orders/:id/return
  // ==========================================================================

  describe("POST /api/v1/orders/:id/return (user: request return)", () => {
    it("returns 401 for unauthenticated requests", async () => {
      const fakeId = new Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/v1/orders/${fakeId}/return`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ reason: "Product arrived damaged" });
      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-existent order (IDOR: user A cannot see user B's order)", async () => {
      const { user: userA } = await createUser();
      const { token: tokenB } = await createUser();
      const product = await createProduct();

      const order = await createDeliveredOrder(userA._id, product._id);

      const res = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${tokenB}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ reason: "User B trying to return User A order" });

      expect(res.status).toBe(404);
    });

    it("blocks return if order status is not Delivered", async () => {
      const { user, token } = await createUser();
      const product = await createProduct();

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Test", unitPrice: 2000, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "cod", status: "paid" },
        status: "Dispatched",
        statusHistory: [{ status: "Dispatched", at: new Date(), by: "admin" }],
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ reason: "Product arrived damaged and defective" });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toMatch(/must be Delivered/i);
    });

    it("blocks return if Delivered more than 7 days ago", async () => {
      const { user, token } = await createUser();
      const product = await createProduct();

      // 8 days ago
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const order = await createDeliveredOrder(
        user._id,
        product._id,
        eightDaysAgo,
      );

      const res = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ reason: "Product arrived damaged and defective" });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toMatch(/return window has expired|7 days/i);
    });

    it("blocks a second return request if one already exists", async () => {
      const { user, token } = await createUser();
      const product = await createProduct();
      const order = await createDeliveredOrder(user._id, product._id);

      // First request
      const firstRes = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ reason: "Product arrived damaged and defective" });
      expect(firstRes.status).toBe(200);

      // Second request on same order (now in ReturnRequested)
      const secondRes = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ reason: "Trying again after already requesting" });
      expect(secondRes.status).toBe(400);
    });

    it("successfully submits return request within 7 days, sets status to ReturnRequested", async () => {
      const { user, token } = await createUser();
      const product = await createProduct();
      const order = await createDeliveredOrder(user._id, product._id);

      const res = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ reason: "Product arrived damaged and defective from shipping" });

      expect(res.status).toBe(200);
      expect((res.body as OrderResponse).order.status).toBe("ReturnRequested");
      expect((res.body as OrderResponse).order.returnRequest).toBeDefined();
      expect((res.body as OrderResponse).order.returnRequest?.reason).toBe("Product arrived damaged and defective from shipping");
      expect((res.body as OrderResponse).order.statusHistory.at(-1)?.status).toBe("ReturnRequested");
    });

    it("validates reason: too short is rejected", async () => {
      const { user, token } = await createUser();
      const product = await createProduct();
      const order = await createDeliveredOrder(user._id, product._id);

      const res = await request(app)
        .post(`/api/v1/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ reason: "Bad" }); // too short

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // GET /api/v1/admin/returns
  // ==========================================================================

  describe("GET /api/v1/admin/returns (admin only)", () => {
    it("returns 401 for unauthenticated", async () => {
      const res = await request(app).get("/api/v1/admin/returns");
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
      const { token } = await createUser("user");
      const res = await request(app)
        .get("/api/v1/admin/returns")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it("admin can list return orders", async () => {
      const { user } = await createUser("user");
      const { token: adminToken } = await createUser("admin");
      const product = await createProduct();

      // Create a return-requested order
      const order = await createDeliveredOrder(user._id, product._id);
      await Order.findByIdAndUpdate(order._id, {
        status: "ReturnRequested",
        returnRequest: { reason: "Defective on arrival", requestedAt: new Date() },
        $push: { statusHistory: { status: "ReturnRequested", at: new Date(), by: user._id.toString() } },
      });

      const res = await request(app)
        .get("/api/v1/admin/returns")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect((res.body as OrdersResponse).orders.length).toBe(1);
      expect((res.body as OrdersResponse).orders[0].status).toBe("ReturnRequested");
    });
  });

  // ==========================================================================
  // PATCH /api/v1/admin/orders/:id/return (admin decision)
  // ==========================================================================

  describe("PATCH /api/v1/admin/orders/:id/return (admin: approve / reject)", () => {
    it("returns 403 for non-admin user", async () => {
      const { token } = await createUser("user");
      const fakeId = new Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${fakeId}/return`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ decision: "approve" });

      expect(res.status).toBe(403);
    });

    it("reject: sets status back to Delivered, records decision and note, writes AuditLog", async () => {
      const { user } = await createUser("user");
      const { user: admin, token: adminToken } = await createUser("admin");
      const product = await createProduct();

      // Set up a ReturnRequested order
      const order = await createDeliveredOrder(user._id, product._id);
      await Order.findByIdAndUpdate(order._id, {
        status: "ReturnRequested",
        returnRequest: { reason: "Arrived broken with cracks", requestedAt: new Date() },
        $push: { statusHistory: { status: "ReturnRequested", at: new Date(), by: user._id.toString() } },
      });

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ decision: "reject", note: "Item appears used. Policy violation." });

      expect(res.status).toBe(200);
      expect((res.body as OrderResponse).order.status).toBe("Delivered");
      expect((res.body as OrderResponse).order.returnRequest.decision).toBe("reject");
      expect((res.body as OrderResponse).order.returnRequest.note).toBe("Item appears used. Policy violation.");
      expect((res.body as OrderResponse).order.statusHistory.at(-1)?.status).toBe("Delivered");

      // AuditLog
      const audit = await AuditLog.findOne({
        action: "order.return_reject",
        targetType: "Order",
        targetId: order._id.toString(),
      });
      expect(audit).not.toBeNull();
      expect(audit?.actor.toString()).toBe(admin._id.toString());
    });

    it("approve: sets status to Returned, restores stock, writes AuditLog", async () => {
      const { user } = await createUser("user");
      const { user: admin, token: adminToken } = await createUser("admin");
      const product = await createProduct(5);

      // Set up a ReturnRequested order
      const order = await createDeliveredOrder(user._id, product._id);
      await Order.findByIdAndUpdate(order._id, {
        status: "ReturnRequested",
        returnRequest: { reason: "Wrong item was delivered to me", requestedAt: new Date() },
        $push: { statusHistory: { status: "ReturnRequested", at: new Date(), by: user._id.toString() } },
      });

      const stockBefore = (await Product.findById(product._id))?.stock ?? 0;

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ decision: "approve", note: "Confirmed wrong item shipped." });

      expect(res.status).toBe(200);
      expect((res.body as OrderResponse).order.status).toBe("Returned");
      expect((res.body as OrderResponse).order.returnRequest.decision).toBe("approve");
      expect((res.body as OrderResponse).order.statusHistory.at(-1)?.status).toBe("Returned");

      // Stock should be restored (order qty was 1)
      const stockAfter = (await Product.findById(product._id))?.stock ?? 0;
      expect(stockAfter).toBe(stockBefore + 1);

      // AuditLog
      const audit = await AuditLog.findOne({
        action: "order.return_approve",
        targetType: "Order",
        targetId: order._id.toString(),
      });
      expect(audit).not.toBeNull();
      expect(audit?.actor.toString()).toBe(admin._id.toString());
    });

    it("cannot approve/reject if status is not ReturnRequested", async () => {
      const { user } = await createUser("user");
      const { token: adminToken } = await createUser("admin");
      const product = await createProduct();

      const order = await createDeliveredOrder(user._id, product._id);
      // Order is in Delivered, not ReturnRequested

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/return`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ decision: "approve" });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toMatch(/must be ReturnRequested/i);
    });
  });

  // ==========================================================================
  // PATCH /api/v1/admin/orders/:id/refund
  // ==========================================================================

  describe("PATCH /api/v1/admin/orders/:id/refund (admin: refund)", () => {
    it("returns 403 for non-admin user", async () => {
      const { token } = await createUser("user");
      const fakeId = new Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${fakeId}/refund`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(403);
    });

    it("blocks refund if order status is not Returned", async () => {
      const { user } = await createUser("user");
      const { token: adminToken } = await createUser("admin");
      const product = await createProduct();

      // Order is Delivered, not Returned
      const order = await createDeliveredOrder(user._id, product._id);

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toMatch(/must be Returned/i);
    });

    it("COD refund: sets status to Refunded, payment.status = refunded, writes AuditLog (no Stripe call)", async () => {
      const { user } = await createUser("user");
      const { user: admin, token: adminToken } = await createUser("admin");
      const product = await createProduct();

      // Create Returned order (COD)
      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "COD Return Test", unitPrice: 2000, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "cod", status: "paid" },
        status: "Returned",
        statusHistory: [
          { status: "Delivered", at: new Date(), by: "admin" },
          { status: "Returned", at: new Date(), by: admin._id.toString() },
        ],
      });

      const mockStripe = getStripeClient();

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(200);
      expect((res.body as OrderResponse).order.status).toBe("Refunded");
      expect((res.body as OrderResponse).order.payment.status).toBe("refunded");
      expect((res.body as OrderResponse).order.statusHistory.at(-1)?.status).toBe("Refunded");

      // Stripe refunds.create should NOT have been called for COD
      expect((mockStripe.refunds as unknown as { create: Mock }).create).not.toHaveBeenCalled();

      // AuditLog
      const audit = await AuditLog.findOne({
        action: "order.refund",
        targetType: "Order",
        targetId: order._id.toString(),
      });
      expect(audit).not.toBeNull();
      expect(audit?.actor.toString()).toBe(admin._id.toString());
    });

    it("Stripe refund: calls stripe.refunds.create once with idempotency key, sets status Refunded", async () => {
      const { user } = await createUser("user");
      const { user: admin, token: adminToken } = await createUser("admin");
      const product = await createProduct();

      const paymentIntentId = "pi_test_123456789";

      // Create Returned order (Stripe)
      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "Stripe Return Test", unitPrice: 2000, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "stripe", status: "paid", paymentIntentId },
        status: "Returned",
        statusHistory: [
          { status: "Delivered", at: new Date(), by: "admin" },
          { status: "Returned", at: new Date(), by: admin._id.toString() },
        ],
      });

      const mockStripe = getStripeClient();

      const res = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(200);
      expect((res.body as OrderResponse).order.status).toBe("Refunded");
      expect((res.body as OrderResponse).order.payment.status).toBe("refunded");

      // Stripe should have been called once with correct idempotencyKey
      expect((mockStripe.refunds as unknown as { create: Mock }).create).toHaveBeenCalledOnce();
      expect((mockStripe.refunds as unknown as { create: Mock }).create).toHaveBeenCalledWith(
        { payment_intent: paymentIntentId },
        { idempotencyKey: `refund-${order._id.toString()}` },
      );
    });

    it("prevents double refund: a second refund call on a Refunded order is rejected (atomic update)", async () => {
      const { user } = await createUser("user");
      const { token: adminToken } = await createUser("admin");
      const product = await createProduct();

      const paymentIntentId = "pi_test_no_double_refund";

      const order = await Order.create({
        user: user._id,
        items: [{ productId: product._id, title: "No Double Refund", unitPrice: 2000, qty: 1 }],
        shippingAddress: TEST_ADDRESS,
        pricing: TEST_PRICING,
        payment: { method: "stripe", status: "paid", paymentIntentId },
        status: "Returned",
        statusHistory: [
          { status: "Delivered", at: new Date(), by: "admin" },
          { status: "Returned", at: new Date(), by: "admin" },
        ],
      });

      const mockStripe = getStripeClient();

      // First refund — should succeed
      const firstRes = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest");
      expect(firstRes.status).toBe(200);

      // Second refund — order is now Refunded so the atomic filter on status=Returned will fail
      const secondRes = await request(app)
        .patch(`/api/v1/admin/orders/${order._id.toString()}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest");
      expect(secondRes.status).toBe(400);

      // Stripe should only have been called once total (the second call is rejected before Stripe)
      expect((mockStripe.refunds as unknown as { create: Mock }).create).toHaveBeenCalledOnce();
    });
  });
});
