import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { Product, IProduct } from "../models/Product.js";
import { User, IUser } from "../models/User.js";
import { generateAccessToken } from "../lib/token.js";

// Ensure environment variables are loaded
process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

const idToString = (v: string | Types.ObjectId): string =>
  typeof v === "string" ? v : v.toHexString();

type MockProduct = Record<string, unknown> & { _id: Types.ObjectId | string };

describe("Phase 2 Part A: Products & Admin CRUD", () => {
  const memoryProducts = new Map<string, IProduct>();
  const memoryUsers = new Map<string, IUser>();

  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    memoryProducts.clear();
    memoryUsers.clear();
    vi.restoreAllMocks();

    // Mock User findById for authenticate middleware
    vi.spyOn(User, "findById").mockImplementation((id: unknown) => {
      const user = id ? memoryUsers.get(idToString(id as string | Types.ObjectId)) : null;
      return {
        select: vi.fn().mockImplementation(() => Promise.resolve(user ?? null)),
        then: (resolve: (val: unknown) => void) => Promise.resolve(user ?? null).then(resolve),
      } as unknown as ReturnType<typeof User.findById>;
    });

    // Mock Product.find
    vi.spyOn(Product, "find").mockImplementation((filter?: unknown, _projection?: unknown) => {
      const f = (filter || {}) as Record<string, unknown>;
      let results = Array.from(memoryProducts.values());

      // Filter by isActive
      if (f["isActive"] !== undefined) {
        results = results.filter((p) => p.isActive === f["isActive"]);
      }

      // Filter by category
      if (f["category"]) {
        results = results.filter((p) => p.category === f["category"]);
      }

      // Filter by brand
      if (f["brand"]) {
        results = results.filter((p) => p.brand === f["brand"]);
      }

      // Filter by search / text
      if (f["$text"]) {
        const text = ((f["$text"] as { $search: string }).$search || "").toLowerCase();
        results = results.filter(
          (p) =>
            p.title.toLowerCase().includes(text) ||
            p.description.toLowerCase().includes(text),
        );
      }

      // Filter by regex or ($or)
      if (f["$or"] && Array.isArray(f["$or"])) {
        const orConditions = f["$or"] as Array<Record<string, unknown>>;
        results = results.filter((p) =>
          orConditions.some((c) => {
            const titleCond = c["title"];
            const brandCond = c["brand"];
            if (titleCond instanceof RegExp) return titleCond.test(p.title);
            if (brandCond instanceof RegExp) return brandCond.test(p.brand);
            if (c["stock"] && typeof c["stock"] === "object") {
              const gt = (c["stock"] as { $gt?: number }).$gt;
              if (gt !== undefined) return (p.stock || 0) > gt;
            }
            return false;
          }),
        );
      }

      // Filter by price
      if (f["basePrice"] && typeof f["basePrice"] === "object") {
        const bp = f["basePrice"] as { $gte?: number; $lte?: number };
        if (bp.$gte !== undefined) {
          const min = bp.$gte;
          results = results.filter((p) => p.basePrice >= min);
        }
        if (bp.$lte !== undefined) {
          const max = bp.$lte;
          results = results.filter((p) => p.basePrice <= max);
        }
      }

      // Exclude _id ($ne)
      if (f["_id"] && typeof f["_id"] === "object") {
        const ne = (f["_id"] as { $ne?: string | Types.ObjectId }).$ne;
        if (ne) {
          results = results.filter(
            (p) => idToString(p._id as string | Types.ObjectId) !== idToString(ne),
          );
        }
      }

      const chain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((n: number) => {
          results = results.slice(0, n);
          return chain;
        }),
        lean: vi.fn().mockImplementation((): Promise<MockProduct[]> =>
          Promise.resolve(
            results.map((p) => ({
              ...(p.toObject() as Record<string, unknown>),
              _id: p._id,
            })),
          ),
        ),
        then: (resolve: (val: unknown) => void) =>
          Promise.resolve(
            results.map((p) => ({
              ...(p.toObject() as Record<string, unknown>),
              _id: p._id,
            })),
          ).then(resolve),
      };

      return chain as unknown as ReturnType<typeof Product.find>;
    });

    // Mock Product.findOne
    vi.spyOn(Product, "findOne").mockImplementation((filter?: unknown) => {
      const f = (filter || {}) as Record<string, unknown>;
      const found = Array.from(memoryProducts.values()).find((p) => {
        if (f["slug"] && p.slug !== f["slug"]) return false;
        if (f["isActive"] !== undefined && p.isActive !== f["isActive"]) return false;
        if (f["_id"] && typeof f["_id"] === "object") {
          const ne = (f["_id"] as { $ne?: string | Types.ObjectId }).$ne;
          if (
            ne &&
            idToString(p._id) === idToString(ne)
          ) {
            return false;
          }
        }
        return true;
      });

      return {
        lean: vi.fn().mockImplementation((): Promise<MockProduct | null> =>
          Promise.resolve(
            found
              ? {
                  ...(found.toObject() as Record<string, unknown>),
                  _id: found._id as Types.ObjectId | string,
                }
              : null,
          ),
        ),
        then: (resolve: (val: unknown) => void) => Promise.resolve(found ?? null).then(resolve),
      } as unknown as ReturnType<typeof Product.findOne>;
    });

    // Mock Product.findById
    vi.spyOn(Product, "findById").mockImplementation((id: unknown) => {
      const product = id
        ? memoryProducts.get(idToString(id as string | Types.ObjectId))
        : null;
      return {
        lean: vi.fn().mockImplementation((): Promise<MockProduct | null> =>
          Promise.resolve(
            product
              ? {
                  ...(product.toObject() as Record<string, unknown>),
                  _id: product._id as Types.ObjectId | string,
                }
              : null,
          ),
        ),
        then: (resolve: (val: unknown) => void) => Promise.resolve(product ?? null).then(resolve),
      } as unknown as ReturnType<typeof Product.findById>;
    });

    // Mock Product.countDocuments
    vi.spyOn(Product, "countDocuments").mockImplementation((filter?: unknown) => {
      const f = (filter || {}) as Record<string, unknown>;
      let count = Array.from(memoryProducts.values()).length;
      if (f["isActive"] !== undefined) {
        count = Array.from(memoryProducts.values()).filter((p) => p.isActive === f["isActive"]).length;
      }
      return Promise.resolve(count) as unknown as ReturnType<typeof Product.countDocuments>;
    });

    // Mock Product save
    vi.spyOn(Product.prototype, "save").mockImplementation(function (this: IProduct) {
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      memoryProducts.set(this._id.toString(), this);
      return Promise.resolve(this);
    });

    // Seed mock Admin and User
    const adminUser = new User({
      name: "Admin User",
      email: "admin@yourstore.com",
      passwordHash: "hash",
      role: "admin",
    });
    adminUser._id = new Types.ObjectId();
    memoryUsers.set(adminUser._id.toString(), adminUser);
    adminToken = generateAccessToken({
      sub: adminUser._id.toString(),
      role: "admin",
      email: adminUser.email,
    });

    const standardUser = new User({
      name: "Standard Customer",
      email: "customer@yourstore.com",
      passwordHash: "hash",
      role: "user",
    });
    standardUser._id = new Types.ObjectId();
    memoryUsers.set(standardUser._id.toString(), standardUser);
    userToken = generateAccessToken({
      sub: standardUser._id.toString(),
      role: "user",
      email: standardUser.email,
    });

    // Seed sample products
    const p1 = new Product({
      title: "Noise Cancelling Headphones",
      slug: "noise-cancelling-headphones",
      description: "Premium wireless audio with active noise cancellation",
      category: "electronics",
      brand: "SoundMaster",
      basePrice: 14999,
      images: [{ url: "https://example.com/p1.jpg", publicId: "p1", alt: "Headphones" }],
      attributes: { warranty: "2 years", powerRating: "5W" },
      variants: [],
      stock: 25,
      listingType: "purchasable",
      ratingAvg: 4.8,
      ratingCount: 15,
      isActive: true,
    });
    await p1.save();

    const p2 = new Product({
      title: "Cotton Oxford Shirt",
      slug: "cotton-oxford-shirt",
      description: "100% breathable cotton shirt",
      category: "clothing",
      brand: "UrbanStyle",
      basePrice: 1999,
      images: [{ url: "https://example.com/p2.jpg", publicId: "p2", alt: "Shirt" }],
      attributes: { gender: "men", material: "cotton" },
      variants: [
        { sku: "SHIRT-BLU-M", options: { size: "M", color: "Blue" }, stock: 10 },
        { sku: "SHIRT-BLU-L", options: { size: "L", color: "Blue" }, stock: 5 },
      ],
      stock: 15,
      listingType: "purchasable",
      ratingAvg: 4.5,
      ratingCount: 8,
      isActive: true,
    });
    await p2.save();

    const p3 = new Product({
      title: "Vintage Electric Scooter",
      slug: "vintage-electric-scooter",
      description: "Eco-friendly commuter scooter",
      category: "vehicles",
      brand: "EcoRide",
      basePrice: 85000,
      images: [{ url: "https://example.com/p3.jpg", publicId: "p3", alt: "Scooter" }],
      attributes: { modelYear: 2024, fuelType: "electric", transmission: "automatic" },
      variants: [],
      stock: 2,
      listingType: "enquiry",
      ratingAvg: 5.0,
      ratingCount: 2,
      isActive: true,
    });
    await p3.save();
  });

  describe("Public Product Endpoints", () => {
    it("lists products with pagination metadata", async () => {
      const res = await request(app).get("/api/v1/products");

      expect(res.status).toBe(200);
      const body = res.body as {
        products: Array<{ title: string; category: string }>;
        pagination: { total: number; page: number; limit: number };
      };
      expect(body.products).toBeDefined();
      expect(body.products.length).toBeGreaterThanOrEqual(3);
      expect(body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(body.pagination.page).toBe(1);
    });

    it("filters products by category", async () => {
      const res = await request(app).get("/api/v1/products?category=electronics");

      expect(res.status).toBe(200);
      const body = res.body as { products: Array<{ category: string }> };
      expect(body.products.length).toBe(1);
      expect(body.products[0]?.category).toBe("electronics");
    });

    it("filters products by price range", async () => {
      const res = await request(app).get("/api/v1/products?minPrice=1000&maxPrice=5000");

      expect(res.status).toBe(200);
      const body = res.body as { products: Array<{ title: string; basePrice: number }> };
      expect(body.products.length).toBe(1);
      expect(body.products[0]?.basePrice).toBe(1999);
    });

    it("retrieves product detail by unique slug", async () => {
      const res = await request(app).get("/api/v1/products/noise-cancelling-headphones");

      expect(res.status).toBe(200);
      const body = res.body as { product: { slug: string; title: string; basePrice: number } };
      expect(body.product.slug).toBe("noise-cancelling-headphones");
      expect(body.product.title).toBe("Noise Cancelling Headphones");
      expect(body.product.basePrice).toBe(14999);
    });

    it("returns 404 for non-existent product slug", async () => {
      const res = await request(app).get("/api/v1/products/non-existent-product-xyz");

      expect(res.status).toBe(404);
      const body = res.body as { error: { code: string } };
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("provides search suggestions matching query", async () => {
      const res = await request(app).get("/api/v1/products/suggestions?q=Headphones");

      expect(res.status).toBe(200);
      const body = res.body as { suggestions: Array<{ title: string; slug: string }> };
      expect(body.suggestions).toBeDefined();
      expect(body.suggestions.some((s) => s.slug === "noise-cancelling-headphones")).toBe(true);
    });

    it("returns related products in same category", async () => {
      // Create a second electronics product to test related query
      const p4 = new Product({
        title: "Wireless Bluetooth Speaker",
        slug: "wireless-bluetooth-speaker",
        description: "Portable 20W stereo speaker",
        category: "electronics",
        brand: "SoundMaster",
        basePrice: 4999,
        images: [],
        attributes: {},
        variants: [],
        stock: 40,
        listingType: "purchasable",
        ratingAvg: 4.6,
        ratingCount: 10,
        isActive: true,
      });
      await p4.save();

      const headphones = Array.from(memoryProducts.values()).find((p) => p.slug === "noise-cancelling-headphones");
      const res = await request(app).get(`/api/v1/products/related/${headphones?._id.toString()}`);

      expect(res.status).toBe(200);
      const body = res.body as { products: Array<{ title: string; slug: string }> };
      expect(body.products.length).toBe(1);
      expect(body.products[0]?.slug).toBe("wireless-bluetooth-speaker");
    });
  });

  describe("Admin-Only Product Access Control", () => {
    it("denies unauthenticated requests to admin endpoints with 401 Unauthorized", async () => {
      const res = await request(app).get("/api/v1/admin/products");

      expect(res.status).toBe(401);
      const body = res.body as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("denies regular customer access to admin endpoints with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/products")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      const body = res.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("permission");
    });

    it("allows admin users to view all products including inactive", async () => {
      const res = await request(app)
        .get("/api/v1/admin/products")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const body = res.body as { products: Array<{ title: string }>; pagination: { total: number } };
      expect(body.products).toBeDefined();
      expect(body.pagination.total).toBeGreaterThanOrEqual(3);
    });

    it("allows admin to create a product with validated category attributes", async () => {
      const newProductData = {
        title: "Smart Ergonomic Chair",
        description: "Adjustable lumber support home office chair",
        category: "home",
        brand: "ComfortPlus",
        basePrice: 12999,
        images: [{ url: "https://example.com/chair.jpg", publicId: "chair-1", alt: "Chair" }],
        attributes: { material: "mesh", dimensions: "60x60x110cm", weight: "14kg" },
        stock: 12,
        listingType: "purchasable",
      };

      const res = await request(app)
        .post("/api/v1/admin/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send(newProductData);

      expect(res.status).toBe(201);
      const body = res.body as { product: { id: string; title: string; slug: string; category: string } };
      expect(body.product.id).toBeDefined();
      expect(body.product.title).toBe("Smart Ergonomic Chair");
      expect(body.product.slug).toBe("smart-ergonomic-chair");
      expect(body.product.category).toBe("home");
    });

    it("allows admin to update product fields", async () => {
      const product = Array.from(memoryProducts.values()).find((p) => p.slug === "cotton-oxford-shirt");
      const id = product?._id ? String(product._id) : "";

      const res = await request(app)
        .put(`/api/v1/admin/products/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          basePrice: 2499,
          stock: 20,
        });

      expect(res.status).toBe(200);
      const body = res.body as { product: { basePrice: number; stock: number } };
      expect(body.product.basePrice).toBe(2499);
      expect(body.product.stock).toBe(20);
    });

    it("performs soft delete (isActive = false) instead of removing document", async () => {
      const product = Array.from(memoryProducts.values()).find((p) => p.slug === "vintage-electric-scooter");
      const id = product?._id ? String(product._id) : "";

      const deleteRes = await request(app)
        .delete(`/api/v1/admin/products/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(deleteRes.status).toBe(200);
      const deleteBody = deleteRes.body as { success: boolean; product: { isActive: boolean } };
      expect(deleteBody.success).toBe(true);
      expect(deleteBody.product.isActive).toBe(false);

      // Verify the document still exists in memory but isActive is false
      const stored = memoryProducts.get(id);
      expect(stored).toBeDefined();
      expect(stored?.isActive).toBe(false);

      // Public endpoint should no longer return it
      const publicRes = await request(app).get("/api/v1/products/vintage-electric-scooter");
      expect(publicRes.status).toBe(404);
    });
  });
});
