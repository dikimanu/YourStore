"use client";

import React from "react";
import type { ProductVariant } from "@yourstore/shared";

interface VariantEditorProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  basePrice: number;
}

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Free Size"];
const COMMON_COLORS = ["Black", "White", "Navy", "Grey", "Red", "Blue", "Green", "Beige"];

export function VariantEditor({
  variants,
  onChange,
  basePrice,
}: VariantEditorProps) {
  const handleAddVariant = () => {
    const nextSku = `SKU-${Date.now().toString().slice(-6)}`;
    const newVariant: ProductVariant = {
      sku: nextSku,
      options: {
        size: "M",
        color: "Black",
      },
      priceOverride: basePrice,
      stock: 10,
    };
    onChange([...variants, newVariant]);
  };

  const handleRemoveVariant = (index: number) => {
    onChange(variants.filter((_, idx) => idx !== index));
  };

  const handleUpdateVariant = (
    index: number,
    field: string,
    value: string | number | undefined,
  ) => {
    const updated = [...variants];
    const item = updated[index];
    if (!item) return;

    if (field === "size") {
      updated[index] = {
        ...item,
        options: {
          ...item.options,
          size: typeof value === "string" ? value : undefined,
        },
      };
    } else if (field === "color") {
      updated[index] = {
        ...item,
        options: {
          ...item.options,
          color: typeof value === "string" ? value : undefined,
        },
      };
    } else if (field === "priceOverride") {
      updated[index] = {
        ...item,
        priceOverride: typeof value === "number" ? value : undefined,
      };
    } else if (field === "stock") {
      updated[index] = {
        ...item,
        stock: typeof value === "number" ? value : 0,
      };
    } else if (field === "sku") {
      updated[index] = {
        ...item,
        sku: String(value),
      };
    }

    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Product Variants (Clothing)
          </label>
          <p className="text-xs text-gray-500">
            Define SKU, size, color, price override (optional) and inventory stock for each variant.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddVariant}
          className="px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition"
        >
          + Add Variant
        </button>
      </div>

      {variants.length === 0 ? (
        <div className="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center text-sm text-gray-500">
          No variants defined yet. Click &quot;+ Add Variant&quot; to configure clothing options.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  SKU
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Size
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Color
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Price Override (₹)
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Stock
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
              {variants.map((v, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      aria-label={`SKU for variant ${idx + 1}`}
                      className="w-28 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-transparent"
                      value={v.sku}
                      onChange={(e) => handleUpdateVariant(idx, "sku", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      list="size-suggestions"
                      aria-label={`Size for variant ${idx + 1}`}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-transparent"
                      value={v.options?.size || ""}
                      onChange={(e) => handleUpdateVariant(idx, "size", e.target.value)}
                    />
                    <datalist id="size-suggestions">
                      {COMMON_SIZES.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      list="color-suggestions"
                      aria-label={`Color for variant ${idx + 1}`}
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-transparent"
                      value={v.options?.color || ""}
                      onChange={(e) => handleUpdateVariant(idx, "color", e.target.value)}
                    />
                    <datalist id="color-suggestions">
                      {COMMON_COLORS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      aria-label={`Price override for variant ${idx + 1}`}
                      placeholder={`₹${basePrice}`}
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-transparent"
                      value={v.priceOverride ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                        handleUpdateVariant(idx, "priceOverride", val);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      aria-label={`Stock for variant ${idx + 1}`}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-transparent"
                      value={v.stock}
                      onChange={(e) =>
                        handleUpdateVariant(
                          idx,
                          "stock",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(idx)}
                      className="text-red-600 hover:text-red-700 dark:hover:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
