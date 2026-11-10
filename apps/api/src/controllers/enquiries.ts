import { Request, Response } from "express";
import { Types } from "mongoose";
import { CreateEnquiryInput, AdminEnquiryReplyInput } from "@yourstore/shared";
import { Product } from "../models/Product.js";
import { Enquiry } from "../models/Enquiry.js";
import { User } from "../models/User.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

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
    status: "pending",
  };

  if (req.user?.id && Types.ObjectId.isValid(req.user.id)) {
    payload["user"] = new Types.ObjectId(req.user.id);
    if (!payload["email"] && req.user.email) {
      payload["email"] = req.user.email;
    }
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

/**
 * POST /api/v1/admin/enquiries/:id/reply and POST /api/v1/enquiries/:id/reply
 * Admin replies to a vehicle enquiry or showroom visit.
 * Updates enquiry status (replied or resolved), records adminReply and repliedAt,
 * and optionally sends an email notification to the customer if an email is present.
 */
export async function adminReplyEnquiry(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reply, status = "replied" } = req.body as AdminEnquiryReplyInput;

  if (!id || !Types.ObjectId.isValid(id)) {
    throw new BadRequestError("Invalid enquiry ID");
  }

  const enquiry = await Enquiry.findById(id).populate("product", "title slug");
  if (!enquiry) {
    throw new NotFoundError("Enquiry not found");
  }

  enquiry.status = status;
  enquiry.adminReply = reply;
  enquiry.repliedAt = new Date();
  await enquiry.save();

  // Look up customer email: from enquiry.email, or linked user account if available
  let customerEmail = enquiry.email;
  if (!customerEmail && enquiry.user) {
    const linkedUser = await User.findById(enquiry.user).select("email");
    if (linkedUser?.email) {
      customerEmail = linkedUser.email;
    }
  }

  // Optionally trigger email notification via Resend
  if (customerEmail) {
    const productTitle = (enquiry.product as unknown as { title?: string })?.title || "Vehicle Enquiry";
    void sendEmail({
      to: customerEmail,
      subject: `Response regarding your inquiry for ${productTitle} — YourStore`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">YourStore Dealership Response</h2>
          <p>Dear ${enquiry.name},</p>
          <p>Thank you for your interest in the <strong>${productTitle}</strong>.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; white-space: pre-wrap; font-size: 14px; color: #1f2937;">${reply}</p>
          </div>
          <p style="font-size: 13px; color: #6b7280;">
            Original message / inquiry: "${enquiry.message || "Test Drive / Dealership Visit"}"
          </p>
          <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
            If you have any further questions, feel free to reply or visit our showroom.
          </p>
        </div>
      `,
    }).catch((err) => {
      logger.warn({ err: (err as Error).message, enquiryId: id }, "Could not send enquiry reply email");
    });
  }

  res.status(200).json({
    success: true,
    message: "Reply recorded successfully",
    enquiry: {
      id: enquiry._id.toString(),
      status: enquiry.status,
      adminReply: enquiry.adminReply,
      repliedAt: enquiry.repliedAt,
    },
  });
}
