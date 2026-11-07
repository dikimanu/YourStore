import { z } from "zod";
import { CATEGORIES, ORDER_STATUSES, LISTING_TYPES, USER_ROLES, type OrderStatus } from "./constants.js";

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
// Convenience alias: image object stored on a product
export type ProductImage = z.infer<typeof ImageSchema>;

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
// Convenience alias used by admin UI components
export type ProductVariant = Variant;

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
export type OrderItem = z.infer<typeof OrderItemSchema>;

// ---- Shipping Address Snapshot ----
export const ShippingAddressSnapshotSchema = z.object({
  label: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
});
export type ShippingAddressSnapshot = z.infer<typeof ShippingAddressSnapshotSchema>;

// ---- Pricing ----
export const PricingSchema = z.object({
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export type Pricing = z.infer<typeof PricingSchema>;

// ---- Order Status & History ----
export const OrderStatusSchema = z.enum(ORDER_STATUSES);

export const OrderStatusHistoryItemSchema = z.object({
  status: OrderStatusSchema,
  at: z.coerce.date(),
  by: z.string(),
  note: z.string().optional(),
});
export type OrderStatusHistoryItem = z.infer<typeof OrderStatusHistoryItemSchema>;

export const OrderPaymentMethodSchema = z.enum(["stripe", "cod"]);
export type OrderPaymentMethod = z.infer<typeof OrderPaymentMethodSchema>;

export const OrderPaymentStatusSchema = z.enum(["pending", "paid", "failed", "refunded"]);
export type OrderPaymentStatus = z.infer<typeof OrderPaymentStatusSchema>;

export const OrderPaymentSchema = z.object({
  method: OrderPaymentMethodSchema,
  status: OrderPaymentStatusSchema,
  stripeSessionId: z.string().optional(),
  paymentIntentId: z.string().optional(),
});
export type OrderPayment = z.infer<typeof OrderPaymentSchema>;

// ---- Return Request ----
export const ReturnDecisionSchema = z.enum(["approve", "reject"]);
export type ReturnDecision = z.infer<typeof ReturnDecisionSchema>;

export const OrderReturnRequestSchema = z.object({
  reason: z.string().min(5).max(500),
  requestedAt: z.coerce.date(),
  decidedAt: z.coerce.date().optional(),
  decidedBy: z.string().optional(),
  decision: ReturnDecisionSchema.optional(),
  note: z.string().max(500).optional(),
});
export type OrderReturnRequest = z.infer<typeof OrderReturnRequestSchema>;

// ---- Order ----
export const OrderSchema = z.object({
  id: z.string().optional(),
  user: z.string(),
  items: z.array(OrderItemSchema).min(1),
  shippingAddress: ShippingAddressSnapshotSchema,
  pricing: PricingSchema,
  payment: OrderPaymentSchema,
  status: OrderStatusSchema,
  statusHistory: z.array(OrderStatusHistoryItemSchema).default([]),
  returnRequest: OrderReturnRequestSchema.optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type Order = z.infer<typeof OrderSchema>;

// ---- Review ----
export const ReviewSchema = z.object({
  id: z.string().optional(),
  user: z.string(),
  product: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(2000),
  createdAt: z.coerce.date().optional(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const CreateReviewInputSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  rating: z.number().int("Rating must be an integer").min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
  title: z.string().trim().min(1, "Title is required").max(100, "Title cannot exceed 100 characters"),
  body: z.string().trim().min(1, "Review body is required").max(2000, "Review body cannot exceed 2000 characters"),
});
export type CreateReviewInput = z.infer<typeof CreateReviewInputSchema>;

export const ReviewQuerySchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type ReviewQuery = z.infer<typeof ReviewQuerySchema>;

// ---- Coupon ----
export const CouponTypeSchema = z.enum(["percent", "fixed"]);
export type CouponType = z.infer<typeof CouponTypeSchema>;

export const CouponSchema = z.object({
  code: z.string().min(1).toUpperCase(),
  type: CouponTypeSchema,
  value: z.number().positive(),
  minOrder: z.number().nonnegative().default(0),
  expiresAt: z.coerce.date(),
  usageLimit: z.number().int().positive(),
  usedCount: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});
export type Coupon = z.infer<typeof CouponSchema>;

export const ValidateCouponInputSchema = z.object({
  code: z.string().trim().min(1, "Coupon code is required").toUpperCase(),
  subtotal: z.number().nonnegative("Subtotal must be non-negative"),
});
export type ValidateCouponInput = z.infer<typeof ValidateCouponInputSchema>;

export const CouponCodeSchema = z
  .string()
  .trim()
  .min(3, "Code must be at least 3 characters")
  .max(20, "Code cannot exceed 20 characters")
  .regex(/^[A-Za-z0-9-]+$/, "Code must contain only letters, numbers, and dashes")
  .transform((val) => val.toUpperCase());

export const CreateCouponInputSchema = z
  .object({
    code: CouponCodeSchema,
    type: CouponTypeSchema,
    value: z.number().int("Value must be an integer").positive("Value must be a positive integer"),
    minOrder: z.number().nonnegative("Minimum order must be >= 0").default(0),
    expiresAt: z.coerce.date().optional(),
    usageLimit: z.number().int("Usage limit must be an integer").positive("Usage limit must be a positive integer").optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "percent" && (data.value < 1 || data.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Percentage value must be between 1 and 100",
      });
    }
    if (data.expiresAt && data.expiresAt.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Expiry date must be in the future",
      });
    }
  });
export type CreateCouponInput = z.infer<typeof CreateCouponInputSchema>;

export const UpdateCouponInputSchema = z
  .object({
    type: CouponTypeSchema.optional(),
    value: z.number().int("Value must be an integer").positive("Value must be a positive integer").optional(),
    minOrder: z.number().nonnegative("Minimum order must be >= 0").optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    usageLimit: z.number().int("Usage limit must be an integer").positive("Usage limit must be a positive integer").nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "percent" && data.value !== undefined && (data.value < 1 || data.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Percentage value must be between 1 and 100",
      });
    }
  });
