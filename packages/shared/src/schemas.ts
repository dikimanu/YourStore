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
export type Address = z.infer<typeof AddressSchema>;

export const UserCartItemSchema = z.object({
  productId: z.string().min(1),
  variantSku: z.string().optional(),
  qty: z.number().int().positive(),
});
export type UserCartItem = z.infer<typeof UserCartItemSchema>;

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must not exceed 100 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address");

export const RegisterInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters"),
  email: EmailSchema,
  password: PasswordSchema,
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const ForgotPasswordInputSchema = z.object({
  email: EmailSchema,
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: PasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export const VerifyEmailInputSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});
export type VerifyEmailInput = z.infer<typeof VerifyEmailInputSchema>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  role: UserRoleSchema,
  emailVerified: z.boolean(),
  addresses: z.array(AddressSchema).default([]),
  wishlist: z.array(z.string()).default([]),
  cart: z.array(UserCartItemSchema).default([]),
  failedLoginCount: z.number().int().nonnegative().default(0),
  lockUntil: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type User = z.infer<typeof UserSchema>;

