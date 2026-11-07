import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  ORDER_STATUSES,
  OrderStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
} from "@yourstore/shared";

export interface IOrderItemSnapshot {
  productId: Types.ObjectId;
  variantSku?: string | undefined;
  title: string;
  image?: string | undefined;
  unitPrice: number;
  qty: number;
}

export interface IShippingAddressSnapshot {
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  state: string;
  pincode: string;
}

export interface IOrderPricing {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
}

export interface IOrderPayment {
  method: OrderPaymentMethod;
  status: OrderPaymentStatus;
  stripeSessionId?: string | undefined;
  paymentIntentId?: string | undefined;
}

export interface IOrderStatusHistory {
  status: OrderStatus;
  at: Date;
  by: string;
  note?: string | undefined;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItemSnapshot[];
  shippingAddress: IShippingAddressSnapshot;
  pricing: IOrderPricing;
  payment: IOrderPayment;
  status: OrderStatus;
  statusHistory: IOrderStatusHistory[];
  couponCode?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSnapshotSchema = new Schema<IOrderItemSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantSku: { type: String, trim: true },
    title: { type: String, required: true },
    image: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const ShippingAddressSnapshotSchema = new Schema<IShippingAddressSnapshot>(
  {
    label: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false },
);

const OrderPricingSchema = new Schema<IOrderPricing>(
  {
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const OrderPaymentSchema = new Schema<IOrderPayment>(
  {
    method: { type: String, enum: ["stripe", "cod"], required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      required: true,
      default: "pending",
    },
    stripeSessionId: { type: String },
    paymentIntentId: { type: String },
  },
  { _id: false },
);

const OrderStatusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true, default: Date.now },
    by: { type: String, required: true },
    note: { type: String },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: {
      type: [OrderItemSnapshotSchema],
      required: true,
      validate: [(val: IOrderItemSnapshot[]) => val.length > 0, "Order must have at least one item"],
    },
    shippingAddress: { type: ShippingAddressSnapshotSchema, required: true },
    pricing: { type: OrderPricingSchema, required: true },
    payment: { type: OrderPaymentSchema, required: true },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      default: "PendingPayment",
    },
    statusHistory: { type: [OrderStatusHistorySchema], default: [] },
    couponCode: { type: String, uppercase: true, trim: true },
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

OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ "payment.stripeSessionId": 1 }, { sparse: true });
OrderSchema.index({ status: 1 });

export const Order: Model<IOrder> =
  mongoose.models["Order"] || mongoose.model<IOrder>("Order", OrderSchema);
