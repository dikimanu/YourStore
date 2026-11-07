"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import NextLink from "next/link";
import { useRecentlyViewed } from "@/lib/RecentlyViewedContext";
import type { RecentlyViewedItem } from "@/lib/RecentlyViewedContext";

interface RecentlyViewedProps {
  currentProduct?: RecentlyViewedItem | undefined;
}

export function RecentlyViewed({ currentProduct }: RecentlyViewedProps) {
  const { items, addItem } = useRecentlyViewed();

  useEffect(() => {
    if (currentProduct) {
      addItem(currentProduct);
    }
  }, [currentProduct, addItem]);

  // Exclude current product from the display list
  const displayItems = currentProduct
    ? items.filter((item) => item.id !== currentProduct.id && item.slug !== currentProduct.slug)
    : items;

  if (displayItems.length === 0) return null;

  return (
    <section className="pt-12 border-t border-gray-200 dark:border-gray-800 space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold">Recently Viewed</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {displayItems.map((item) => (
          <NextLink
            key={item.id}
            href={`/product/${item.slug}`}
            className="group block border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-600 transition"
          >
            {item.image && (
              <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition"
                  unoptimized={
                    item.image.startsWith("https://placehold.co") ||
                    item.image.startsWith("data:")
                  }
                />
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">
              {item.brand}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mt-0.5">
              {item.title}
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
              ₹{item.basePrice.toLocaleString("en-IN")}
            </p>
          </NextLink>
        ))}
      </div>
    </section>
  );
}
