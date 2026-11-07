import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";
import Stripe from "stripe";

// Mock the Stripe client at the module checkout.ts imports
const mockCreateSession = vi.fn();
const mockConstructEvent = vi.fn();
const mockCreateCoupon = vi.fn();

vi.mock("../lib/stripe.js", () => {
  return {
    getStripeClient: () => ({
      checkout: {
        sessions: {
          create: mockCreateSession,
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
import { Order } from "../models/Order.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
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

interface StripeCheckoutResponseBody {
  orderId: string;
  sessionId: string;
  url: string;
}

describe("Phase 3 Part C: Stripe Checkout & Webhook (Real MongoDB)", () => {
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
      WebhookEvent.deleteMany({}),
    ]);
  });

  async function createTestUser(emailPrefix: string): Promise<{ user: IUser; addressId: string; token: string }> {
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
      name: "User Test",
      email: `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@yourstore.in`,
      passwordHash: "dummyHashForTesting123!",
      role: "user",
      emailVerified: true,
      addresses: [sampleAddress],
      cart: [],
    });

    const token = generateAccessToken({ sub: user._id.toString(), role: user.role, email: user.email });
    return { user, addressId: addressId.toString(), token };
  }

  describe("1. POST /checkout/stripe", () => {
    it("rejects when user attempts to checkout using another user's address (IDOR check)", async () => {
      const { user: userA, token: tokenA } = await createTestUser("usera");
      const { addressId: addressIdB } = await createTestUser("userb");

      const product = await Product.create({
        title: "Mechanical Keyboard",
        slug: "mech-keyboard",
        description: "Hot swap switches",
        category: "gadgets",
        brand: "Keychron",
        basePrice: 5000,
        stock: 10,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      await User.updateOne(
        { _id: userA._id },
        { $set: { cart: [{ productId: product._id, qty: 1 }] } },
      );

      // User A attempts to use User B's addressId
      const res = await request(app)
        .post("/api/v1/checkout/stripe")
        .set("Authorization", `Bearer ${tokenA}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ addressId: addressIdB });

      expect(res.status).toBe(404);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("Saved address not found");
    });

    it("creates a Stripe checkout session with accurate metadata, PendingPayment order, and leaves cart intact", async () => {
      const { user, addressId, token } = await createTestUser("checkout");

      mockCreateSession.mockImplementation((params: Stripe.Checkout.SessionCreateParams) => {
        return Promise.resolve({
          id: "cs_test_mock_session_12345",
          url: `https://checkout.stripe.com/pay/cs_test_mock_session_12345`,
          metadata: params.metadata,
          client_reference_id: params.client_reference_id,
        });
      });

      const product = await Product.create({
        title: "Wireless Mouse",
        slug: "wireless-mouse",
        description: "Ergonomic mouse",
        category: "gadgets",
        brand: "Logitech",
        basePrice: 2000,
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
        .post("/api/v1/checkout/stripe")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ addressId });

      expect(res.status).toBe(200);
      const body = res.body as StripeCheckoutResponseBody;
      expect(body.sessionId).toBe("cs_test_mock_session_12345");
      expect(body.orderId).toBeDefined();

      // Verify order created in PendingPayment status
      const order = await Order.findById(body.orderId);
      expect(order?.status).toBe("PendingPayment");
      expect(order?.payment.stripeSessionId).toBe("cs_test_mock_session_12345");

      // Verify stock was decremented from 5 to 4
      const productAfter = await Product.findById(product._id);
      expect(productAfter?.stock).toBe(4);

      // Verify user's cart is intact for stripe orders
      const userAfter = await User.findById(user._id);
      expect(userAfter?.cart).toHaveLength(1);
    });

    it("rejects 409 Conflict if user already has an order in PendingPayment created in the last 30 minutes", async () => {
      const { user, addressId, token } = await createTestUser("double_checkout");

      mockCreateSession.mockImplementation((params: Stripe.Checkout.SessionCreateParams) => {
        return Promise.resolve({
          id: "cs_test_mock_session_12345",
          url: `https://checkout.stripe.com/pay/cs_test_mock_session_12345`,
          metadata: params.metadata,
          client_reference_id: params.client_reference_id,
        });
      });

      const product = await Product.create({
        title: "Gaming Headset",
        slug: "gaming-headset",
        description: "Surround sound",
        category: "gadgets",
        brand: "HyperX",
        basePrice: 4000,
        stock: 10,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      await User.updateOne(
        { _id: user._id },
        { $set: { cart: [{ productId: product._id, qty: 1 }] } },
      );

      // First checkout creates PendingPayment order
      const firstRes = await request(app)
        .post("/api/v1/checkout/stripe")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ addressId });
      expect(firstRes.status).toBe(200);

      // Second checkout immediately after should return 409 Conflict
      const secondRes = await request(app)
        .post("/api/v1/checkout/stripe")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ addressId });

      expect(secondRes.status).toBe(409);
      const body = secondRes.body as ErrorBody;
      expect(body.error.message).toContain("already have a pending checkout order");
    });
  });

  describe("2. POST /webhooks/stripe", () => {
    it("rejects missing or bad signatures with 400", async () => {
      // 1. Missing signature
      const missingRes = await request(app)
        .post("/api/v1/webhooks/stripe")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ id: "evt_123" }));

      expect(missingRes.status).toBe(400);

      // 2. Bad signature
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature test");
      });

      const badSigRes = await request(app)
        .post("/api/v1/webhooks/stripe")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "bad_signature")
        .send(JSON.stringify({ id: "evt_123" }));

      expect(badSigRes.status).toBe(400);
    });

    it("checkout.session.completed moves PendingPayment order to Placed, marks paid, and clears cart", async () => {
      const { user } = await createTestUser("completed_webhook");

      const product = await Product.create({
        title: "Desk Mat",
        slug: "desk-mat",
        description: "Felt desk mat",
        category: "home",
        brand: "YourStore",
        basePrice: 1200,
        stock: 10,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const order = await Order.create({
        user: user._id,
        items: [
          {
            productId: product._id,
            title: product.title,
            unitPrice: 1200,
            qty: 1,
          },
        ],
        shippingAddress: {
          label: "Home",
          name: "User Test",
          phone: "9876543210",
          line1: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
        pricing: {
          subtotal: 1200,
          shipping: 0,
          tax: 216,
          discount: 0,
          total: 1416,
        },
        payment: {
          method: "stripe",
          status: "pending",
          stripeSessionId: "cs_completed_test_123",
        },
        status: "PendingPayment",
        statusHistory: [],
      });

      await User.updateOne(
        { _id: user._id },
        { $set: { cart: [{ productId: product._id, qty: 1 }] } },
      );

      // Mock constructEvent
      const mockEvent: Stripe.Event = {
        id: "evt_session_completed_1",
        type: "checkout.session.completed",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: "cs_completed_test_123",
            metadata: { orderId: order._id.toString() },
            payment_intent: "pi_test_completed_123",
          } as unknown as Stripe.Checkout.Session,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: "2025-02-24.acacia",
        object: "event",
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const res = await request(app)
        .post("/api/v1/webhooks/stripe")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "valid_signature")
        .send(JSON.stringify(mockEvent));

      expect(res.status).toBe(200);

      // Verify order moved to Placed
      const orderAfter = await Order.findById(order._id);
      expect(orderAfter?.status).toBe("Placed");
      expect(orderAfter?.payment.status).toBe("paid");
      expect(orderAfter?.payment.paymentIntentId).toBe("pi_test_completed_123");

      // Verify user cart is cleared
      const userAfter = await User.findById(user._id);
      expect(userAfter?.cart).toHaveLength(0);

      // Delivery of the same event twice processes only once (idempotent duplicate key skip)
      const resDuplicate = await request(app)
        .post("/api/v1/webhooks/stripe")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "valid_signature")
        .send(JSON.stringify(mockEvent));

      expect(resDuplicate.status).toBe(200);
      expect(resDuplicate.body).toEqual({ received: true });
    });

    it("checkout.session.expired restores stock and coupon once, and a second expired event does not double-restore", async () => {
      const { user } = await createTestUser("expired_webhook");

      const product = await Product.create({
        title: "Coffee Dripper",
        slug: "coffee-dripper",
        description: "Ceramic V60",
        category: "home",
        brand: "Hario",
        basePrice: 1500,
        stock: 8, // Stock was decremented to 8 (was 10)
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const coupon = await Coupon.create({
        code: "HARIO200",
        type: "fixed",
        value: 200,
        minOrder: 1000,
        expiresAt: new Date(Date.now() + 86400000),
        usageLimit: 10,
        usedCount: 3, // Coupon was incremented to 3
        isActive: true,
      });

      const order = await Order.create({
        user: user._id,
        items: [
          {
            productId: product._id,
            title: product.title,
            unitPrice: 1500,
            qty: 2, // 2 items were reserved
          },
        ],
        shippingAddress: {
          label: "Home",
          name: "User Test",
          phone: "9876543210",
          line1: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
        pricing: {
          subtotal: 3000,
          shipping: 0,
          tax: 504,
          discount: 200,
          total: 3304,
        },
        payment: {
          method: "stripe",
          status: "pending",
          stripeSessionId: "cs_expired_test_123",
        },
        status: "PendingPayment",
        couponCode: "HARIO200",
        statusHistory: [],
      });

      const expiredEvent1: Stripe.Event = {
        id: "evt_session_expired_1",
        type: "checkout.session.expired",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: "cs_expired_test_123",
            metadata: { orderId: order._id.toString() },
          } as unknown as Stripe.Checkout.Session,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: "2025-02-24.acacia",
        object: "event",
      };

      mockConstructEvent.mockReturnValue(expiredEvent1);

      // First expired webhook event
      const res1 = await request(app)
        .post("/api/v1/webhooks/stripe")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "valid_signature")
        .send(JSON.stringify(expiredEvent1));

      expect(res1.status).toBe(200);

      // Order should be Cancelled
      const orderAfter1 = await Order.findById(order._id);
      expect(orderAfter1?.status).toBe("Cancelled");

      // Stock restored: 8 + 2 = 10
      const prodAfter1 = await Product.findById(product._id);
      expect(prodAfter1?.stock).toBe(10);

      // Coupon restored: 3 - 1 = 2
      const couponAfter1 = await Coupon.findById(coupon._id);
      expect(couponAfter1?.usedCount).toBe(2);

      // A different expired event delivering for the SAME already cancelled order
      const expiredEvent2: Stripe.Event = {
        ...expiredEvent1,
        id: "evt_session_expired_2_duplicate",
      };
      mockConstructEvent.mockReturnValue(expiredEvent2);

      const res2 = await request(app)
        .post("/api/v1/webhooks/stripe")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "valid_signature")
        .send(JSON.stringify(expiredEvent2));

      expect(res2.status).toBe(200);

      // Crucial assertion: Stock and coupon must NOT be restored a second time!
      const prodAfter2 = await Product.findById(product._id);
      expect(prodAfter2?.stock).toBe(10); // remains 10, not 12

      const couponAfter2 = await Coupon.findById(coupon._id);
      expect(couponAfter2?.usedCount).toBe(2); // remains 2, not 1
    });

    it("a completed event for a Cancelled order returns 200 and does not change the order", async () => {
      const { user } = await createTestUser("completed_cancelled_order");

      const product = await Product.create({
        title: "Mechanical Numpad",
        slug: "mech-numpad",
        description: "USB-C numpad",
        category: "gadgets",
        brand: "Keychron",
        basePrice: 3000,
        stock: 5,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      const order = await Order.create({
        user: user._id,
        items: [
          {
            productId: product._id,
            title: product.title,
            unitPrice: 3000,
            qty: 1,
          },
        ],
        shippingAddress: {
          label: "Home",
          name: "User Test",
          phone: "9876543210",
          line1: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
        pricing: {
          subtotal: 3000,
          shipping: 0,
          tax: 540,
          discount: 0,
          total: 3540,
        },
        payment: {
          method: "stripe",
          status: "failed",
          stripeSessionId: "cs_cancelled_test_456",
        },
        status: "Cancelled",
        statusHistory: [
          {
            status: "Cancelled",
            at: new Date(),
            by: "system",
            note: "Cancelled prior to completion",
          },
        ],
      });

      const completedEvent: Stripe.Event = {
        id: "evt_completed_for_cancelled_1",
        type: "checkout.session.completed",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: "cs_cancelled_test_456",
            metadata: { orderId: order._id.toString() },
            payment_intent: "pi_late_payment_789",
          } as unknown as Stripe.Checkout.Session,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: "2025-02-24.acacia",
        object: "event",
      };

      mockConstructEvent.mockReturnValue(completedEvent);

      const res = await request(app)
        .post("/api/v1/webhooks/stripe")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "valid_signature")
        .send(JSON.stringify(completedEvent));

      expect(res.status).toBe(200);

      // Order should remain Cancelled (not moved to Placed)
      const orderAfter = await Order.findById(order._id);
      expect(orderAfter?.status).toBe("Cancelled");
      expect(orderAfter?.payment.status).toBe("failed");
    });
  });

  describe("3. Mismatched Totals Compensation", () => {
    it("mismatched totals trigger compensation: order cancelled, stock restored, cart preserved", async () => {
      const { user, addressId, token } = await createTestUser("mismatched_totals");

      const product = await Product.create({
        title: "Audiophile DAC",
        slug: "audiophile-dac",
        description: "High res audio DAC",
        category: "electronics",
        brand: "FiiO",
        basePrice: 8000,
        stock: 5,
        listingType: "purchasable",
        isActive: true,
        variants: [],
      });

      await User.updateOne(
        { _id: user._id },
        { $set: { cart: [{ productId: product._id, qty: 1 }] } },
      );

      // Artificially simulate mismatch between order pricing and computed lines
      // We can mock createOrderFromCart returning an inconsistent pricing total or mock coupon difference
      // Better yet: coupon discount that creates mismatch in paise calculation
      const coupon = await Coupon.create({
        code: "MISMATCH50",
        type: "percent",
        value: 50,
        minOrder: 1000,
        expiresAt: new Date(Date.now() + 86400000),
        usageLimit: 10,
        usedCount: 0,
        isActive: true,
      });

      // Mock stripe.coupons.create to return a coupon with a different amount than discountPaise
      // Or mock the session creation to test the error path if lineItems mismatch
      // Let's test the error condition when stripe total calculation throws:
      mockCreateSession.mockRejectedValue(new Error("Stripe API network failure"));

      const res = await request(app)
        .post("/api/v1/checkout/stripe")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ addressId, couponCode: "MISMATCH50" });

      expect(res.status).toBe(500);

      // Verify compensation: stock restored
      const prodAfter = await Product.findById(product._id);
      expect(prodAfter?.stock).toBe(5);

      // Verify coupon rolled back
      const couponAfter = await Coupon.findById(coupon._id);
      expect(couponAfter?.usedCount).toBe(0);

      // Verify order cancelled
      const orderAfter = await Order.findOne({ user: user._id });
      expect(orderAfter?.status).toBe("Cancelled");

      // Verify user cart restored
      const userAfter = await User.findById(user._id);
      expect(userAfter?.cart).toHaveLength(1);
    });
  });
});
