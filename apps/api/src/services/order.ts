import { Types } from "mongoose";
import { OrderPaymentMethod } from "@yourstore/shared";
import { env } from "../env.js";
import { User, ICartItem } from "../models/User.js";
import { Product, IProduct } from "../models/Product.js";
import { Coupon, ICoupon } from "../models/Coupon.js";
import {
  Order,
  IOrder,
  IOrderItemSnapshot,
  IShippingAddressSnapshot,
} from "../models/Order.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

interface DecrementedItem {
  productId: Types.ObjectId;
  variantSku?: string | undefined;
  qty: number;
}

/**
 * Decrement stock atomically using conditional updates.
 * If product has variants, decrements variant stock via positional operator `variants.$.stock`.
 * Otherwise, decrements base product `stock`.
 * Never read-then-write.
 */
async function atomicDecrementStock(
  productId: Types.ObjectId,
  variantSku: string | undefined,
  qty: number,
): Promise<boolean> {
  if (variantSku) {
    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        isActive: true,
        listingType: "purchasable",
        variants: {
          $elemMatch: {
            sku: variantSku,
            stock: { $gte: qty },
          },
        },
      },
      {
        $inc: { "variants.$.stock": -qty },
      },
      { new: true },
    );
    return Boolean(updated);
  }

  const updated = await Product.findOneAndUpdate(
    {
      _id: productId,
      isActive: true,
      listingType: "purchasable",
      stock: { $gte: qty },
    },
    {
      $inc: { stock: -qty },
    },
    { new: true },
  );
  return Boolean(updated);
}

/**
 * Atomically increment stock back for a single item (restore stock).
 */
async function atomicRestoreItemStock(
  productId: Types.ObjectId,
  variantSku: string | undefined,
  qty: number,
): Promise<void> {
  if (variantSku) {
    await Product.updateOne(
      {
        _id: productId,
        "variants.sku": variantSku,
      },
      {
        $inc: { "variants.$.stock": qty },
      },
    );
  } else {
    await Product.updateOne(
      {
        _id: productId,
      },
      {
        $inc: { stock: qty },
      },
    );
  }
}

/**
 * Public restoreStock helper: Restores stock for all items in an order (used for cancel, payment failure, session expiry).
 */
export async function restoreStock(order: IOrder): Promise<void> {
  if (!order || !order.items || order.items.length === 0) {
    return;
  }

  for (const item of order.items) {
    await atomicRestoreItemStock(item.productId, item.variantSku, item.qty);
  }
}

/**
 * Atomically increment coupon usedCount only if usedCount < usageLimit and isActive = true.
 */
async function atomicIncrementCoupon(code: string): Promise<ICoupon | null> {
  const updated = await Coupon.findOneAndUpdate(
    {
      code: code.toUpperCase(),
      isActive: true,
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
    },
    {
      $inc: { usedCount: 1 },
    },
    { new: true },
  );
  return updated;
}

/**
 * Atomically decrement coupon usedCount (rollback).
 */
async function atomicRollbackCoupon(code: string): Promise<void> {
  await Coupon.updateOne(
    {
      code: code.toUpperCase(),
      usedCount: { $gt: 0 },
    },
    {
      $inc: { usedCount: -1 },
    },
  );
}

/**
 * Public releaseCoupon helper: Decrements usedCount only if order.couponCode is set and usedCount > 0.
 */
export async function releaseCoupon(order: IOrder): Promise<void> {
  if (order.couponCode) {
    await atomicRollbackCoupon(order.couponCode);
  }
}

/**
 * Core order service: Creates an order from the user's cart.
 * - Claims cart atomically from the user.
 * - Validates addresses and products.
 * - Enforces server-side prices (never trusts client).
 * - Decrements stock atomically with rollback on partial failure.
 * - Increments coupon usage atomically with rollback on failure.
 * - Computes exact financial figures using integer paise.
 */