export type UpdateCouponInput = z.infer<typeof UpdateCouponInputSchema>;

export const AdminCouponQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["all", "active", "expired", "inactive"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminCouponQuery = z.infer<typeof AdminCouponQuerySchema>;

export const ValidateCouponResponseSchema = z.object({
  valid: z.literal(true),
  code: z.string(),
  type: CouponTypeSchema,
  value: z.number(),
  minOrder: z.number(),
  discount: z.number().nonnegative(),
  newSubtotal: z.number().nonnegative(),
});
export type ValidateCouponResponse = z.infer<typeof ValidateCouponResponseSchema>;

// ---- User ----
export const UserRoleSchema = z.enum(USER_ROLES);

export const IndianPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^(?:(?:\+91[\s-]?)?|0)?[6-9]\d{9}$/,
    "Invalid Indian phone number. Must be a valid 10-digit mobile number.",
  );

export const IndianPincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Invalid Indian pincode. Must be a 6-digit postal code.");

export const AddressSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  label: z.string().trim().min(1, "Label is required"),
  name: z.string().trim().min(1, "Name is required"),
  phone: IndianPhoneSchema,
  line1: z.string().trim().min(1, "Address line 1 is required"),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  pincode: IndianPincodeSchema,
});
export type Address = z.infer<typeof AddressSchema>;

export const CreateAddressInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  name: z.string().trim().min(1, "Name is required"),
  phone: IndianPhoneSchema,
  line1: z.string().trim().min(1, "Address line 1 is required"),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  pincode: IndianPincodeSchema,
});
export type CreateAddressInput = z.infer<typeof CreateAddressInputSchema>;

export const UpdateAddressInputSchema = z.object({
  label: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  phone: IndianPhoneSchema.optional(),
  line1: z.string().trim().min(1).optional(),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  pincode: IndianPincodeSchema.optional(),
});
export type UpdateAddressInput = z.infer<typeof UpdateAddressInputSchema>;

export const AddressParamsSchema = z.object({
  id: z.string().min(1, "Address ID is required"),
});
export type AddressParams = z.infer<typeof AddressParamsSchema>;

// ---- Cart ----
export const MAX_QTY_PER_CART_LINE = 10;
export const MAX_CART_LINES = 30;

export const CartItemInputSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  variantSku: z.string().trim().optional(),
  qty: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(MAX_QTY_PER_CART_LINE, `Quantity per line cannot exceed ${MAX_QTY_PER_CART_LINE}`),
});
export type CartItemInput = z.infer<typeof CartItemInputSchema>;

export const UpdateCartItemInputSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  variantSku: z.string().trim().optional(),
  qty: z
    .number()
    .int("Quantity must be an integer")
    .min(0, "Quantity must be non-negative")
    .max(MAX_QTY_PER_CART_LINE, `Quantity per line cannot exceed ${MAX_QTY_PER_CART_LINE}`),
});
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInputSchema>;

export const RemoveCartItemInputSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  variantSku: z.string().trim().optional(),
});
export type RemoveCartItemInput = z.infer<typeof RemoveCartItemInputSchema>;

export const MergeCartInputSchema = z.object({
  items: z
    .array(CartItemInputSchema)
    .max(MAX_CART_LINES, `Cart cannot exceed ${MAX_CART_LINES} items`),
});
export type MergeCartInput = z.infer<typeof MergeCartInputSchema>;

