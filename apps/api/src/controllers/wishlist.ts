import { Request, Response } from "express";
import { Types } from "mongoose";
import { WishlistInput } from "@yourstore/shared";
import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../lib/errors.js";

const MAX_WISHLIST_ITEMS = 100;

/**
 * GET /api/v1/wishlist
 * Returns the authenticated user's wishlist products.
 * Skips inactive products.
 */
export async function getWishlist(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const wishlistIds = user.wishlist || [];
  if (wishlistIds.length === 0) {
    res.status(200).json({ products: [] });
    return;
  }

  // Fetch active products in wishlist
  const products = await Product.find({
  _id: { $in: wishlistIds },
  isActive: true,
}).lean();

  // Preserve wishlist ordering
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const orderedProducts = wishlistIds
    .map((id) => productMap.get(id.toString()))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  res.status(200).json({ products: orderedProducts });
}

/**
 * POST /api/v1/wishlist
 * Adds a product to the user's wishlist.
 * Capped at 100 items. Deduplicates automatically.
 */
export async function addToWishlist(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { productId } = req.body as WishlistInput;
  if (!Types.ObjectId.isValid(productId)) {
    throw new BadRequestError("Invalid productId");
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw new NotFoundError("Product not found or inactive");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const wishlist = user.wishlist || [];
  const alreadyInWishlist = wishlist.some((id) => id.toString() === productId);

  if (!alreadyInWishlist) {
    if (wishlist.length >= MAX_WISHLIST_ITEMS) {
      throw new BadRequestError(`Wishlist cannot exceed ${MAX_WISHLIST_ITEMS} items`);
    }
    user.wishlist.push(new Types.ObjectId(productId));
    await user.save();
  }

  res.status(200).json({
    message: "Product added to wishlist",
    wishlist: user.wishlist.map((id) => id.toString()),
  });
}

/**
 * DELETE /api/v1/wishlist/:productId
 * Removes a product from the user's wishlist.
 */
export async function removeFromWishlist(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { productId } = req.params;
  if (!productId || !Types.ObjectId.isValid(productId)) {
    throw new BadRequestError("Invalid productId");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  user.wishlist = (user.wishlist || []).filter((id) => id.toString() !== productId);
  await user.save();

  res.status(200).json({
    message: "Product removed from wishlist",
    wishlist: user.wishlist.map((id) => id.toString()),
  });
}
