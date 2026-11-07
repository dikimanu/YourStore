import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { User, IUser } from "../models/User.js";
import { Product, IProduct } from "../models/Product.js";
import { Coupon, ICoupon } from "../models/Coupon.js";
import { generateAccessToken } from "../lib/token.js";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

const idToString = (v: string | Types.ObjectId): string =>
  typeof v === "string" ? v : v.toHexString();

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface AddressDto {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

interface SingleAddressBody {
  address: AddressDto;
}

interface AddressesListBody {
  addresses: AddressDto[];
}

interface CartItemDto {
  productId: string;
  variantSku?: string;
  title: string;
  slug: string;
  image?: string;
  price: number;
  stock: number;
  qty: number;
  lineTotal: number;
}

interface CartBody {
  items: CartItemDto[];
  itemCount: number;
  subtotal: number;
}

interface CouponValidationBody {
  valid: boolean;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrder: number;
  discount: number;
  newSubtotal: number;
}

describe("Phase 3 Part A: Cart, Addresses & Coupon Validation", () => {
  const memoryUsers = new Map<string, IUser>();
  const memoryProducts = new Map<string, IProduct>();
  const memoryCoupons = new Map<string, ICoupon>();

  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  beforeEach(() => {
    memoryUsers.clear();
    memoryProducts.clear();
    memoryCoupons.clear();
    vi.restoreAllMocks();

    userAId = new Types.ObjectId().toString();
    userBId = new Types.ObjectId().toString();

    const userA = {
      _id: new Types.ObjectId(userAId),
      name: "User A",
      email: "usera@example.com",
      role: "user",
      emailVerified: true,
      addresses: [],
      cart: [],
      failedLoginCount: 0,
      isLocked: () => false,
      save: function (this: IUser) {
        memoryUsers.set(userAId, this);
        return Promise.resolve(this);
      },
    } as unknown as IUser;

    const userB = {
      _id: new Types.ObjectId(userBId),
      name: "User B",
      email: "userb@example.com",
      role: "user",
      emailVerified: true,
      addresses: [],
      cart: [],
      failedLoginCount: 0,
      isLocked: () => false,
      save: function (this: IUser) {
        memoryUsers.set(userBId, this);
        return Promise.resolve(this);
      },
    } as unknown as IUser;

    memoryUsers.set(userAId, userA);
    memoryUsers.set(userBId, userB);

    userAToken = generateAccessToken({ sub: userAId, role: "user", email: userA.email });
    userBToken = generateAccessToken({ sub: userBId, role: "user", email: userB.email });

    // Mock User.findById
    vi.spyOn(User, "findById").mockImplementation((id: unknown) => {
      const user = id ? memoryUsers.get(idToString(id as string | Types.ObjectId)) : null;
      return {
        select: vi.fn().mockImplementation(() => Promise.resolve(user ?? null)),
        then: (resolve: (val: unknown) => void) => Promise.resolve(user ?? null).then(resolve),
      } as unknown as ReturnType<typeof User.findById>;
    });

    // Mock Product.findById
    vi.spyOn(Product, "findById").mockImplementation((id: unknown) => {
      const prod = id ? memoryProducts.get(idToString(id as string | Types.ObjectId)) : null;
      return Promise.resolve(prod ?? null) as unknown as ReturnType<typeof Product.findById>;
    });

    // Mock Product.find
    vi.spyOn(Product, "find").mockImplementation((filter?: unknown) => {
      const f = (filter || {}) as { _id?: { $in?: unknown[] } };
      let prods = Array.from(memoryProducts.values());
      if (f._id && f._id.$in) {
        const idStrings = new Set(f._id.$in.map((id) => idToString(id as string | Types.ObjectId)));
        prods = prods.filter((p) => idStrings.has(idToString(p._id as string | Types.ObjectId)));
      }
      return Promise.resolve(prods) as unknown as ReturnType<typeof Product.find>;
    });

    // Mock Coupon.findOne
    vi.spyOn(Coupon, "findOne").mockImplementation((filter?: unknown) => {
      const f = (filter || {}) as { code?: string };
      let found: ICoupon | null = null;
      if (f.code) {
        found = memoryCoupons.get(f.code.toUpperCase()) ?? null;
      }
      return Promise.resolve(found) as unknown as ReturnType<typeof Coupon.findOne>;
    });
  });

  describe("1. Address IDOR Security Checks", () => {
    let addressAId: string;

    beforeEach(async () => {
      // Create an address for User A
      const res = await request(app)
        .post("/api/v1/addresses")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          label: "Home",
          name: "User A",
          phone: "9876543210",
          line1: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        });

      expect(res.status).toBe(201);
      const body = res.body as SingleAddressBody;
      addressAId = body.address.id;
    });

    it("allows User A to read their own address", async () => {
      const res = await request(app)
        .get(`/api/v1/addresses/${addressAId}`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      const body = res.body as SingleAddressBody;
      expect(body.address.line1).toBe("123 MG Road");
    });

    it("prevents User B from reading User A's address (IDOR prevented with 404)", async () => {
      const res = await request(app)
        .get(`/api/v1/addresses/${addressAId}`)
        .set("Authorization", `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      const body = res.body as ErrorBody;
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("prevents User B from editing User A's address", async () => {
      const res = await request(app)
        .put(`/api/v1/addresses/${addressAId}`)
        .set("Authorization", `Bearer ${userBToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          line1: "Hacked Address Line",
        });

      expect(res.status).toBe(404);
      const body = res.body as ErrorBody;
      expect(body.error.code).toBe("NOT_FOUND");

      // Verify User A's address remains unchanged
      const checkRes = await request(app)
        .get(`/api/v1/addresses/${addressAId}`)
        .set("Authorization", `Bearer ${userAToken}`);
      const checkBody = checkRes.body as SingleAddressBody;
      expect(checkBody.address.line1).toBe("123 MG Road");
    });

    it("prevents User B from deleting User A's address", async () => {
      const res = await request(app)
        .delete(`/api/v1/addresses/${addressAId}`)
        .set("Authorization", `Bearer ${userBToken}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(res.status).toBe(404);
      const body = res.body as ErrorBody;
      expect(body.error.code).toBe("NOT_FOUND");

      // Verify User A still has the address
      const listRes = await request(app)
        .get("/api/v1/addresses")
        .set("Authorization", `Bearer ${userAToken}`);
      const listBody = listRes.body as AddressesListBody;
      expect(listBody.addresses).toHaveLength(1);
    });

    it("enforces max 5 addresses limit", async () => {
      const userA = memoryUsers.get(userAId)!;
      // Add 4 more addresses so count reaches 5
      for (let i = 2; i <= 5; i++) {
        userA.addresses.push({
          _id: new Types.ObjectId(),
          label: `Address ${i}`,
          name: "User A",
          phone: "9876543210",
          line1: `Line ${i}`,
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        });
      }

      const res = await request(app)
        .post("/api/v1/addresses")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          label: "Address 6",
          name: "User A",
          phone: "9876543210",
          line1: "Overflow line",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("Cannot save more than 5 addresses");
    });

    it("validates Indian phone and 6-digit pincode with Zod", async () => {
      const invalidPhoneRes = await request(app)
        .post("/api/v1/addresses")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          label: "Office",
          name: "User A",
          phone: "12345", // Invalid phone
          line1: "MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        });

      expect(invalidPhoneRes.status).toBe(400);
      const invalidPhoneBody = invalidPhoneRes.body as ErrorBody;
      expect(invalidPhoneBody.error.code).toBe("VALIDATION_ERROR");

      const invalidPincodeRes = await request(app)
        .post("/api/v1/addresses")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          label: "Office",
          name: "User A",
          phone: "9876543210",
          line1: "MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "060001", // Invalid pincode starting with 0
        });

      expect(invalidPincodeRes.status).toBe(400);
      const invalidPincodeBody = invalidPincodeRes.body as ErrorBody;
      expect(invalidPincodeBody.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("2. Server-side Cart & Security Checks", () => {
    let purchasableProductId: string;
    let enquiryProductId: string;
    let outOfStockProductId: string;
    let variantProductId: string;

    beforeEach(() => {
      purchasableProductId = new Types.ObjectId().toString();
      enquiryProductId = new Types.ObjectId().toString();
      outOfStockProductId = new Types.ObjectId().toString();
      variantProductId = new Types.ObjectId().toString();

      // Standard purchasable product
      memoryProducts.set(purchasableProductId, {
        _id: new Types.ObjectId(purchasableProductId),
        title: "Mechanical Keyboard",
        slug: "mechanical-keyboard",
        category: "gadgets",
        brand: "Keychron",
        basePrice: 5000,
        stock: 15,
        listingType: "purchasable",
        isActive: true,
        images: [{ url: "https://example.com/k1.jpg", publicId: "k1", alt: "Keyboard" }],
        variants: [],
      } as unknown as IProduct);

      // Enquiry-only product (vehicles)
      memoryProducts.set(enquiryProductId, {
        _id: new Types.ObjectId(enquiryProductId),
        title: "Electric Scooter",
        slug: "electric-scooter",
        category: "vehicles",
        brand: "Ather",
        basePrice: 150000,
        stock: 5,
        listingType: "enquiry",
        isActive: true,
        images: [],
        variants: [],
      } as unknown as IProduct);

      // Out of stock product
      memoryProducts.set(outOfStockProductId, {
        _id: new Types.ObjectId(outOfStockProductId),
        title: "Vintage Camera",
        slug: "vintage-camera",
        category: "gadgets",
        brand: "Canon",
        basePrice: 25000,
        stock: 0,
        listingType: "purchasable",
        isActive: true,
        images: [],
        variants: [],
      } as unknown as IProduct);

      // Product with variants
      memoryProducts.set(variantProductId, {
        _id: new Types.ObjectId(variantProductId),
        title: "Cotton T-Shirt",
        slug: "cotton-t-shirt",
        category: "clothing",
        brand: "Nike",
        basePrice: 1000,
        listingType: "purchasable",
        isActive: true,
        images: [],
        variants: [
          { sku: "TSHIRT-RED-M", options: { size: "M", color: "Red" }, priceOverride: 1200, stock: 8 },
          { sku: "TSHIRT-BLUE-L", options: { size: "L", color: "Blue" }, stock: 0 },
        ],
      } as unknown as IProduct);
    });

    it("adds item to cart and always uses server price (never trusts client)", async () => {
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          productId: purchasableProductId,
          qty: 2,
          price: 1,
        });

      expect(res.status).toBe(200);
      const body = res.body as CartBody;
      expect(body.items).toHaveLength(1);
      const firstItem = body.items[0];
      expect(firstItem).toBeDefined();
      expect(firstItem?.price).toBe(5000);
      expect(firstItem?.qty).toBe(2);
      expect(firstItem?.lineTotal).toBe(10000);
      expect(body.subtotal).toBe(10000);
    });

    it("rejects non-purchasable products (e.g. vehicles listingType = enquiry)", async () => {
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          productId: enquiryProductId,
          qty: 1,
        });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("not available for direct purchase");
    });

    it("rejects out of stock products", async () => {
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          productId: outOfStockProductId,
          qty: 1,
        });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("out of stock");
    });

    it("caps quantity per line at 10", async () => {
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          productId: purchasableProductId,
          qty: 15,
        });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("merges guest cart into server cart after login", async () => {
      // First, user already has 1 keyboard in cart
      await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          productId: purchasableProductId,
          qty: 1,
        });

      // Now merge a guest cart containing another keyboard and a variant t-shirt
      const mergeRes = await request(app)
        .post("/api/v1/cart/merge")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          items: [
            { productId: purchasableProductId, qty: 2 },
            { productId: variantProductId, variantSku: "TSHIRT-RED-M", qty: 3 },
          ],
        });

      expect(mergeRes.status).toBe(200);
      const body = mergeRes.body as CartBody;
      expect(body.items).toHaveLength(2);

      const keyboardLine = body.items.find(
        (i) => i.productId === purchasableProductId,
      );
      expect(keyboardLine?.qty).toBe(3); // 1 + 2

      const tshirtLine = body.items.find(
        (i) => i.variantSku === "TSHIRT-RED-M",
      );
      expect(tshirtLine?.qty).toBe(3);
      expect(tshirtLine?.price).toBe(1200); // priceOverride
    });
  });

  describe("3. Coupon Validation Edge Cases", () => {
    beforeEach(() => {
      // Valid coupon
      memoryCoupons.set("SAVE20", {
        code: "SAVE20",
        type: "percent",
        value: 20,
        minOrder: 1000,
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
        usageLimit: 100,
        usedCount: 5,
        isActive: true,
      } as ICoupon);

      // Expired coupon
      memoryCoupons.set("EXPIRED10", {
        code: "EXPIRED10",
        type: "percent",
        value: 10,
        minOrder: 500,
        expiresAt: new Date(Date.now() - 86400000), // yesterday
        usageLimit: 50,
        usedCount: 0,
        isActive: true,
      } as ICoupon);

      // Usage limit reached coupon
      memoryCoupons.set("MAXEDOUT", {
        code: "MAXEDOUT",
        type: "fixed",
        value: 200,
        minOrder: 500,
        expiresAt: new Date(Date.now() + 86400000),
        usageLimit: 10,
        usedCount: 10,
        isActive: true,
      } as ICoupon);

      // Inactive coupon
      memoryCoupons.set("INACTIVE", {
        code: "INACTIVE",
        type: "percent",
        value: 50,
        minOrder: 100,
        expiresAt: new Date(Date.now() + 86400000),
        usageLimit: 100,
        usedCount: 0,
        isActive: false,
      } as ICoupon);
    });

    it("validates valid percent coupon and computes discount correctly", async () => {
      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          code: "SAVE20",
          subtotal: 2000,
        });

      expect(res.status).toBe(200);
      const body = res.body as CouponValidationBody;
      expect(body.valid).toBe(true);
      expect(body.discount).toBe(400); // 20% of 2000
      expect(body.newSubtotal).toBe(1600);

      // Verify usedCount was NOT incremented
      expect(memoryCoupons.get("SAVE20")!.usedCount).toBe(5);
    });

    it("rejects expired coupon", async () => {
      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          code: "EXPIRED10",
          subtotal: 1500,
        });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("expired");
    });

    it("rejects coupon when subtotal is below minOrder", async () => {
      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          code: "SAVE20",
          subtotal: 800, // Below minOrder of 1000
        });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("Minimum order amount");
    });

    it("rejects coupon when usage limit is reached", async () => {
      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          code: "MAXEDOUT",
          subtotal: 1000,
        });

      expect(res.status).toBe(400);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("usage limit has been reached");
    });

    it("rejects inactive coupon with 404", async () => {
      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          code: "INACTIVE",
          subtotal: 1000,
        });

      expect(res.status).toBe(404);
      const body = res.body as ErrorBody;
      expect(body.error.message).toContain("Coupon not found or inactive");
    });
  });
});
