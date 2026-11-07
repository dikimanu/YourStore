"use client";

import React from "react";
import type { Variant } from "@yourstore/shared";

interface VariantSelectorProps {
  variants: Variant[];
  selectedSku: string;
  onSelectSku: (sku: string) => void;
}

export function VariantSelector({
  variants,
  selectedSku,
  onSelectSku,
}: VariantSelectorProps) {
  if (variants.length === 0) return null;

  return (
    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Choose a Variant
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {variants.map((v) => {
          const isSelected = v.sku === selectedSku;
          const inStock = v.stock > 0;
          const isLowStock = inStock && v.stock <= 5;

          return (
            <button
              type="button"
              key={v.sku}
              onClick={() => onSelectSku(v.sku)}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                isSelected
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-600/30"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
              }`}
            >
              <div>
                <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                  {v.options.size || "Standard"}
                  {v.options.color && ` · ${v.options.color}`}
                </div>
                {v.priceOverride !== undefined && (
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-0.5">
                    ₹{v.priceOverride.toLocaleString("en-IN")}
                  </div>
                )}
              </div>

              {/* Per-variant stock badge */}
              <div className="mt-2">
                {!inStock ? (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                    Out of stock
                  </span>
                ) : isLowStock ? (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Only {v.stock} left
                  </span>
                ) : (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                    {v.stock} in stock
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
