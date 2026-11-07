import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { AuditLog } from "../models/AuditLog.js";
import { generateAccessToken } from "../lib/token.js";
import type { CsvImportPreviewResponse, CsvImportCommitResponse } from "@yourstore/shared";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

describe("Admin CSV Product Import API", () => {
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
      Product.deleteMany({}),
      AuditLog.deleteMany({}),
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

  describe("Authentication and Role Guards", () => {
    it("returns 401 for unauthenticated guest on preview", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv: "title,description,category,brand,basePrice\nT,D,gadgets,B,100" });

      expect(res.status).toBe(401);
    });

    it("returns 401 for unauthenticated guest on commit", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products/import/commit")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv: "title,description,category,brand,basePrice\nT,D,gadgets,B,100" });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin user on preview", async () => {
      await createUsers();
      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${userToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv: "title,description,category,brand,basePrice\nT,D,gadgets,B,100" });

      expect(res.status).toBe(403);
    });

    it("returns 403 for non-admin user on commit", async () => {
      await createUsers();
      const res = await request(app)
        .post("/api/v1/admin/products/import/commit")
        .set("Authorization", `Bearer ${userToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv: "title,description,category,brand,basePrice\nT,D,gadgets,B,100" });

      expect(res.status).toBe(403);
    });
  });

  describe("Limits and Constraints (Max 200 rows, Max 1 MB)", () => {
    it("returns 400 when CSV exceeds 1 MB", async () => {
      await createUsers();
      const bigString = "a".repeat(1_000_001);
      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv: bigString });

      expect(res.status).toBe(400);
      expect((res.body as { error: { message: string } }).error.message).toMatch(/1 MB limit/i);
    });

    it("returns 400 when CSV exceeds 200 rows", async () => {
      await createUsers();
      const header = "title,description,category,brand,basePrice\n";
      const rows = Array.from({ length: 201 }, (_, i) => `Title ${i},Desc ${i},gadgets,Brand,100`).join("\n");

      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv: header + rows });

      expect(res.status).toBe(400);
      expect((res.body as { error: { message: string } }).error.message).toMatch(/maximum of 200 rows/i);
    });
  });

  describe("Preview behavior", () => {
    it("preview parses valid rows and writes NOTHING to the database", async () => {
      await createUsers();
      const csv = `title,description,category,brand,basePrice,stock\nSmart Mouse,A great mouse,electronics,Logi,499,10\nCotton Shirt,Comfortable shirt,clothing,Zara,899,25`;

      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv });

      expect(res.status).toBe(200);
      const body = res.body as CsvImportPreviewResponse;
      expect(body.validCount).toBe(2);
      expect(body.invalidCount).toBe(0);
      expect(body.rows.length).toBe(2);
      expect(body.rows[0]?.data?.title).toBe("Smart Mouse");
      expect(body.rows[0]?.data?.slug).toBe("smart-mouse");

      // Verify DB remains empty
      const count = await Product.countDocuments();
      expect(count).toBe(0);
    });
  });

  describe("Validation Rules", () => {
    it("rejects formula injection characters (=, +, -, @, \\t, \\r)", async () => {
      await createUsers();
      const csv = `title,description,category,brand,basePrice\n=cmd|' /C calc'!A0,Dangerous formula,gadgets,Acme,100\n+sum(1+1),Dangerous plus,gadgets,Acme,100`;

      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv });

      expect(res.status).toBe(200);
      const body = res.body as CsvImportPreviewResponse;
      expect(body.invalidCount).toBe(2);
      expect(body.rows[0]?.errors[0]).toMatch(/formula injection/i);
      expect(body.rows[1]?.errors[0]).toMatch(/formula injection/i);
    });

    it("rejects vehicles with listingType purchasable", async () => {
      await createUsers();
      const csv = `title,description,category,brand,basePrice,listingType\nElectric Bike,Fast e-bike,vehicles,Tesla,50000,purchasable`;

      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv });

      expect(res.status).toBe(200);
      const body = res.body as CsvImportPreviewResponse;
      expect(body.invalidCount).toBe(1);
      expect(body.rows[0]?.errors.some((e: string) => e.includes("vehicles category must have listingType 'enquiry'"))).toBe(true);
    });

    it("rejects duplicate slugs inside the file", async () => {
      await createUsers();
      const csv = `title,slug,description,category,brand,basePrice\nFirst Product,custom-slug,Desc 1,gadgets,Brand,100\nSecond Product,custom-slug,Desc 2,gadgets,Brand,200`;

      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv });

      expect(res.status).toBe(200);
      const body = res.body as CsvImportPreviewResponse;
      expect(body.invalidCount).toBe(1);
      expect(body.rows[1]?.errors.some((e: string) => e.includes("Duplicate slug 'custom-slug' in file"))).toBe(true);
    });

    it("rejects slugs that already exist in the database", async () => {
      await createUsers();
      await Product.create({
        title: "Existing Item",
        slug: "existing-slug",
        description: "Already in DB",
        category: "gadgets",
        brand: "Brand",
        basePrice: 50,
      });

      const csv = `title,slug,description,category,brand,basePrice\nNew Item,existing-slug,Desc,gadgets,Brand,100`;

      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv });

      expect(res.status).toBe(200);
      const body = res.body as CsvImportPreviewResponse;
      expect(body.invalidCount).toBe(1);
      expect(body.rows[0]?.errors.some((e: string) => e.includes("already exists in the database"))).toBe(true);
    });

    it("parses variants correctly and rejects duplicate variant SKUs across the file", async () => {
      await createUsers();
      const variants1 = JSON.stringify([{ sku: "SKU-RED-M", options: { size: "M", color: "Red" }, stock: 10 }]);
      const variants2 = JSON.stringify([{ sku: "SKU-RED-M", options: { size: "M", color: "Red" }, stock: 5 }]);
      const csv = `title,description,category,brand,basePrice,variants\nShirt 1,Desc 1,clothing,Zara,500,"${variants1.replace(/"/g, '""')}"\nShirt 2,Desc 2,clothing,Zara,600,"${variants2.replace(/"/g, '""')}"`;

      const res = await request(app)
        .post("/api/v1/admin/products/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv });

      expect(res.status).toBe(200);
      const body = res.body as CsvImportPreviewResponse;
      expect(body.invalidCount).toBe(1);
      expect(body.rows[1]?.errors.some((e: string) => e.includes("Duplicate variant sku 'SKU-RED-M' across file"))).toBe(true);
    });
  });

  describe("Commit behavior (All or Nothing & AuditLog)", () => {
    it("one invalid row blocks the whole commit (all or nothing)", async () => {
      await createUsers();
      const csv = `title,description,category,brand,basePrice\nValid Item,Desc,gadgets,Brand,100\nInvalid Item,,gadgets,Brand,200`; // Missing description

      const res = await request(app)
        .post("/api/v1/admin/products/import/commit")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv });

      expect(res.status).toBe(400);

      // Verify zero products were imported
      const count = await Product.countDocuments();
      expect(count).toBe(0);
    });

    it("valid CSV imports all rows, creates products, and writes one AuditLog entry", async () => {
      await createUsers();
      const csv = `title,description,category,brand,basePrice,stock\nGadget One,Description 1,gadgets,Acme,199,15\nGadget Two,Description 2,gadgets,Acme,299,20`;

      const res = await request(app)
        .post("/api/v1/admin/products/import/commit")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ csv });

      expect(res.status).toBe(200);
      const body = res.body as CsvImportCommitResponse;
      expect(body.imported).toBe(2);

      // Verify DB products
      const count = await Product.countDocuments();
      expect(count).toBe(2);

      // Verify AuditLog entry
      const log = await AuditLog.findOne({ action: "PRODUCT_CSV_IMPORT" }).lean();
      expect(log).not.toBeNull();
      expect(log?.actor).toBe(adminId);
      expect(log?.targetType).toBe("Product");
      expect((log?.meta as Record<string, unknown>)?.["importedCount"]).toBe(2);
    });
  });
});
