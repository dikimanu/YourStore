"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/CartContext";
import { useToast } from "@/components/Toast";
import { ApiClientError } from "@/lib/api";

export default function CartPage() {
  const { cart, guestItems, isLoading, updateQty, removeItem } = useCart();
  const { showToast } = useToast();
  const [pendingOps, setPendingOps] = useState<Record<string, boolean>>({});

  const makeKey = (productId: string, variantSku?: string  ) =>
    variantSku ? `${productId}:${variantSku}` : productId;

  const handleUpdateQty = async (
    productId: string,
    qty: number,
    variantSku?: string  ,
  ) => {
    const key = makeKey(productId, variantSku);
    setPendingOps((prev) => ({ ...prev, [key]: true }));
    try {
      await updateQty(productId, qty, variantSku);
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to update quantity", "error");
    } finally {
      setPendingOps((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleRemove = async (productId: string, variantSku?: string  ) => {
    const key = makeKey(productId, variantSku);
    setPendingOps((prev) => ({ ...prev, [key]: true }));
    try {
      await removeItem(productId, variantSku);
      showToast("Item removed from cart", "success");
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to remove item", "error");
    } finally {
      setPendingOps((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]" role="status">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Logged-in cart
  if (cart) {
    if (cart.items.length === 0) {
      return (
        <div className="text-center py-24 space-y-4">
          <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">Your cart is empty</p>
          <p className="text-gray-500 dark:text-gray-400">Browse our products and add items to get started.</p>
          <Link
            href="/products"
            className="inline-block mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Shop Now
          </Link>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Shopping Cart</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart lines */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => {
              const key = makeKey(item.productId, item.variantSku);
              const isPending = pendingOps[key] === true;
              return (
                <div
                  key={key}
                  className="flex gap-4 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900"
                >
                  {item.image && (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized={
                          item.image.startsWith("https://placehold.co") ||
                          item.image.startsWith("data:")
                        }
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug}`}
                      className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
                    >
                      {item.title}
                    </Link>
                    {item.variantSku && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        SKU: {item.variantSku}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                      ₹{item.price.toLocaleString("en-IN")}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <label
                        htmlFor={`qty-${key}`}
                        className="text-xs text-gray-500 dark:text-gray-400"
                      >
                        Qty:
                      </label>
                      <select
                        id={`qty-${key}`}
                        value={item.qty}
                        disabled={isPending}
                        onChange={(e) =>
                          void handleUpdateQty(item.productId, Number(e.target.value), item.variantSku)
                        }
                        className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900 disabled:opacity-50"
                      >
                        {Array.from({ length: Math.min(10, item.stock) }, (_, i) => i + 1).map(
                          (n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ),
                        )}
                      </select>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          void handleRemove(item.productId, item.variantSku)
                        }
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      ₹{item.lineTotal.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 space-y-4 sticky top-24">
              <h2 className="text-lg font-semibold">Order Summary</h2>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>Subtotal ({cart.itemCount} items)</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  ₹{cart.subtotal.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Shipping and taxes calculated at checkout.
              </p>
              <Link
                href="/checkout"
                className="block w-full text-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
              >
                Proceed to Checkout
              </Link>
              <Link
                href="/products"
                className="block w-full text-center py-2 px-4 border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Guest cart (in-memory)
  if (guestItems.length === 0) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">Your cart is empty</p>
        <Link
          href="/products"
          className="inline-block mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Shopping Cart</h1>
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
        <strong>You are browsing as a guest.</strong>{" "}
        <Link href="/login" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">
          Log in
        </Link>{" "}
        to save your cart and proceed to checkout.
      </div>
      <div className="space-y-3">
        {guestItems.map((item) => {
          const key = item.variantSku ? `${item.productId}:${item.variantSku}` : item.productId;
          const isPending = pendingOps[key] === true;
          return (
            <div
              key={key}
              className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900"
            >
              <div className="text-sm text-gray-900 dark:text-gray-100">
                <span className="font-medium">Product ID: {item.productId}</span>
                {item.variantSku && <span className="ml-2 text-gray-500">({item.variantSku})</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">Qty: {item.qty}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void handleRemove(item.productId, item.variantSku)}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <Link
        href="/login"
        className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
      >
        Log in to Checkout
      </Link>
    </div>
  );
}
