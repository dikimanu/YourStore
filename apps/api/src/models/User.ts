import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { USER_ROLES, UserRole } from "@yourstore/shared";

export interface IAddress {
  _id?: Types.ObjectId;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ICartItem {
  productId: Types.ObjectId;
  variantSku?: string | undefined;
  qty: number;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean;
  addresses: IAddress[];
  wishlist: Types.ObjectId[];
  cart: ICartItem[];
  refreshTokenHash?: string | null;
  failedLoginCount: number;
  lockUntil?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
  resetPasswordTokenHash?: string | null;
  resetPasswordExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isLocked(): boolean;
}

const AddressSchema = new Schema<IAddress>(
  {
    label: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: true },
);

const CartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantSku: { type: String, trim: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false },
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "user",
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    addresses: { type: [AddressSchema], default: [] },
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    cart: { type: [CartItemSchema], default: [] },
    refreshTokenHash: { type: String, select: false, default: null },
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    emailVerificationTokenHash: { type: String, select: false, default: null },
    emailVerificationExpiresAt: { type: Date, default: null },
    resetPasswordTokenHash: { type: String, select: false, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret["id"] = ret["_id"]?.toString();
        delete ret["_id"];
        delete ret["__v"];
        delete ret["passwordHash"];
        delete ret["refreshTokenHash"];
        delete ret["emailVerificationTokenHash"];
        delete ret["resetPasswordTokenHash"];
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        ret["id"] = ret["_id"]?.toString();
        delete ret["_id"];
        delete ret["__v"];
        delete ret["passwordHash"];
        delete ret["refreshTokenHash"];
        delete ret["emailVerificationTokenHash"];
        delete ret["resetPasswordTokenHash"];
        return ret;
      },
    },
  },
);

UserSchema.index({ createdAt: -1 });
UserSchema.index({ email: 1 });

UserSchema.methods["isLocked"] = function (this: IUser): boolean {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

export const User: Model<IUser> =
  mongoose.models["User"] || mongoose.model<IUser>("User", UserSchema);
