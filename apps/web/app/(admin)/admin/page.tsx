"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "../../../lib/api";
import { useToast } from "../../../components/Toast";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Product } from "@yourstore/shared";

interface AdminProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminProductsPage() {
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Inline stock editing states
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockValue, setStockValue] = useState<number>(0);
  const [updatingStock, setUpdatingStock] = useState(false);

  // Soft delete confirm dialog
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "15",
      });
      if (debouncedSearch.trim()) {
        queryParams.set("search", debouncedSearch.trim());
      }

      const res = await apiClient<AdminProductsResponse>(
        `/v1/admin/products?${queryParams.toString()}`,
      );
      setProducts(res.products);
      setTotalPages(res.pagination.totalPages || 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load products",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, showToast]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const handleStockSave = async (product: Product) => {
    if (stockValue < 0) {
      showToast("Stock cannot be negative", "error");
      return;
    }
    setUpdatingStock(true);
    try {
      await apiClient(`/v1/admin/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({ stock: stockValue }),
      });
      showToast(`Stock updated for ${product.title}`, "success");
      setEditingStockId(null);
      void fetchProducts();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update stock",
        "error",
      );
    } finally {
      setUpdatingStock(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      await apiClient(`/v1/admin/products/${productToDelete.id}`, {
        method: "DELETE",
      });
      showToast(`Product "${productToDelete.title}" soft deleted`, "success");
      setProductToDelete(null);
      void fetchProducts();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete product",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="w-full sm:w-96">
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <input
            id="product-search"
            type="search"
            placeholder="Search products by title or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          />
        </div>
        <div className="text-sm text-gray-500">
          Showing page {page} of {totalPages}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                Product
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                Category
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                Base Price
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                Stock
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const isEditingThisStock = editingStockId === product.id;
                const totalVariantStock =
                  product.variants && product.variants.length > 0
                    ? product.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
                    : null;

                return (
                  <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{product.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">/{product.slug}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-300">
                      {product.category}
                    </td>
                    <td className="px-4 py-3 font-medium">₹{product.basePrice.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      {totalVariantStock !== null ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {totalVariantStock} across {product.variants?.length} variants
                        </span>
                      ) : isEditingThisStock ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            aria-label={`Stock for ${product.title}`}
                            className="w-20 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-900"
                            value={stockValue}
                            onChange={(e) => setStockValue(parseInt(e.target.value, 10) || 0)}
                          />
                          <button
                            type="button"
                            disabled={updatingStock}
                            onClick={() => void handleStockSave(product)}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStockId(null)}
                            className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{product.stock ?? 0}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStockId(product.id);
                              setStockValue(product.stock ?? 0);
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          product.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {product.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Edit
                      </Link>
                      {product.isActive && (
                        <button
                          type="button"
                          onClick={() => setProductToDelete(product)}
                          className="text-red-600 dark:text-red-400 hover:underline font-medium"
                        >
                          Soft Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* Soft Delete Confirm Modal */}
      <ConfirmDialog
        isOpen={productToDelete !== null}
        title="Soft Delete Product"
        message={`Are you sure you want to soft delete "${productToDelete?.title}"? It will be marked inactive and hidden from the public storefront, but existing orders will preserve their historical snapshots.`}
        confirmText={deleting ? "Deleting..." : "Soft Delete"}
        isDangerous
        onConfirm={() => void handleSoftDelete()}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}
