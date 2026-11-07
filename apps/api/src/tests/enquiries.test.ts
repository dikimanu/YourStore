import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";


interface MessageResponse {
  message: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

import { Product } from "../models/Product.js";
import { Enquiry } from "../models/Enquiry.js";

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

describe("Enquiries API (POST /api/v1/enquiries)", () => {
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
      Enquiry.deleteMany({}),
    ]);
  });

  it("allows a guest to submit an enquiry for an enquiry-only vehicle", async () => {
    const vehicle = await Product.create({
      title: "Yamaha R15 V4",
      slug: "yamaha-r15-v4",
      description: "155cc supersport motorcycle",
      category: "vehicles",
      brand: "Yamaha",
      basePrice: 182000,
      listingType: "enquiry",
      isActive: true,
      variants: [],
    });

    const res = await request(app)
      .post("/api/v1/enquiries")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: vehicle._id.toString(),
        name: "Rohan Sharma",
        phone: "9876543210",
        message: "Is this model available in Racing Blue color?",
        type: "enquiry",
      });

    expect(res.status).toBe(201);
expect((res.body as MessageResponse).message).toContain("Enquiry submitted successfully");

    const savedEnquiry = await Enquiry.findOne({ product: vehicle._id });
    expect(savedEnquiry).not.toBeNull();
    expect(savedEnquiry?.name).toBe("Rohan Sharma");
    expect(savedEnquiry?.type).toBe("enquiry");
  });

  it("allows booking a visit with a future preferred date", async () => {
    const vehicle = await Product.create({
      title: "Royal Enfield Hunter 350",
      slug: "hunter-350",
      description: "Modern roadster",
      category: "vehicles",
      brand: "Royal Enfield",
      basePrice: 150000,
      listingType: "enquiry",
      isActive: true,
      variants: [],
    });

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post("/api/v1/enquiries")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: vehicle._id.toString(),
        name: "Pooja Verma",
        phone: "9123456789",
        message: "Would like to take a test ride this weekend.",
        type: "visit",
        preferredDate: futureDate,
      });

    expect(res.status).toBe(201);
expect((res.body as MessageResponse).message).toContain("Dealership visit booked");  });

  it("rejects purchasable products with 400 Bad Request", async () => {
    const purchasable = await Product.create({
      title: "Wireless Mouse",
      slug: "wireless-mouse",
      description: "Logitech mouse",
      category: "gadgets",
      brand: "Logitech",
      basePrice: 1500,
      stock: 10,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    const res = await request(app)
      .post("/api/v1/enquiries")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: purchasable._id.toString(),
        name: "Amit Patel",
        phone: "9876543210",
        message: "Can I buy this in bulk?",
        type: "enquiry",
      });

    expect(res.status).toBe(400);
    const body = res.body as ErrorBody;
    expect(body.error.message).toContain("enquiry-only products");
  });

  it("rejects invalid Indian phone number with 400 Validation Error", async () => {
    const vehicle = await Product.create({
      title: "Tata Nexon EV",
      slug: "tata-nexon-ev",
      description: "Electric SUV",
      category: "vehicles",
      brand: "Tata",
      basePrice: 1500000,
      listingType: "enquiry",
      isActive: true,
      variants: [],
    });

    const res = await request(app)
      .post("/api/v1/enquiries")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        productId: vehicle._id.toString(),
        name: "Amit Patel",
        phone: "12345", // Invalid phone
        message: "Enquiry message",
        type: "enquiry",
      });

    expect(res.status).toBe(400);
  });

  it("enforces rate limit of 5 requests per hour", async () => {
    const vehicle = await Product.create({
      title: "KTM Duke 390",
      slug: "ktm-duke-390",
      description: "Street bike",
      category: "vehicles",
      brand: "KTM",
      basePrice: 310000,
      listingType: "enquiry",
      isActive: true,
      variants: [],
    });

    const validPayload = {
      productId: vehicle._id.toString(),
      name: "Rider",
      phone: "9876543210",
      message: "Test enquiry",
      type: "enquiry",
    };

    // Make 5 requests with x-test-rate-limit header to test the enquiryLimiter
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/v1/enquiries")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("x-test-rate-limit", "true")
        .send(validPayload);
      expect(res.status).toBe(201);
    }

    // 6th request should hit 429
    const blockedRes = await request(app)
      .post("/api/v1/enquiries")
      .set("X-Requested-With", "XMLHttpRequest")
      .set("x-test-rate-limit", "true")
      .send(validPayload);

    expect(blockedRes.status).toBe(429);
    const body = blockedRes.body as ErrorBody;
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
