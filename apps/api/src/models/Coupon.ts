import mongoose, { Document, Model, Schema } from "mongoose";
import { CouponType } from "@yourstore/shared";

export interface ICoupon extends Document {
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  expiresAt: Date;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["percent", "fixed"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrder: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usageLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    usedCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
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

export const Coupon: Model<ICoupon> =
  mongoose.models["Coupon"] || mongoose.model<ICoupon>("Coupon", CouponSchema);
