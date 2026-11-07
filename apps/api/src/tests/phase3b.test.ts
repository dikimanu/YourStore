import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose, { Types } from "mongoose";
import { User, IUser, IAddress } from "../models/User.js";
import { Product } from "../models/Product.js";
import { Coupon } from "../models/Coupon.js";
import { Order, type IOrder } from "../models/Order.js";
import { createOrderFromCart, restoreStock } from "../services/order.js";

process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["SHIPPING_FLAT"] = "50";
process.env["FREE_SHIPPING_THRESHOLD"] = "500";
process.env["TAX_PERCENT"] = "18";
process.env["VITEST"] = "true";

describe("Phase 3 Part B: Order Service, Atomic Stock & Coupons (Real In-Memory MongoDB)", () => {
  beforeAll(async () => {
    const mongoUriTest = process.env["MONGO_URI_TEST"];
    if (!mongoUriTest) {
      throw new Error(
        "Missing required environment variable MONGO_URI_TEST for test execution.",
      );
    }

    const cleanUri = mongoUriTest.split("?")[0] || "";
    const dbName = cleanUri.substring(cleanUri.lastIndexOf("/") + 1);

    if (!dbName.endsWith("_test")) {
      throw new Error(
        `Safety check failed: database name "${dbName}" in MONGO_URI_TEST must end with "_test" to prevent accidental data loss.`,
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
      Coupon.deleteMany({}),
      Order.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  async function createTestUser(): Promise<{ user: IUser; addressId: string }> {
    const addressId = new Types.ObjectId();
    const sampleAddress: IAddress = {
      _id: addressId,
      label: "Home",
      name: "Satyabrata Pal",
      phone: "9876543210",
      line1: "123 Indiranagar 100ft Rd",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
    };

    const user = await User.create({
      name: "Satyabrata Pal",
      email: `satya_${Date.now()}_${Math.random().toString(36).substring(7)}@yourstore.in`,
      passwordHash: "dummyHashForTesting123!",
      role: "user",
      emailVerified: true,
      addresses: [sampleAddress],
      cart: [],
    });

    return { user, addressId: addressId.toString() };
  }

  it("1. Server loads DB prices and ignores any client price tampering", async () => {
    const { user, addressId } = await createTestUser();

    const product = await Product.create({
      title: "Noise-Cancelling Headphones",
      slug: "noise-cancelling-headphones",
      description: "Premium headphones with ANC",
      category: "gadgets",
      brand: "Sony",
      basePrice: 20000,
      stock: 5,
      listingType: "purchasable",
      isActive: true,
      variants: [],
      images: [{ url: "https://example.com/h.jpg", publicId: "h", alt: "Headphones" }],
    });

    user.cart = [
      {
        productId: product._id,
        qty: 1,
      },
    ];
    await user.save();

    const order = await createOrderFromCart(user._id.toString(), addressId, undefined, "cod");

    expect(order.items[0]?.unitPrice).toBe(20000);
    expect(order.pricing.subtotal).toBe(20000);
    // Subtotal >= 500 => free shipping (0)
    expect(order.pricing.shipping).toBe(0);
    // Tax 18% of 20000 = 3600
    expect(order.pricing.tax).toBe(3600);
    expect(order.pricing.total).toBe(23600);
    expect(order.status).toBe("Placed");

    // Stock should have been atomically decremented from 5 to 4
    const updatedProd = await Product.findById(product._id);
    expect(updatedProd?.stock).toBe(4);
  });

  it("2. Rejects enquiry-only products (e.g. vehicles)", async () => {
    const { user, addressId } = await createTestUser();

    const vehicle = await Product.create({
      title: "Electric Motorcycle",
      slug: "electric-motorcycle",
      description: "High performance EV bike",
      category: "vehicles",
      brand: "Ultraviolette",
      basePrice: 380000,
      stock: 3,
      listingType: "enquiry",
      isActive: true,
      variants: [],
      images: [],
    });

    user.cart = [{ productId: vehicle._id, qty: 1 }];
    await user.save();

    await expect(createOrderFromCart(user._id.toString(), addressId, undefined, "stripe")).rejects.toThrow(
      /enquiry-only and cannot be purchased/,
    );
  });

  it("3. Concurrent purchase of the last item with Promise.allSettled (stock never negative, exactly one order succeeds)", async () => {
    const { user: userA, addressId: addressIdA } = await createTestUser();
    const { user: userB, addressId: addressIdB } = await createTestUser();

    const product = await Product.create({
      title: "Limited Edition Mechanical Keyboard",
      slug: "limited-keyboard",
      description: "Custom keycaps and switches",
      category: "gadgets",
      brand: "Keychron",
      basePrice: 8000,
      stock: 1, // Exactly 1 item in stock
      listingType: "purchasable",
      isActive: true,
      variants: [],
      images: [],
    });

    userA.cart = [{ productId: product._id, qty: 1 }];
    await userA.save();

    userB.cart = [{ productId: product._id, qty: 1 }];
    await userB.save();

    // Two concurrent checkouts for the last item
    const results = await Promise.allSettled([
      createOrderFromCart(userA._id.toString(), addressIdA, undefined, "cod"),
      createOrderFromCart(userB._id.toString(), addressIdB, undefined, "cod"),
    ]);

    const successful = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(1);

    // Stock must be exactly 0, never negative
    const productAfter = await Product.findById(product._id);
    expect(productAfter?.stock).toBe(0);

    // Exactly 1 order created in DB
    const orderCount = await Order.countDocuments();
    expect(orderCount).toBe(1);
  });

  it("4. Stock is restored when a later line fails", async () => {
    const { user, addressId } = await createTestUser();

    // Line 1: in stock (5 available)
    const product1 = await Product.create({
      title: "Gaming Mouse",
      slug: "gaming-mouse",
      description: "Optical sensor mouse",
      category: "gadgets",
      brand: "Logitech",
      basePrice: 3000,
      stock: 5,
      listingType: "purchasable",
      isActive: true,
      variants: [],
      images: [],
    });

    // Line 2: out of stock (0 available)
    const product2 = await Product.create({
      title: "Mousepad XXL",
      slug: "mousepad-xxl",
      description: "Large desk pad",
      category: "gadgets",
      brand: "SteelSeries",
      basePrice: 1500,
      stock: 0,
      listingType: "purchasable",
      isActive: true,
      variants: [],
      images: [],
    });

    user.cart = [
      { productId: product1._id, qty: 2 },
      { productId: product2._id, qty: 1 },
    ];
    await user.save();

    await expect(createOrderFromCart(user._id.toString(), addressId, undefined, "stripe")).rejects.toThrow(
      /Insufficient stock for "Mousepad XXL"/,
    );

    // Verify Line 1 stock was decremented then rolled back to 5
    const prod1After = await Product.findById(product1._id);
    expect(prod1After?.stock).toBe(5);

    // No order should have been created in database
    const orderCount = await Order.countDocuments();
    expect(orderCount).toBe(0);
  });

  it("5. Coupon usage limit under concurrency: exactly usageLimit orders succeed", async () => {
    const { user: userA, addressId: addressIdA } = await createTestUser();
    const { user: userB, addressId: addressIdB } = await createTestUser();

    const product = await Product.create({
      title: "Coffee Mug",
      slug: "coffee-mug",
      description: "Ceramic cup",
      category: "home",
      brand: "YourStore",
      basePrice: 500,
      stock: 50,
      listingType: "purchasable",
      isActive: true,
      variants: [],
      images: [],
    });

    // Coupon with usageLimit = 1
    const coupon = await Coupon.create({
      code: "FLAT100",
      type: "fixed",
      value: 100,
      minOrder: 300,
      expiresAt: new Date(Date.now() + 86400000),
      usageLimit: 1,
      usedCount: 0,
      isActive: true,
    });

    userA.cart = [{ productId: product._id, qty: 1 }];
    await userA.save();

    userB.cart = [{ productId: product._id, qty: 1 }];
    await userB.save();

    // Two users simultaneously race to claim the single-use coupon
    const results = await Promise.allSettled([
      createOrderFromCart(userA._id.toString(), addressIdA, "FLAT100", "cod"),
      createOrderFromCart(userB._id.toString(), addressIdB, "FLAT100", "cod"),
    ]);

    const successful = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const couponAfter = await Coupon.findById(coupon._id);
    expect(couponAfter?.usedCount).toBe(1);
  });

  it("6. restoreStock correctly restores base and variant stocks", async () => {
    const product1 = await Product.create({
      title: "Smart Lamp",
      slug: "smart-lamp",
      description: "Dimmable LED lamp",
      category: "home",
      brand: "Philips",
      basePrice: 2000,
      stock: 4,
      listingType: "purchasable",
      isActive: true,
      variants: [],
      images: [],
    });

    const product2 = await Product.create({
      title: "T-Shirt",
      slug: "t-shirt",
      description: "Cotton tee",
      category: "clothing",
      brand: "Nike",
      basePrice: 1000,
      listingType: "purchasable",
      isActive: true,
      images: [],
      variants: [
        { sku: "TSHIRT-BLK-L", options: { size: "L", color: "Black" }, stock: 3 },
      ],
    });

    const fakeOrder = {
      items: [
        {
          productId: product1._id,
          title: product1.title,
          unitPrice: product1.basePrice,
          qty: 2,
        },
        {
          productId: product2._id,
          variantSku: "TSHIRT-BLK-L",
          title: product2.title,
          unitPrice: product2.basePrice,
          qty: 1,
        },
      ],
    } as unknown as IOrder;

    await restoreStock(fakeOrder);

    const prod1 = await Product.findById(product1._id);
    expect(prod1?.stock).toBe(6); // 4 + 2

    const prod2 = await Product.findById(product2._id);
    expect(prod2?.variants[0]?.stock).toBe(4); // 3 + 1
  });
});