export async function createOrderFromCart(
  userId: string,
  addressId: string,
  couponCode?: string  ,
  paymentMethod: OrderPaymentMethod = "stripe",
): Promise<IOrder> {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Find saved address on user (ownership guarantee)
  const savedAddress = user.addresses?.find((a) => a._id?.toString() === addressId);
  if (!savedAddress) {
    throw new NotFoundError("Saved address not found");
  }

  const shippingAddressSnapshot: IShippingAddressSnapshot = {
    label: savedAddress.label,
    name: savedAddress.name,
    phone: savedAddress.phone,
    line1: savedAddress.line1,
    city: savedAddress.city,
    state: savedAddress.state,
    pincode: savedAddress.pincode,
  };
  if (savedAddress.line2 !== undefined) {
    shippingAddressSnapshot.line2 = savedAddress.line2;
  }

  // Atomically claim the cart from user
  const claimedUser = await User.findOneAndUpdate(
    { _id: userId, "cart.0": { $exists: true } },
    { $set: { cart: [] } },
    { new: false },
  );

  if (!claimedUser || !claimedUser.cart || claimedUser.cart.length === 0) {
    throw new BadRequestError("Cart is empty");
  }

  const claimedCart: ICartItem[] = claimedUser.cart;
  let cartRestored = false;

  const decrementedItems: DecrementedItem[] = [];
  let appliedCouponCode: string | undefined;

  try {
    // Load all products fresh from database
    const productIds = claimedCart.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map<string, IProduct>();
    for (const prod of products) {
      productMap.set(prod._id.toString(), prod);
    }

    // Build items snapshot and compute subtotal in paise
    const orderItems: IOrderItemSnapshot[] = [];
    let subtotalPaise = 0;

    for (const cartItem of claimedCart) {
      const prodIdStr = cartItem.productId.toString();
      const product = productMap.get(prodIdStr);

      if (!product || !product.isActive) {
        throw new BadRequestError(`Product "${cartItem.productId.toString()}" is not available`);
      }

      if (product.listingType !== "purchasable") {
        throw new BadRequestError(`Product "${product.title}" is enquiry-only and cannot be purchased`);
      }

      let unitPrice = product.basePrice;
      if (cartItem.variantSku) {
        const variant = product.variants?.find((v) => v.sku === cartItem.variantSku);
        if (!variant) {
          throw new BadRequestError(`Variant SKU "${cartItem.variantSku}" not found on product "${product.title}"`);
        }
        if (variant.priceOverride !== undefined) {
          unitPrice = variant.priceOverride;
        }
      } else if (product.variants && product.variants.length > 0) {
        throw new BadRequestError(`Product "${product.title}" requires choosing a variant`);
      }

      const itemSnapshot: IOrderItemSnapshot = {
        productId: cartItem.productId,
        title: product.title,
        unitPrice,
        qty: cartItem.qty,
      };
      if (cartItem.variantSku !== undefined) {
        itemSnapshot.variantSku = cartItem.variantSku;
      }
      const primaryImg = product.images?.[0]?.url;
      if (primaryImg !== undefined) {
        itemSnapshot.image = primaryImg;
      }

      orderItems.push(itemSnapshot);

      const unitPricePaise = Math.round(unitPrice * 100);
      subtotalPaise += unitPricePaise * cartItem.qty;
    }

    // 1. Coupon validation & Atomic usage increment
    let discountPaise = 0;
    const currentSubtotalRupees = subtotalPaise / 100;

    if (couponCode) {
      const normalizedCode = couponCode.trim().toUpperCase();
      const coupon = await Coupon.findOne({ code: normalizedCode });
      if (!coupon || !coupon.isActive) {
        throw new BadRequestError("Coupon not found or inactive");
      }

      if (new Date(coupon.expiresAt).getTime() <= Date.now()) {
        throw new BadRequestError("Coupon has expired");
      }

      if (coupon.usedCount >= coupon.usageLimit) {
        throw new BadRequestError("Coupon usage limit has been reached");
      }

      if (currentSubtotalRupees < coupon.minOrder) {
        throw new BadRequestError(`Minimum order amount of ₹${coupon.minOrder} required for coupon`);
      }

      // Atomically increment coupon
      const couponClaimed = await atomicIncrementCoupon(normalizedCode);
      if (!couponClaimed) {
        throw new BadRequestError("Coupon usage limit was reached or coupon is no longer available");
      }
      appliedCouponCode = normalizedCode;

      if (coupon.type === "percent") {
        discountPaise = Math.round((subtotalPaise * coupon.value) / 100);
        discountPaise = Math.min(discountPaise, subtotalPaise);
      } else {
        const fixedPaise = Math.round(coupon.value * 100);
        discountPaise = Math.min(fixedPaise, subtotalPaise);
      }
    }

    // 2. Atomic Stock Decrement with Rollback on Failure
    for (const item of orderItems) {
      const success = await atomicDecrementStock(item.productId, item.variantSku, item.qty);
      if (!success) {
        throw new BadRequestError(`Insufficient stock for "${item.title}"`);
      }
      decrementedItems.push({
        productId: item.productId,
        variantSku: item.variantSku,
        qty: item.qty,
      });
    }

    // 3. Compute final pricing in integer paise
    const discountedSubtotalPaise = Math.max(0, subtotalPaise - discountPaise);
    const freeShippingThresholdPaise = Math.round(env.FREE_SHIPPING_THRESHOLD * 100);
    const flatShippingPaise = Math.round(env.SHIPPING_FLAT * 100);

    const shippingPaise =
      discountedSubtotalPaise >= freeShippingThresholdPaise ? 0 : flatShippingPaise;

    const taxPercent = env.TAX_PERCENT;
    const taxableBasePaise = discountedSubtotalPaise + shippingPaise;
    const taxPaise = Math.round((taxableBasePaise * taxPercent) / 100);

    const totalPaise = taxableBasePaise + taxPaise;

    const pricing = {
      subtotal: subtotalPaise / 100,
      shipping: shippingPaise / 100,
      tax: taxPaise / 100,
      discount: discountPaise / 100,
      total: totalPaise / 100,
    };

    // Initial status and payment status based on method
    const initialStatus = paymentMethod === "cod" ? "Placed" : "PendingPayment";
    const initialPaymentStatus = "pending";

    const orderPayload: Record<string, unknown> = {
      user: user._id,
      items: orderItems,
      shippingAddress: shippingAddressSnapshot,
      pricing,
      payment: {
        method: paymentMethod,
        status: initialPaymentStatus,
      },
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          at: new Date(),
          by: user._id.toString(),
          note: `Order created via ${paymentMethod.toUpperCase()}`,
        },
      ],
    };
    if (appliedCouponCode !== undefined) {
      orderPayload["couponCode"] = appliedCouponCode;
    }

    const order = new Order(orderPayload);
    await order.save();

    // For stripe orders restore the cart so the webhook can clear it on payment
    if (paymentMethod === "stripe") {
      await User.updateOne({ _id: userId }, { $set: { cart: claimedCart } });
      cartRestored = true;
    }

    return order;
  } catch (originalError) {
    const rollbackPromises: Promise<unknown>[] = [];

    // Restore claimed cart if it has not been restored already
    if (!cartRestored) {
      rollbackPromises.push(
        User.updateOne({ _id: userId }, { $set: { cart: claimedCart } }),
      );
    }

    // Roll back all decremented items
    for (const dec of decrementedItems) {
      rollbackPromises.push(
        atomicRestoreItemStock(dec.productId, dec.variantSku, dec.qty),
      );
    }

    // Roll back claimed coupon
    if (appliedCouponCode) {
      rollbackPromises.push(
        atomicRollbackCoupon(appliedCouponCode),
      );
    }

    const settled = await Promise.allSettled(rollbackPromises);
    for (const res of settled) {
      if (res.status === "rejected") {
        logger.error({ err: res.reason }, "Failed to execute order rollback step");
      }
    }

    throw originalError;
  }
}