export const CartResponseItemSchema = z.object({
  productId: z.string(),
  variantSku: z.string().optional(),
  title: z.string(),
  slug: z.string(),
  image: z.string().optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
});
export type CartResponseItem = z.infer<typeof CartResponseItemSchema>;

export const CartResponseSchema = z.object({
  items: z.array(CartResponseItemSchema),
  itemCount: z.number().int().nonnegative(),
  subtotal: z.number().nonnegative(),
});
export type CartResponse = z.infer<typeof CartResponseSchema>;

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

export const CheckoutStripeInputSchema = z.object({
  addressId: z.string().trim().min(1, "Address ID is required"),
  couponCode: z.string().trim().min(1).optional(),
});
export type CheckoutStripeInput = z.infer<typeof CheckoutStripeInputSchema>;

export const CheckoutCodInputSchema = z.object({
  addressId: z.string().trim().min(1, "Address ID is required"),
  couponCode: z.string().trim().min(1).optional(),
});
export type CheckoutCodInput = z.infer<typeof CheckoutCodInputSchema>;

export const AdminOrderStatusUpdateSchema = z.object({
  status: z.enum(["Processing", "Dispatched", "OutForDelivery", "Delivered"]),
});
export type AdminOrderStatusUpdate = z.infer<typeof AdminOrderStatusUpdateSchema>;

export const RequestReturnInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Reason cannot exceed 500 characters"),
});
export type RequestReturnInput = z.infer<typeof RequestReturnInputSchema>;

export const AdminReturnDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500, "Note cannot exceed 500 characters").optional(),
});
export type AdminReturnDecision = z.infer<typeof AdminReturnDecisionSchema>;

export const WishlistInputSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
});
export type WishlistInput = z.infer<typeof WishlistInputSchema>;

export const EnquiryTypeSchema = z.enum(["enquiry", "visit"]);
export type EnquiryType = z.infer<typeof EnquiryTypeSchema>;

export const CreateEnquiryInputSchema = z
  .object({
    productId: z.string().trim().min(1, "Product ID is required"),
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name cannot exceed 100 characters"),
    phone: IndianPhoneSchema,
    message: z.string().trim().max(1000, "Message cannot exceed 1000 characters").optional().default(""),
    type: EnquiryTypeSchema.default("enquiry"),
    preferredDate: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "visit") {
      if (!data.preferredDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["preferredDate"],
          message: "Preferred date is required for dealership visits",
        });
      } else if (data.preferredDate.getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["preferredDate"],
          message: "Preferred date must be in the future",
        });
      }
    }
  });
export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInputSchema>;

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

// ---- Admin Stats Schemas ----
export const AdminStatsQuerySchema = z.object({
  days: z
    .union([z.enum(["7", "30", "90"]), z.literal(7), z.literal(30), z.literal(90)])
    .default("30")
    .transform((val) => Number(val) as 7 | 30 | 90),
});
export type AdminStatsQuery = z.infer<typeof AdminStatsQuerySchema>;

export const SalesByDayItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revenue: z.number().nonnegative(),
  orders: z.number().int().nonnegative(),
});
export type SalesByDayItem = z.infer<typeof SalesByDayItemSchema>;

export const OrderCountsSchema = z.record(z.string(), z.number().int().nonnegative());
export type OrderCounts = Record<OrderStatus, number>;

export const StatsTotalsSchema = z.object({
  revenue: z.number().nonnegative(),
  orders: z.number().int().nonnegative(),
  averageOrderValue: z.number().nonnegative(),
});
export type StatsTotals = z.infer<typeof StatsTotalsSchema>;

export const TopProductItemSchema = z.object({
  productId: z.string(),
  title: z.string(),
  units: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
});
export type TopProductItem = z.infer<typeof TopProductItemSchema>;

export const LowStockItemSchema = z.object({
  productId: z.string(),
  title: z.string(),
  slug: z.string(),
  sku: z.string().optional(),
  stock: z.number().int(),
});
export type LowStockItem = z.infer<typeof LowStockItemSchema>;

export const AdminStatsResponseSchema = z.object({
  salesByDay: z.array(SalesByDayItemSchema),
  orderCounts: z.record(z.string(), z.number().int().nonnegative()),
  totals: StatsTotalsSchema,
  topProducts: z.array(TopProductItemSchema),
  lowStock: z.array(LowStockItemSchema),
});
export type AdminStatsResponse = {
  salesByDay: SalesByDayItem[];
  orderCounts: Record<OrderStatus, number>;
  totals: StatsTotals;
  topProducts: TopProductItem[];
  lowStock: LowStockItem[];
};




