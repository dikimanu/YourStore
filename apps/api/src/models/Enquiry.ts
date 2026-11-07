import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IEnquiry extends Document {
  product: Types.ObjectId;
  user?: Types.ObjectId | undefined;
  name: string;
  phone: string;
  message: string;
  type: "enquiry" | "visit";
  preferredDate?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const EnquirySchema = new Schema<IEnquiry>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["enquiry", "visit"],
      required: true,
      default: "enquiry",
    },
    preferredDate: {
      type: Date,
      required: false,
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
  },
);

EnquirySchema.index({ createdAt: -1 });

export const Enquiry: Model<IEnquiry> =
  mongoose.models["Enquiry"] || mongoose.model<IEnquiry>("Enquiry", EnquirySchema);
