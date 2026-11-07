import { Request, Response } from "express";
import { Types } from "mongoose";
import { CreateReviewInput } from "@yourstore/shared";
import { Review } from "../models/Review.js";
import { Product } from "../models/Product.js";
import { Order } from "../models/Order.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../lib/errors.js";

/**
 * Recomputes ratingAvg and ratingCount on Product with an aggregation (never read-then-write).
 * Rounds ratingAvg to 1 decimal place.
 */
export async function updateProductRatingStats(productId: Types.ObjectId): Promise<void> {
  const stats = await Review.aggregate<{ _id: Types.ObjectId; avgRating: number; count: number }>([
    { $match: { product: productId } },
    {
      $group: {
        _id: "$product",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0 && stats[0]) {
    const rawAvg = stats[0].avgRating;
    const roundedAvg = Math.round(rawAvg * 10) / 10;
    await Product.updateOne(
      { _id: productId },
      {
        $set: {
          ratingAvg: roundedAvg,
          ratingCount: stats[0].count,
        },
      },
    );
  } else {
    // No reviews remain
    await Product.updateOne(
      { _id: productId },
      {
        $set: {
          ratingAvg: 0,
          ratingCount: 0,
        },
      },
    );
  }
}

/**
 * POST /api/v1/reviews
 * Creates a review for a verified buyer whose order status is Delivered.
 */
export async function createReview(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const input = req.body as CreateReviewInput;
  if (!Types.ObjectId.isValid(input.productId)) {
    throw new BadRequestError("Invalid productId");
  }

  const userObjectId = new Types.ObjectId(userId);
  const productObjectId = new Types.ObjectId(input.productId);

  const product = await Product.findById(productObjectId);
  if (!product || !product.isActive) {
    throw new NotFoundError("Product not found or inactive");
  }

  // Check if user already reviewed this product
  const existingReview = await Review.findOne({
    user: userObjectId,
    product: productObjectId,
  });
  if (existingReview) {
    throw new ConflictError("You have already reviewed this product");
  }

  // Verified buyer check: must have an order with status Delivered containing the product in items snapshot
  const deliveredOrder = await Order.findOne({
    user: userObjectId,
    status: "Delivered",
    "items.productId": productObjectId,
  });

  if (!deliveredOrder) {
    throw new ForbiddenError(
      "Only verified buyers who have received delivery of this product may submit a review.",
    );
  }

  let review;
  try {
    review = await Review.create({
      user: userObjectId,
      product: productObjectId,
      rating: input.rating,
      title: input.title,
      body: input.body,
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      throw new ConflictError("You have already reviewed this product");
    }
    throw err;
  }

  // Update aggregated ratings on Product
  await updateProductRatingStats(productObjectId);

  res.status(201).json({
    message: "Review submitted successfully",
    review: {
      id: review._id.toString(),
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt,
    },
  });
}

/**
 * GET /api/v1/reviews?productId=...&page=...&limit=...
 * Public, paginated, newest first.
 * Returns reviewer's name only (never email).
 */
export async function getProductReviews(req: Request, res: Response): Promise<void> {
  const productId = req.query["productId"];
  if (typeof productId !== "string" || !Types.ObjectId.isValid(productId)) {
    throw new BadRequestError("Valid productId query parameter is required");
  }

  const page = Math.max(1, parseInt(typeof req.query["page"] === "string" ? req.query["page"] : "1", 10) || 1);
  const rawLimit = parseInt(typeof req.query["limit"] === "string" ? req.query["limit"] : "10", 10) || 10;
  const limit = Math.max(1, Math.min(50, rawLimit));

  const filter = { product: new Types.ObjectId(productId) };

  const [total, rawReviews] = await Promise.all([
    Review.countDocuments(filter),
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ user: { _id: Types.ObjectId; name: string } }>("user", "name")
      .lean(),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Map to sanitize and return reviewer's name only (never email)
  const reviews = rawReviews.map((r) => ({
    id: r._id.toString(),
    userName: r.user?.name || "Verified Customer",
    rating: r.rating,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt,
  }));

  res.status(200).json({
    reviews,
    total,
    page,
    totalPages,
  });
}

/**
 * DELETE /api/v1/reviews/:id
 * Allowed for the review owner or an admin only.
 */
export async function deleteReview(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new BadRequestError("Invalid review id");
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new NotFoundError("Review not found");
  }

  // Permission check: owner or admin
  const isOwner = review.user.toString() === userId;
  const isAdmin = userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("You do not have permission to delete this review");
  }

  const productId = review.product;
  await Review.deleteOne({ _id: review._id });

  // Recompute product ratings
  await updateProductRatingStats(productId);

  res.status(200).json({ message: "Review deleted successfully" });
}