// ---- Admin Lists Schemas ----
export const AdminCustomersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminCustomersQuery = z.infer<typeof AdminCustomersQuerySchema>;

export const AdminCustomerItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: UserRoleSchema,
  emailVerified: z.boolean(),
  createdAt: z.coerce.date(),
  orderCount: z.number().int().nonnegative(),
  totalSpent: z.number().nonnegative(),
});
export type AdminCustomerItem = z.infer<typeof AdminCustomerItemSchema>;

export const AdminCustomersResponseSchema = z.object({
  customers: z.array(AdminCustomerItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  totalPages: z.number().int().nonnegative(),
});
export type AdminCustomersResponse = z.infer<typeof AdminCustomersResponseSchema>;

export const AdminEnquiriesQuerySchema = z.object({
  type: z.enum(["enquiry", "visit"]).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminEnquiriesQuery = z.infer<typeof AdminEnquiriesQuerySchema>;

export const AdminEnquiryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  message: z.string(),
  type: z.enum(["enquiry", "visit"]),
  preferredDate: z.coerce.date().optional(),
  product: z.object({
    _id: z.string().optional(),
    id: z.string().optional(),
    title: z.string(),
    slug: z.string(),
  }),
  user: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});
export type AdminEnquiryItem = z.infer<typeof AdminEnquiryItemSchema>;

export const AdminEnquiriesResponseSchema = z.object({
  enquiries: z.array(AdminEnquiryItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  totalPages: z.number().int().nonnegative(),
});
export type AdminEnquiriesResponse = z.infer<typeof AdminEnquiriesResponseSchema>;

export const AdminAuditLogsQuerySchema = z.object({
  action: z.string().trim().optional(),
  targetType: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminAuditLogsQuery = z.infer<typeof AdminAuditLogsQuerySchema>;

export const AdminAuditLogItemSchema = z.object({
  id: z.string(),
  actor: z.union([
    z.object({
      _id: z.string().optional(),
      id: z.string().optional(),
      name: z.string().optional(),
    }),
    z.string(),
  ]),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
  at: z.coerce.date(),
});
export type AdminAuditLogItem = z.infer<typeof AdminAuditLogItemSchema>;

export const AdminAuditLogsResponseSchema = z.object({
  logs: z.array(AdminAuditLogItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  totalPages: z.number().int().nonnegative(),
});
export type AdminAuditLogsResponse = z.infer<typeof AdminAuditLogsResponseSchema>;

export const AdminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  orderId: z.string().trim().optional(),
  email: z.string().trim().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  paymentMethod: z.enum(["stripe", "cod"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  search: z.string().trim().optional(),
});
export type AdminOrdersQuery = z.infer<typeof AdminOrdersQuerySchema>;

export const AdminOrdersResponseSchema = z.object({
  orders: z.array(z.record(z.unknown())),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  totalPages: z.number().int().nonnegative(),
});
export type AdminOrdersResponse = {
  orders: Array<{
    id?: string;
    _id?: string;
    user?: unknown;
    status: OrderStatus;
    payment: { method: "stripe" | "cod"; status: string };
    pricing: { total: number };
    createdAt: Date | string;
    [key: string]: unknown;
  }>;
  total: number;
  page: number;
  totalPages: number;
};

// ---- CSV Product Import ----

/** Request body for both /preview and /commit */
export const CsvImportRequestSchema = z.object({
  /** Raw CSV text, max 1 MB enforced at controller level */
  csv: z.string().min(1, "CSV content is required"),
});
export type CsvImportRequest = z.infer<typeof CsvImportRequestSchema>;

/** Per-row result returned by the preview endpoint */
export const CsvImportRowResultSchema = z.object({
  line: z.number().int().positive(),
  valid: z.boolean(),
  errors: z.array(z.string()),
  data: z
    .object({
      title: z.string(),
      slug: z.string(),
      description: z.string(),
      category: z.enum(CATEGORIES),
      brand: z.string(),
      basePrice: z.number(),
      stock: z.number().int().nonnegative().optional(),
      listingType: z.enum(LISTING_TYPES),
      isActive: z.boolean(),
    })
    .optional(),
});
export type CsvImportRowResult = z.infer<typeof CsvImportRowResultSchema>;

/** Response from the preview endpoint */
export const CsvImportPreviewResponseSchema = z.object({
  rows: z.array(CsvImportRowResultSchema),
  validCount: z.number().int().nonnegative(),
  invalidCount: z.number().int().nonnegative(),
});
export type CsvImportPreviewResponse = z.infer<typeof CsvImportPreviewResponseSchema>;

/** Response from the commit endpoint on success */
export const CsvImportCommitResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  message: z.string(),
});
export type CsvImportCommitResponse = z.infer<typeof CsvImportCommitResponseSchema>;
