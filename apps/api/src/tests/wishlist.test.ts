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
import { generateAccessToken } from "../lib/token.js";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

interface WishlistResponse {
  products: Array<{ _id: string; title: string }>;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

describe("Wishlist API (/api/v1/wishlist)", () => {
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
    ]);
  });

  async function createTestUser(emailPrefix: string): Promise<{ user: IUser; token: string }> {
    const user = await User.create({
      name: `User ${emailPrefix}`,
      email: `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@yourstore.in`,
      passwordHash: "dummyHashForTesting123!",
      role: "user",
      emailVerified: true,
      addresses: [],
      cart: [],
      wishlist: [],
    });

    const token = generateAccessToken({ sub: user._id.toString(), role: user.role, email: user.email });
    return { user, token };
  }

  it("requires authentication for GET, POST, and DELETE", async () => {
    const getRes = await request(app).get("/api/v1/wishlist");
    expect(getRes.status).toBe(401);

    const postRes = await request(app)
      .post("/api/v1/wishlist")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ productId: new Types.ObjectId().toString() });
    expect(postRes.status).toBe(401);

    const deleteRes = await request(app)
      .delete(`/api/v1/wishlist/${new Types.ObjectId().toString()}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(deleteRes.status).toBe(401);
  });

  it("user A cannot affect user B's wishlist", async () => {
  const { token: tokenA } = await createTestUser("usera");
const { token: tokenB } = await createTestUser("userb");

    const product1 = await Product.create({
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

    const product2 = await Product.create({
      title: "Product 2",
      slug: "prod-2",
      description: "Desc",
      category: "gadgets",
      brand: "Brand",
      basePrice: 2000,
      stock: 5,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    // User A adds product1 to wishlist
    const addResA = await request(app)
      .post("/api/v1/wishlist")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ productId: product1._id.toString() });
    expect(addResA.status).toBe(200);

    // User B adds product2 to wishlist
    const addResB = await request(app)
      .post("/api/v1/wishlist")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ productId: product2._id.toString() });
    expect(addResB.status).toBe(200);

    // User A views wishlist — only product 1 is present
    const getResA = await request(app)
      .get("/api/v1/wishlist")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(getResA.status).toBe(200);
    const bodyA = getResA.body as WishlistResponse;
    expect(bodyA.products).toHaveLength(1);
    expect(bodyA.products[0]?._id).toBe(product1._id.toString());

    // User B views wishlist — only product 2 is present
    const getResB = await request(app)
      .get("/api/v1/wishlist")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(getResB.status).toBe(200);
    const bodyB = getResB.body as WishlistResponse;
    expect(bodyB.products).toHaveLength(1);
    expect(bodyB.products[0]?._id).toBe(product2._id.toString());

    // User A tries to delete product 2 (which is in user B's wishlist, not user A's)
    const delResA = await request(app)
      .delete(`/api/v1/wishlist/${product2._id.toString()}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(delResA.status).toBe(200);

    // User B's wishlist is unaffected
    const checkB = await request(app)
      .get("/api/v1/wishlist")
      .set("Authorization", `Bearer ${tokenB}`);
    expect((checkB.body as WishlistResponse).products).toHaveLength(1);
  });

  it("cap at 100 items is enforced", async () => {
    const { user, token } = await createTestUser("capped_user");

    // Populate user's wishlist with 100 dummy ObjectIds
    const hundredIds = Array.from({ length: 100 }, () => new Types.ObjectId());
    await User.updateOne({ _id: user._id }, { $set: { wishlist: hundredIds } });

    // Create the 101st product
    const product101 = await Product.create({
      title: "Product 101",
      slug: "prod-101",
      description: "Desc",
      category: "gadgets",
      brand: "Brand",
      basePrice: 500,
      stock: 10,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    // Attempt to add 101st product to wishlist
    const res = await request(app)
      .post("/api/v1/wishlist")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ productId: product101._id.toString() });

    expect(res.status).toBe(400);
    const body = res.body as ErrorResponse;
    expect(body.error.message).toContain("cannot exceed 100 items");
  });

  it("skips inactive products in GET", async () => {
    const { token } = await createTestUser("inactive_test");

    const activeProd = await Product.create({
      title: "Active Item",
      slug: "active-item",
      description: "Desc",
      category: "gadgets",
      brand: "Brand",
      basePrice: 500,
      stock: 10,
      listingType: "purchasable",
      isActive: true,
      variants: [],
    });

    const inactiveProd = await Product.create({
      title: "Inactive Item",
      slug: "inactive-item",
      description: "Desc",
      category: "gadgets",
      brand: "Brand",
      basePrice: 500,
      stock: 10,
      listingType: "purchasable",
      isActive: false,
      variants: [],
    });

    // Add active
    await request(app)
      .post("/api/v1/wishlist")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ productId: activeProd._id.toString() });

    // Manually push inactive to wishlist array
    const userDoc = await User.findOne({ email: { $regex: "inactive_test" } });
    if (userDoc) {
      userDoc.wishlist.push(inactiveProd._id);
      await userDoc.save();
    }

    const res = await request(app)
      .get("/api/v1/wishlist")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const body = res.body as WishlistResponse;
    expect(body.products).toHaveLength(1);
    expect(body.products[0]?._id).toBe(activeProd._id.toString());
  });
});
