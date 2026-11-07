import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  CartItemInput,
  UpdateCartItemInput,
  RemoveCartItemInput,
  MergeCartInput,
  CartResponseItem,
  MAX_QTY_PER_CART_LINE,
  MAX_CART_LINES,
} from "@yourstore/shared";
import { User, ICartItem } from "../models/User.js";
import { Product, IProduct } from "../models/Product.js";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../lib/errors.js";

interface ProductVerification {
  valid: boolean;
  product?: IProduct | undefined;
  title: string;
  slug: string;
  image?: string | undefined;
  price: number;
  stock: number;
  reason?: string | undefined;
}

function verifyProductPurchasable(
  product: IProduct | null,
  variantSku?: string,
): ProductVerification {
  if (!product || !product.isActive) {
    return {
      valid: false,
      title: "",
      slug: "",
      price: 0,
      stock: 0,
      reason: "Product not found or inactive",
    };
  }

  if (product.listingType !== "purchasable") {
    return {
      valid: false,
      title: product.title,
      slug: product.slug,
      price: 0,
      stock: 0,
      reason: "Product is not available for direct purchase",
    };
  }

  const primaryImage = product.images?.[0]?.url;

  if (variantSku) {
    const variant = product.variants?.find((v) => v.sku === variantSku);
    if (!variant) {
      return {
        valid: false,
        title: product.title,
        slug: product.slug,
        price: 0,
        stock: 0,
        reason: `Variant SKU "${variantSku}" does not exist`,
      };
    }
    const price = variant.priceOverride !== undefined ? variant.priceOverride : product.basePrice;
    const res: ProductVerification = {
      valid: true,
      product,
      title: product.title,
      slug: product.slug,
      price,
      stock: variant.stock,
    };
    if (primaryImage !== undefined) {
      res.image = primaryImage;
    }
    return res;
  }

  // No variant specified
  if (product.variants && product.variants.length > 0) {
    // Requires selecting a variant
    return {
      valid: false,
      title: product.title,
      slug: product.slug,
      price: 0,
      stock: 0,
      reason: "Please select a product variant",
    };
  }

  const stock = product.stock ?? 0;
  const res: ProductVerification = {
    valid: true,
    product,
    title: product.title,
    slug: product.slug,
    price: product.basePrice,
    stock,
  };
  if (primaryImage !== undefined) {
    res.image = primaryImage;
  }
  return res;
}

/**
 * Hydrates cart items by verifying products against the database.
 * Drops invalid or inactive items from the returned response.
 */
async function hydrateCart(cart: ICartItem[]): Promise<{
  items: CartResponseItem[];
  validCartItems: ICartItem[];
  itemCount: number;
  subtotal: number;
}> {
  if (!cart || cart.length === 0) {
    return { items: [], validCartItems: [], itemCount: 0, subtotal: 0 };
  }

  const productIds = cart.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map<string, IProduct>();
  for (const prod of products) {
    productMap.set(prod._id.toString(), prod);
  }

  const items: CartResponseItem[] = [];
  const validCartItems: ICartItem[] = [];
  let itemCount = 0;
  let subtotal = 0;

  for (const item of cart) {
    const prodIdStr = item.productId.toString();
    const product = productMap.get(prodIdStr) ?? null;
    const verification = verifyProductPurchasable(product, item.variantSku);

    // Only include in cart response if valid and has stock
    if (verification.valid && verification.stock > 0) {
      const cappedQty = Math.min(item.qty, verification.stock, MAX_QTY_PER_CART_LINE);
      const lineTotal = verification.price * cappedQty;

      const responseItem: CartResponseItem = {
        productId: prodIdStr,
        title: verification.title,
        slug: verification.slug,
        price: verification.price,
        stock: verification.stock,
        qty: cappedQty,
        lineTotal,
      };
      if (item.variantSku !== undefined) {
        responseItem.variantSku = item.variantSku;
      }
      if (verification.image !== undefined) {
        responseItem.image = verification.image;
      }
      items.push(responseItem);

      const validCartItem: ICartItem = {
        productId: item.productId,
        qty: cappedQty,
      };
      if (item.variantSku !== undefined) {
        validCartItem.variantSku = item.variantSku;
      }
      validCartItems.push(validCartItem);

      itemCount += cappedQty;
      subtotal += lineTotal;
    }
  }

  return { items, validCartItems, itemCount, subtotal };
}

/**
 * GET /api/v1/cart
 * Returns server-validated cart for the authenticated user.
 */
export async function getCart(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const { items, validCartItems, itemCount, subtotal } = await hydrateCart(user.cart || []);

  // If some items became invalid or quantities changed due to stock/caps, persist the sync
  if (user.cart.length !== validCartItems.length) {
    user.cart = validCartItems;
    await user.save();
  }

  res.status(200).json({
    items,
    itemCount,
    subtotal,
  });
}

/**
 * POST /api/v1/cart/items
 * Adds an item to the user's cart. Client sends only productId, variantSku, and qty.
 */
