import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";

import { User, IUser } from "../models/User.js";
import { Product } from "../models/Product.js";
import { Order } from "../models/Order.js";
import { Review } from "../models/Review.js";
import { generateAccessToken } from "../lib/token.js";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

describe("Reviews & Ratings API (/api/v1/reviews)", () => {
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
      Product.deleteMany({}),
      User.deleteMany({}),
      Order.deleteMany({}),
      Review.deleteMany({}),
    ]);
  });

  async function createTestUser(
    emailPrefix: string,
    role: "user" | "admin" = "user",
  ): Promise<{ user: IUser; token: string }> {
    const user = await User.create({
      name: `User ${emailPrefix}`,
      email: `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@yourstore.in`,
      passwordHash: "dummyHashForTesting123!",
      role,
      emailVerified: true,
      addresses: [],
      cart: [],
    });

    const token = generateAccessToken({ sub: user._id.toString(), role: user.role, email: user.email });
    return { user, token };
  }

  async function createDeliveredOrder(userId: Types.ObjectId, productId: Types.ObjectId) {
    return Order.create({
      user: userId,
      items: [
        {
          productId,
          title: "Test Item",
          unitPrice: 1000,
          qty: 1,
        },
      ],
      shippingAddress: {
        label: "Home",
        name: "Test User",
        phone: "9876543210",
        line1: "123 Street",
        city: "City",
        state: "State",
        pincode: "560001",
      },
      pricing: {
        subtotal: 1000,
        shipping: 0,
        tax: 180,
        discount: 0,
        total: 1180,
      },
      payment: {
        method: "cod",
        status: "paid",
      },
      status: "Delivered",
      statusHistory: [{ status: "Delivered", at: new Date(), by: "admin" }],
    });
  }

  it("rejects a non-buyer with 403 Forbidden", async () => {
    const { token } = await createTestUser("non_buyer");
    const product = await Product.create({
      title: "Gadget A",
      slug: "gadget-a",
      description: "Test description",
      category: "gadgets",
      brand: "BrandX",
      basePrice: 1000,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: product._id.toString(),
        rating: 5,
        title: "Great product",
        body: "Really loved using this gadget every day.",
      });

    expect(res.status).toBe(403);
    const body = res.body as ErrorBody;
    expect(body.error.message).toContain("Only verified buyers");
  });

  it("rejects a buyer with an undelivered order (e.g. Placed or Dispatched)", async () => {
    const { user, token } = await createTestUser("undelivered_buyer");
    const product = await Product.create({
      title: "Gadget B",
      slug: "gadget-b",
      description: "Test description",
      category: "gadgets",
      brand: "BrandX",
      basePrice: 1000,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    // Create an order in Dispatched status (not Delivered yet)
    await Order.create({
      user: user._id,
      items: [{ productId: product._id, title: "Gadget B", unitPrice: 1000, qty: 1 }],
      shippingAddress: { label: "Home", name: "User", phone: "9876543210", line1: "A", city: "B", state: "C", pincode: "560001" },
      pricing: { subtotal: 1000, shipping: 0, tax: 180, discount: 0, total: 1180 },
      payment: { method: "cod", status: "pending" },
      status: "Dispatched",
      statusHistory: [{ status: "Dispatched", at: new Date(), by: "admin" }],
    });

    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: product._id.toString(),
        rating: 4,
        title: "Looking forward",
        body: "Waiting for it to arrive, looks awesome.",
      });

    expect(res.status).toBe(403);
  });

  it("allows a buyer with a Delivered order to submit a review and recomputes rating stats", async () => {
    const { user, token } = await createTestUser("verified_buyer");
    const product = await Product.create({
      title: "Gadget C",
      slug: "gadget-c",
      description: "Test description",
      category: "gadgets",
      brand: "BrandX",
      basePrice: 1000,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    await createDeliveredOrder(user._id, product._id);

    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: product._id.toString(),
        rating: 5,
        title: "Excellent purchase",
        body: "Build quality is remarkable, totally satisfied.",
      });

    expect(res.status).toBe(201);
expect((res.body as { message: string }).message).toContain("Review submitted successfully");

    // Product ratingAvg and ratingCount updated
    const updatedProd = await Product.findById(product._id);
    expect(updatedProd?.ratingAvg).toBe(5);
    expect(updatedProd?.ratingCount).toBe(1);
  });

  it("returns 409 on duplicate review by the same user for the same product", async () => {
    const { user, token } = await createTestUser("duplicate_buyer");
    const product = await Product.create({
      title: "Gadget D",
      slug: "gadget-d",
      description: "Test description",
      category: "gadgets",
      brand: "BrandX",
      basePrice: 1000,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    await createDeliveredOrder(user._id, product._id);

    // First review succeeds
    const firstRes = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: product._id.toString(),
        rating: 4,
        title: "Good product",
        body: "First review comment here.",
      });
    expect(firstRes.status).toBe(201);

    // Second review triggers 409 Conflict
    const secondRes = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: product._id.toString(),
        rating: 3,
        title: "Second review",
        body: "Trying to review again.",
      });

    expect(secondRes.status).toBe(409);
    const body = secondRes.body as ErrorBody;
    expect(body.error.message).toContain("already reviewed");
  });

  it("updates ratingAvg and ratingCount correctly across multiple reviews and deletions", async () => {
    const { user: user1, token: token1 } = await createTestUser("user_one");
    const { user: user2, token: token2 } = await createTestUser("user_two");

    const product = await Product.create({
      title: "Gadget E",
      slug: "gadget-e",
      description: "Test description",
      category: "gadgets",
      brand: "BrandX",
      basePrice: 1000,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    await createDeliveredOrder(user1._id, product._id);
    await createDeliveredOrder(user2._id, product._id);

    // Review 1: Rating 5
    await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token1}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: product._id.toString(),
        rating: 5,
        title: "Perfect",
        body: "Great item.",
      });

    // Review 2: Rating 4
    const res2 = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token2}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: product._id.toString(),
        rating: 4,
        title: "Very Good",
        body: "Good item.",
      });

    // Average: (5 + 4) / 2 = 4.5
    let prod = await Product.findById(product._id);
    expect(prod?.ratingAvg).toBe(4.5);
    expect(prod?.ratingCount).toBe(2);

    // User 2 deletes their review
    const review2Id = (res2.body as { review: { id: string } }).review.id;
    await request(app)
      .delete(`/api/v1/reviews/${review2Id}`)
      .set("Authorization", `Bearer ${token2}`)
      .set("X-Requested-With", "XMLHttpRequest");

    // Average returns to 5.0 and count becomes 1
    prod = await Product.findById(product._id);
    expect(prod?.ratingAvg).toBe(5);
    expect(prod?.ratingCount).toBe(1);
  });

  it("user A cannot delete user B's review (403)", async () => {
const { token: tokenA } = await createTestUser("usera_del");
    const { user: userB, token: tokenB } = await createTestUser("userb_del");

    const product = await Product.create({
      title: "Gadget F",
      slug: "gadget-f",
      description: "Test description",
      category: "gadgets",
      brand: "BrandX",
      basePrice: 1000,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    await createDeliveredOrder(userB._id, product._id);

    const resB = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: product._id.toString(),
        rating: 5,
        title: "B Review",
        body: "Created by user B.",
      });

    const reviewId = (resB.body as { review: { id: string } }).review.id;

    // User A attempts to delete User B's review
    const delResA = await request(app)
      .delete(`/api/v1/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(delResA.status).toBe(403);
    const body = delResA.body as ErrorBody;
    expect(body.error.message).toContain("permission to delete");

    // Review is still present
    const reviewStillThere = await Review.findById(reviewId);
    expect(reviewStillThere).not.toBeNull();
  });
});
