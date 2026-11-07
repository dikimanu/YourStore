import mongoose, { Document, Model, Schema } from "mongoose";
import {
  CATEGORIES,
  Category,
  LISTING_TYPES,
  ListingType,
} from "@yourstore/shared";

export interface IProductImage {
  url: string;
  publicId: string;
  alt: string;
}

export interface IVariantOptions {
  size?: string | undefined;
  color?: string | undefined;
}

export interface IProductVariant {
  sku: string;
  options: IVariantOptions;
  priceOverride?: number | undefined;
  stock: number;
}

export interface IProduct extends Document {
  title: string;
  slug: string;
  description: string;
  category: Category;
  brand: string;
  basePrice: number;
  images: IProductImage[];
  attributes: Record<string, unknown>;
  variants: IProductVariant[];
  stock?: number | undefined;
  listingType: ListingType;
  ratingAvg: number;
  ratingCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, default: "" },
  },
  { _id: false },
);

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    sku: { type: String, required: true, trim: true },
    options: {
      size: { type: String, trim: true },
      color: { type: String, trim: true },
    },
    priceOverride: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const ProductSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: CATEGORIES,
    },
    brand: { type: String, required: true, trim: true },
    basePrice: { type: Number, required: true, min: 0 },
    images: {
      type: [ProductImageSchema],
      default: [],
      validate: [(val: IProductImage[]) => val.length <= 6, "{PATH} exceeds the limit of 6 images"],
    },
    attributes: { type: Schema.Types.Mixed, default: {} },
    variants: { type: [ProductVariantSchema], default: [] },
    stock: { type: Number, min: 0 },
    listingType: {
      type: String,
      enum: LISTING_TYPES,
      default: "purchasable",
    },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret["id"] = ret["_id"]?.toString();
        delete ret["_id"];
        delete ret["__v"];
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        ret["id"] = ret["_id"]?.toString();
        delete ret["_id"];
        delete ret["__v"];
        return ret;
      },
    },
  },
);

// Indexes specified in Brief Section 6:
// 1. Text index on title + description
ProductSchema.index({ title: "text", description: "text" });

// 2. Compound index on (category, basePrice)
ProductSchema.index({ category: 1, basePrice: 1 });

// 3. Index on isActive for filtering
ProductSchema.index({ isActive: 1 });

export const Product: Model<IProduct> =
  mongoose.models["Product"] || mongoose.model<IProduct>("Product", ProductSchema);