export async function addToCart(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const input = req.body as CartItemInput;

  if (!Types.ObjectId.isValid(input.productId)) {
    throw new BadRequestError("Invalid productId");
  }

  const product = await Product.findById(input.productId);
  const verification = verifyProductPurchasable(product, input.variantSku);

  if (!verification.valid) {
    throw new BadRequestError(verification.reason || "Product cannot be purchased");
  }

  if (verification.stock <= 0) {
    throw new BadRequestError("Product is out of stock");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const currentCart = user.cart || [];
  const existingIndex = currentCart.findIndex(
    (item) =>
      item.productId.toString() === input.productId &&
      (item.variantSku || undefined) === (input.variantSku || undefined),
  );

  if (existingIndex > -1) {
    const existing = currentCart[existingIndex]!;
    const newQty = existing.qty + input.qty;
    if (newQty > MAX_QTY_PER_CART_LINE) {
      throw new BadRequestError(`Cannot add more than ${MAX_QTY_PER_CART_LINE} of this item`);
    }
    if (newQty > verification.stock) {
      throw new BadRequestError(`Only ${verification.stock} units available in stock`);
    }
    existing.qty = newQty;
  } else {
    if (currentCart.length >= MAX_CART_LINES) {
      throw new BadRequestError(`Cart cannot contain more than ${MAX_CART_LINES} unique lines`);
    }
    if (input.qty > verification.stock) {
      throw new BadRequestError(`Only ${verification.stock} units available in stock`);
    }
    const newCartItem: ICartItem = {
      productId: new Types.ObjectId(input.productId),
      qty: input.qty,
    };
    if (input.variantSku !== undefined) {
      newCartItem.variantSku = input.variantSku;
    }
    currentCart.push(newCartItem);
  }

  user.cart = currentCart;
  await user.save();

  const { items, itemCount, subtotal } = await hydrateCart(user.cart);

  res.status(200).json({
    items,
    itemCount,
    subtotal,
  });
}

/**
 * PATCH /api/v1/cart/items
 * Updates the quantity of a cart line. If qty = 0, item is removed.
 */
export async function updateCartItem(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const input = req.body as UpdateCartItemInput;

  if (!Types.ObjectId.isValid(input.productId)) {
    throw new BadRequestError("Invalid productId");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const currentCart = user.cart || [];
  const existingIndex = currentCart.findIndex(
    (item) =>
      item.productId.toString() === input.productId &&
      (item.variantSku || undefined) === (input.variantSku || undefined),
  );

  if (existingIndex === -1) {
    throw new NotFoundError("Item not found in cart");
  }

  if (input.qty === 0) {
    currentCart.splice(existingIndex, 1);
  } else {
    const product = await Product.findById(input.productId);
    const verification = verifyProductPurchasable(product, input.variantSku);

    if (!verification.valid) {
      // Remove invalid product line
      currentCart.splice(existingIndex, 1);
      user.cart = currentCart;
      await user.save();
      throw new BadRequestError(verification.reason || "Product is no longer purchasable");
    }

    if (input.qty > verification.stock) {
      throw new BadRequestError(`Only ${verification.stock} units available in stock`);
    }

    currentCart[existingIndex]!.qty = input.qty;
  }

  user.cart = currentCart;
  await user.save();

  const { items, itemCount, subtotal } = await hydrateCart(user.cart);

  res.status(200).json({
    items,
    itemCount,
    subtotal,
  });
}

/**
 * DELETE /api/v1/cart/items
 * Removes an item from the user's cart.
 */
export async function removeCartItem(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const input = req.body as RemoveCartItemInput;

  if (!Types.ObjectId.isValid(input.productId)) {
    throw new BadRequestError("Invalid productId");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const currentCart = user.cart || [];
  const filteredCart = currentCart.filter(
    (item) =>
      !(
        item.productId.toString() === input.productId &&
        (item.variantSku || undefined) === (input.variantSku || undefined)
      ),
  );

  user.cart = filteredCart;
  await user.save();

  const { items, itemCount, subtotal } = await hydrateCart(user.cart);

  res.status(200).json({
    items,
    itemCount,
    subtotal,
  });
}

/**
 * POST /api/v1/cart/merge
 * Merges a guest cart sent after login into the user's server cart.
 */
export async function mergeCart(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const input = req.body as MergeCartInput;

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const currentCart = [...(user.cart || [])];

  for (const guestItem of input.items) {
    if (!Types.ObjectId.isValid(guestItem.productId)) {
      continue;
    }

    const product = await Product.findById(guestItem.productId);
    const verification = verifyProductPurchasable(product, guestItem.variantSku);

    if (!verification.valid || verification.stock <= 0) {
      continue; // Skip invalid or out-of-stock items during merge
    }

    const existingIndex = currentCart.findIndex(
      (item) =>
        item.productId.toString() === guestItem.productId &&
        (item.variantSku || undefined) === (guestItem.variantSku || undefined),
    );

    if (existingIndex > -1) {
      const existing = currentCart[existingIndex]!;
      const mergedQty = Math.min(
        existing.qty + guestItem.qty,
        verification.stock,
        MAX_QTY_PER_CART_LINE,
      );
      existing.qty = mergedQty;
    } else {
      if (currentCart.length < MAX_CART_LINES) {
        const cappedQty = Math.min(guestItem.qty, verification.stock, MAX_QTY_PER_CART_LINE);
        const newCartItem: ICartItem = {
          productId: new Types.ObjectId(guestItem.productId),
          qty: cappedQty,
        };
        if (guestItem.variantSku !== undefined) {
          newCartItem.variantSku = guestItem.variantSku;
        }
        currentCart.push(newCartItem);
      }
    }
  }

  user.cart = currentCart;
  await user.save();

  const { items, itemCount, subtotal } = await hydrateCart(user.cart);

  res.status(200).json({
    items,
    itemCount,
    subtotal,
  });
}
