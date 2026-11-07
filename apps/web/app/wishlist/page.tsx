"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@yourstore/shared";

export default function WishlistPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient<{ products: Product[] }>("/api/v1/wishlist");
      setProducts(res.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWishlist();
  }, [fetchWishlist]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]" role="status">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="text-5xl">🤍</div>
        <h1 className="text-2xl font-bold">Your Wishlist is Empty</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto text-sm">
          Explore our collection and click the heart icon on any product to save it here for later.
        </p>
        <Link
          href="/products"
          className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm mt-2"
        >
          Explore Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Wishlist</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {products.length} item{products.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
