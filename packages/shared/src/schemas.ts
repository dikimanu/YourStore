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

// ---- Category attribute schemas map ----
export const CategoryAttributesSchemas = {
  electronics: ElectronicsAttributesSchema,
  clothing: ClothingAttributesSchema,
  vehicles: VehiclesAttributesSchema,
  home: HomeAttributesSchema,
  gadgets: GadgetsAttributesSchema,
} as const;

export type CategoryAttributes = {
  electronics: z.infer<typeof ElectronicsAttributesSchema>;
  clothing: z.infer<typeof ClothingAttributesSchema>;
  vehicles: z.infer<typeof VehiclesAttributesSchema>;
  home: z.infer<typeof HomeAttributesSchema>;
  gadgets: z.infer<typeof GadgetsAttributesSchema>;
};

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
export type Variant = z.infer<typeof VariantSchema>;

// ---- Product ----
export const ProductSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(CATEGORIES),
  brand: z.string().min(1),
  basePrice: z.number().nonnegative(),
  images: z.array(ImageSchema).max(6).default([]),
  attributes: z.record(z.unknown()).default({}),
  variants: z.array(VariantSchema).default([]),
  stock: z.number().int().nonnegative().optional(),
  listingType: z.enum(LISTING_TYPES).default("purchasable"),
  ratingAvg: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});
export type Product = z.infer<typeof ProductSchema>;

export const CreateProductInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    slug: z.string().trim().min(1, "Slug is required").optional(),
    description: z.string().trim().min(1, "Description is required"),
    category: z.enum(CATEGORIES),
    brand: z.string().trim().min(1, "Brand is required"),
    basePrice: z.number().nonnegative("Base price must be >= 0"),
    images: z.array(ImageSchema).max(6, "Maximum 6 images allowed").default([]),
    attributes: z.record(z.unknown()).default({}),
    variants: z.array(VariantSchema).default([]),
    stock: z.number().int().nonnegative().optional(),
    listingType: z.enum(LISTING_TYPES).default("purchasable"),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // Validate attributes with the corresponding category schema
    const schema = CategoryAttributesSchemas[data.category];
    if (schema) {
      const res = schema.safeParse(data.attributes);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["attributes", ...issue.path],
          });
        }
      }
    }
  });
export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

export const UpdateProductInputSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    category: z.enum(CATEGORIES).optional(),
    brand: z.string().trim().min(1).optional(),
    basePrice: z.number().nonnegative().optional(),
    images: z.array(ImageSchema).max(6).optional(),
    attributes: z.record(z.unknown()).optional(),
    variants: z.array(VariantSchema).optional(),
    stock: z.number().int().nonnegative().optional(),
    listingType: z.enum(LISTING_TYPES).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category && data.attributes) {
      const schema = CategoryAttributesSchemas[data.category];
      if (schema) {
        const res = schema.safeParse(data.attributes);
        if (!res.success) {
          for (const issue of res.error.issues) {
            ctx.addIssue({
              ...issue,
              path: ["attributes", ...issue.path],
            });
          }
        }
      }
    }
  });
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

// Product query filters
export const ProductQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  category: z.enum(CATEGORIES).optional(),
  brand: z.string().trim().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  inStock: z.enum(["true", "false"]).optional(),
  listingType: z.enum(LISTING_TYPES).optional(),
  sort: z
    .enum(["price_asc", "price_desc", "rating", "newest", "title_asc"])
    .default("newest"),
});
export type ProductQuery = z.infer<typeof ProductQuerySchema>;

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

// ---- Upload Sign Schemas ----
export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const SignUploadInputSchema = z.object({
  fileType: z.enum(ALLOWED_UPLOAD_MIME_TYPES, {
    errorMap: () => ({
      message: "Unsupported file type. Allowed: JPEG, PNG, WebP, AVIF",
    }),
  }),
  fileSize: z
    .number()
    .int()
    .positive("File size must be positive")
    .max(10 * 1024 * 1024, "File size exceeds maximum limit of 10 MB"),
  imageCount: z
    .number()
    .int()
    .min(1, "At least 1 image is required")
    .max(6, "Cannot upload more than 6 images per product"),
});
export type SignUploadInput = z.infer<typeof SignUploadInputSchema>;


