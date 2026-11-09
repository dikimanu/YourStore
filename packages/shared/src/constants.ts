// Categories
export const CATEGORIES = [
  "gadgets",
  "clothing",
  "electronics",
  "vehicles",
  "home",
  "foods",
  "books",
  "health",
  "industrial",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Order statuses
export const ORDER_STATUSES = [
  "PendingPayment",
  "Placed",
  "Processing",
  "Dispatched",
  "OutForDelivery",
  "Delivered",
  "Cancelled",
  "ReturnRequested",
  "Returned",
  "Refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Image presets
export const IMAGE_PRESETS = ["thumb", "card", "detail", "zoom"] as const;
export type ImagePreset = (typeof IMAGE_PRESETS)[number];

export const IMAGE_PRESET_WIDTHS: Record<ImagePreset, number> = {
  thumb: 200,
  card: 400,
  detail: 800,
  zoom: 1400,
};

// Listing types
export const LISTING_TYPES = ["purchasable", "enquiry"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

// User roles
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];
