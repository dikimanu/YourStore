"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { ProductForm } from "@/components/admin/ProductForm";
import { useToast } from "@/components/Toast";
import type { AdminProduct } from "@/lib/adminTypes";

interface ProductDetailResponse {
  product: AdminProduct;
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      showToast("Invalid product ID", "error");
      router.push("/admin");
      return;
    }

    let isMounted = true;

    async function fetchProduct() {
      try {
        const res = await apiClient<ProductDetailResponse>(`/v1/admin/products/${id}`);
        if (isMounted) {
          setProduct(res.product);
        }
      } catch (err) {
        if (isMounted) {
          showToast(
            err instanceof Error ? err.message : "Failed to load product",
            "error",
          );
          router.push("/admin");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [id, router, showToast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4" role="status">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading product...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        Product not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Edit Product
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Editing: <strong className="text-gray-800 dark:text-gray-200">{product.title}</strong>
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-mono">/{product.slug}</span>
        </p>
      </div>
      <ProductForm initialProduct={product} isEdit />
    </div>
  );
}
