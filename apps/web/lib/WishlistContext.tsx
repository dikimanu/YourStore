"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";

interface WishlistContextValue {
  wishlistIds: string[];
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<boolean>;
  refreshWishlist: () => Promise<void>;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  const refreshWishlist = useCallback(async () => {
    try {
      const data = await apiClient<{ products: Array<{ id?: string; _id?: string }> }>("/api/v1/wishlist");
      const ids = (data.products || []).map((p) => p.id ?? p._id ?? "").filter(Boolean);
      setWishlistIds(ids);
    } catch {
      // User might be unauthenticated
      setWishlistIds([]);
    }
  }, []);

  useEffect(() => {
    void refreshWishlist();
  }, [refreshWishlist]);

  const isInWishlist = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds],
  );

  const toggleWishlist = useCallback(
    async (productId: string): Promise<boolean> => {
      const isCurrentlyIn = wishlistIds.includes(productId);
      const nextIds = isCurrentlyIn
        ? wishlistIds.filter((id) => id !== productId)
        : [...wishlistIds, productId];

      // Optimistic update
      setWishlistIds(nextIds);

      try {
        if (isCurrentlyIn) {
          await apiClient(`/api/v1/wishlist/${productId}`, { method: "DELETE" });
        } else {
          await apiClient("/api/v1/wishlist", {
            method: "POST",
            body: JSON.stringify({ productId }),
          });
        }
        return !isCurrentlyIn;
      } catch (err) {
        // Roll back on error
        setWishlistIds(wishlistIds);
        throw err;
      }
    },
    [wishlistIds],
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        isInWishlist,
        toggleWishlist,
        refreshWishlist,
        count: wishlistIds.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return ctx;
}
