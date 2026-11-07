import { Request, Response } from "express";
import { Types } from "mongoose";
import { CreateEnquiryInput } from "@yourstore/shared";
import { Product } from "../models/Product.js";
import { Enquiry } from "../models/Enquiry.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";

/**
 * POST /api/v1/enquiries
 * Creates a vehicle enquiry or dealership visit request.
 * Allows guest and authenticated users.
 * Rejects purchasable products (enquiry-only allowed).
 */
export async function createEnquiry(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateEnquiryInput;

  if (!Types.ObjectId.isValid(input.productId)) {
    throw new BadRequestError("Invalid productId");
  }

  const product = await Product.findById(input.productId);
  if (!product || !product.isActive) {
    throw new NotFoundError("Product not found or inactive");
  }

  if (product.listingType !== "enquiry") {
    throw new BadRequestError("Enquiries are only accepted for enquiry-only products (e.g. vehicles)");
  }

  const payload: Record<string, unknown> = {
    product: product._id,
    name: input.name,
    phone: input.phone,
    message: input.message ?? "",
    type: input.type,
  };

  if (req.user?.id && Types.ObjectId.isValid(req.user.id)) {
    payload["user"] = new Types.ObjectId(req.user.id);
  }

  if (input.preferredDate) {
    payload["preferredDate"] = new Date(input.preferredDate);
  }

  const enquiry = await Enquiry.create(payload);

  res.status(201).json({
    message: input.type === "visit" ? "Dealership visit booked successfully" : "Enquiry submitted successfully",
    enquiryId: enquiry._id.toString(),
  });
}
