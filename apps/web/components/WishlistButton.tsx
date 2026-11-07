"use client";

import React, { useState } from "react";
import { useWishlist } from "@/lib/WishlistContext";
import { useToast } from "@/components/Toast";
import { ApiClientError } from "@/lib/api";

interface WishlistButtonProps {
  productId: string;
  className?: string | undefined;
}

export function WishlistButton({ productId, className = "" }: WishlistButtonProps) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const active = isInWishlist(productId);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      const added = await toggleWishlist(productId);
      showToast(
        added ? "Added to wishlist" : "Removed from wishlist",
        "success",
      );
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "UNAUTHORIZED") {
        showToast("Please log in to manage your wishlist", "info");
      } else {
        showToast(
          err instanceof Error ? err.message : "Failed to update wishlist",
          "error",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      disabled={loading}
      onClick={(e) => void handleToggle(e)}
      className={`p-2 rounded-full border transition flex items-center justify-center ${
        active
          ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
          : "border-gray-300 dark:border-gray-700 hover:border-gray-400 text-gray-400 hover:text-red-500 bg-white/80 dark:bg-gray-900/80"
      } ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}
