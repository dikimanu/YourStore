"use client";

import React, { useState } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { VariantSelector } from "@/components/VariantSelector";
import { WishlistButton } from "@/components/WishlistButton";
import type { Product, Variant } from "@yourstore/shared";

interface ProductInteractiveSectionProps {
  product: Product & { id: string };
  isEnquiry: boolean;
}

export function ProductInteractiveSection({
  product,
  isEnquiry,
}: ProductInteractiveSectionProps) {
  const hasVariants = product.variants && product.variants.length > 0;
  const [selectedSku, setSelectedSku] = useState<string>(
    hasVariants && product.variants[0] ? product.variants[0].sku : "",
  );

  const selectedVariant: Variant | undefined = hasVariants
    ? product.variants.find((v) => v.sku === selectedSku)
    : undefined;

  // Active price
  const displayPrice =
    selectedVariant && selectedVariant.priceOverride !== undefined
      ? selectedVariant.priceOverride
      : product.basePrice;

  // Active stock
  const isAvailable = hasVariants
    ? (selectedVariant?.stock ?? 0) > 0
    : product.stock === undefined || product.stock > 0;

  const currentStock = hasVariants
    ? (selectedVariant?.stock ?? 0)
    : product.stock;

  return (
    <div className="space-y-6">
      {/* Price & Stock Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            ₹{displayPrice.toLocaleString("en-IN")}
          </span>
          {isEnquiry ? (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Enquiry Only
            </span>
          ) : isAvailable ? (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
              In Stock {currentStock !== undefined ? `(${currentStock})` : ""}
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
              Out of Stock
            </span>
          )}
        </div>

        {/* Wishlist toggle */}
        <WishlistButton productId={product.id} />
      </div>

      {/* Variant Selector */}
      {hasVariants && (
        <VariantSelector
          variants={product.variants}
          selectedSku={selectedSku}
          onSelectSku={(sku) => setSelectedSku(sku)}
        />
      )}

      {/* Main Desktop Add to Cart / Enquire */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
        {isEnquiry ? (
          <div className="w-full text-center py-3.5 px-6 rounded-xl font-semibold bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer">
            Submit Enquiry
          </div>
        ) : (
          <AddToCartButton
            productId={product.id}
            variantSku={hasVariants ? selectedSku : undefined}
            inStock={isAvailable}
          />
        )}
      </div>

      {/* Sticky Mobile Bar */}
      {!isEnquiry && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-3 shadow-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Price</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              ₹{displayPrice.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="w-48">
            <AddToCartButton
              productId={product.id}
              variantSku={hasVariants ? selectedSku : undefined}
              inStock={isAvailable}
            />
          </div>
        </div>
      )}
    </div>
  );
}
