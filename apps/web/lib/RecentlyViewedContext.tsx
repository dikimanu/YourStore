"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type RecentlyViewedItem = {
  id: string;
  slug: string;
  title: string;
  basePrice: number;
  image?: string | undefined;
  category: string;
  brand: string;
};

interface RecentlyViewedContextValue {
  items: RecentlyViewedItem[];
  addItem: (product: RecentlyViewedItem) => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(null);

const MAX_RECENTLY_VIEWED = 8;

export function RecentlyViewedProvider({ children }: { children: React.ReactNode }) {
  // Pure in-memory React state — never localStorage or sessionStorage
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  const addItem = useCallback((product: RecentlyViewedItem) => {
    setItems((prev) => {
      // Remove any duplicate of this product
      const filtered = prev.filter((item) => item.id !== product.id && item.slug !== product.slug);
      // Put the new product at the front, max 8 items
      return [product, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
    });
  }, []);

  return (
    <RecentlyViewedContext.Provider value={{ items, addItem }}>
      {children}
    </RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed(): RecentlyViewedContextValue {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) {
    throw new Error("useRecentlyViewed must be used within a RecentlyViewedProvider");
  }
  return ctx;
}
