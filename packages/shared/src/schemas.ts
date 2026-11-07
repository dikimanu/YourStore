import { z } from "zod";
import { CATEGORIES, ORDER_STATUSES, LISTING_TYPES, USER_ROLES } from "./constants.js";

// ---- Image ----
export const ImageSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  alt: z.string().default(""),
});

// ---- Category attributes ----
export const ElectronicsAttributesSchema = z.object({
  storage: z.string().optional(),
  ram: z.string().optional(),
  warranty: z.string().optional(),
  powerRating: z.string().optional(),
});

export const ClothingAttributesSchema = z.object({
  gender: z.enum(["men", "women", "unisex", "kids"]).optional(),
  ageGroup: z.string().optional(),
  material: z.string().optional(),
});

export const VehiclesAttributesSchema = z.object({
  modelYear: z.number().int().optional(),
  mileage: z.string().optional(),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "cng"]).optional(),
  transmission: z.enum(["manual", "automatic"]).optional(),
  condition: z.enum(["new", "used"]).optional(),
});

export const HomeAttributesSchema = z.object({
  dimensions: z.string().optional(),
  weight: z.string().optional(),
  material: z.string().optional(),
});

export const GadgetsAttributesSchema = z.object({
  storage: z.string().optional(),
  ram: z.string().optional(),
  warranty: z.string().optional(),
});

// ---- Variant ----
export const VariantSchema = z.object({
  sku: z.string().min(1),
  options: z.object({
    size: z.string().optional(),
    color: z.string().optional(),
  }),
  priceOverride: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative(),
});

// ---- Product ----
export const ProductSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(CATEGORIES),
  brand: z.string().min(1),
  basePrice: z.number().nonnegative(),
  images: z.array(ImageSchema).max(6),
  variants: z.array(VariantSchema).default([]),
  stock: z.number().int().nonnegative().optional(),
  listingType: z.enum(LISTING_TYPES).default("purchasable"),
  ratingAvg: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

// ---- Order item snapshot ----
export const OrderItemSchema = z.object({
  productId: z.string(),
  variantSku: z.string().optional(),
  title: z.string(),
  image: z.string().url().optional(),
  unitPrice: z.number().nonnegative(),
  qty: z.number().int().positive(),
});

// ---- Pricing ----
export const PricingSchema = z.object({
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

// ---- Order ----
export const OrderStatusSchema = z.enum(ORDER_STATUSES);

export const OrderSchema = z.object({
  user: z.string(),
  items: z.array(OrderItemSchema).min(1),
  pricing: PricingSchema,
  payment: z.object({
    method: z.enum(["stripe", "cod"]),
    status: z.enum(["pending", "paid", "failed", "refunded"]),
    stripeSessionId: z.string().optional(),
    paymentIntentId: z.string().optional(),
  }),
  status: OrderStatusSchema,
});

// ---- Review ----
export const ReviewSchema = z.object({
  user: z.string(),
  product: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(100),
  body: z.string().min(10).max(2000),
});

// ---- Coupon ----
export const CouponSchema = z.object({
  code: z.string().min(1).toUpperCase(),
  type: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  minOrder: z.number().nonnegative().default(0),
  expiresAt: z.coerce.date(),
  usageLimit: z.number().int().positive(),
  usedCount: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

// ---- User ----
export const UserRoleSchema = z.enum(USER_ROLES);

export const AddressSchema = z.object({
  label: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(10),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(6).max(6),
});
