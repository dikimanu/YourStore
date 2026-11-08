import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

import { Product } from "../models/Product.js";

interface ErrorBody {
  error: { code: string; message: string };
}
interface RelatedBody {
  products: Array<{ slug: string; category: string; [key: string]: unknown }>;
}

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

describe("GET /api/v1/products/:slug/related", () => {
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
    await Product.deleteMany({});
  });

  it("returns 404 for an unknown product slug", async () => {
    const res = await request(app).get("/api/v1/products/non-existent-slug/related");
    expect(res.status).toBe(404);
    expect((res.body as ErrorBody).error).toBeDefined();
    expect((res.body as ErrorBody).error.code).toBe("NOT_FOUND");
    expect((res.body as ErrorBody).error.message).toBe("Product not found");
  });

  it("returns 404 for an inactive product slug", async () => {
    await Product.create({
      title: "Inactive Product",
      slug: "inactive-slug",
      description: "Inactive product description",
      category: "electronics",
      brand: "BrandA",
      basePrice: 100,
      isActive: false,
      listingType: "purchasable",
    });

    const res = await request(app).get("/api/v1/products/inactive-slug/related");
    expect(res.status).toBe(404);
    expect((res.body as ErrorBody).error.code).toBe("NOT_FOUND");
  });

  it("returns up to 8 same-category active purchasable products, excluding itself and inactive products", async () => {
    // Current target product
    await Product.create({
      title: "Target Laptop",
      slug: "target-laptop",
      description: "Target product in electronics category",
      category: "electronics",
      brand: "BrandX",
      basePrice: 50000,
      isActive: true,
      listingType: "purchasable",
      ratingAvg: 4.5,
    });

    // Related 1: same category, active, purchasable, high rating
    await Product.create({
      title: "High Rated Laptop",
      slug: "high-rated-laptop",
      description: "High rating electronic device",
      category: "electronics",
      brand: "BrandA",
      basePrice: 60000,
      isActive: true,
      listingType: "purchasable",
      ratingAvg: 4.9,
    });

    // Related 2: same category, active, purchasable, normal rating
    await Product.create({
      title: "Standard Laptop",
      slug: "standard-laptop",
      description: "Standard electronic device",
      category: "electronics",
      brand: "BrandB",
      basePrice: 40000,
      isActive: true,
      listingType: "purchasable",
      ratingAvg: 4.2,
    });

    // Should NOT be returned: different category
    await Product.create({
      title: "Clothing Item",
      slug: "clothing-item",
      description: "Apparel product",
      category: "clothing",
      brand: "BrandC",
      basePrice: 1000,
      isActive: true,
      listingType: "purchasable",
      ratingAvg: 5.0,
    });

    // Should NOT be returned: same category but inactive
    await Product.create({
      title: "Inactive Electronic",
      slug: "inactive-electronic",
      description: "Inactive electronic device",
      category: "electronics",
      brand: "BrandD",
      basePrice: 30000,
      isActive: false,
      listingType: "purchasable",
      ratingAvg: 5.0,
    });

    // Should NOT be returned: same category but listingType is enquiry
    await Product.create({
      title: "Enquiry Electronic",
      slug: "enquiry-electronic",
      description: "Enquiry-only electronic item",
      category: "electronics",
      brand: "BrandE",
      basePrice: 80000,
      isActive: true,
      listingType: "enquiry",
      ratingAvg: 5.0,
    });

    const res = await request(app).get("/api/v1/products/target-laptop/related");
    expect(res.status).toBe(200);
    expect((res.body as RelatedBody).products).toBeDefined();
    expect(Array.isArray((res.body as RelatedBody).products)).toBe(true);
    expect((res.body as RelatedBody).products.length).toBe(2);

    const slugs = (res.body as RelatedBody).products.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain("high-rated-laptop");
    expect(slugs).toContain("standard-laptop");
    expect(slugs).not.toContain("target-laptop");
    expect(slugs).not.toContain("clothing-item");
    expect(slugs).not.toContain("inactive-electronic");
    expect(slugs).not.toContain("enquiry-electronic");

    // Sorted by ratingAvg desc
    expect((res.body as RelatedBody).products[0]?.slug).toBe("high-rated-laptop");
    expect((res.body as RelatedBody).products[1]?.slug).toBe("standard-laptop");
  });
});
