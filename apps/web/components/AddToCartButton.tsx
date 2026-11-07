"use client";

import React, { useState } from "react";
import { useCart } from "@/lib/CartContext";
import { useToast } from "@/components/Toast";
import { ApiClientError } from "@/lib/api";

interface AddToCartButtonProps {
  productId: string;
  variantSku?: string | undefined;
  inStock: boolean;
}

export function AddToCartButton({ productId, variantSku, inStock }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const item: { productId: string; qty: number; variantSku?: string | undefined } = {
        productId,
        qty: 1,
      };
      if (variantSku !== undefined) {
        item.variantSku = variantSku;
      }
      await addItem(item);
      showToast("Added to cart!", "success");
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : "Could not add to cart",
        "error",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={!inStock || pending}
      onClick={() => void handleClick()}
      className="w-full py-3.5 px-6 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Adding…" : inStock ? "Add to Cart" : "Out of Stock"}
    </button>
  );
}
