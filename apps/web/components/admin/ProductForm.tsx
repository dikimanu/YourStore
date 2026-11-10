"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { MultiImageUpload } from "@/components/admin/MultiImageUpload";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { CategoryAdaptiveFields } from "@/components/admin/CategoryAdaptiveFields";
import type {
  CreateProductInput,
  Category,
  ProductImage,
  ProductVariant,
} from "@yourstore/shared";
import { CATEGORIES, LISTING_TYPES } from "@yourstore/shared";
import type { ListingType } from "@yourstore/shared";
import type { AdminProduct } from "@/lib/adminTypes";

interface ProductFormProps {
  initialProduct?: AdminProduct;
  isEdit?: boolean;
}

export function ProductForm({ initialProduct, isEdit = false }: ProductFormProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [title, setTitle] = useState(initialProduct?.title || "");
  const [slug, setSlug] = useState(initialProduct?.slug || "");
  const [description, setDescription] = useState(initialProduct?.description || "");
  const [category, setCategory] = useState<Category>(initialProduct?.category || "gadgets");
  const [brand, setBrand] = useState(initialProduct?.brand || "");
  const [basePrice, setBasePrice] = useState<number>(initialProduct?.basePrice || 999);
  const [stock, setStock] = useState<number>(initialProduct?.stock ?? 10);
  const [listingType, setListingType] = useState<ListingType>(
    initialProduct?.listingType || (category === "vehicles" ? "enquiry" : "purchasable"),
  );
  const [images, setImages] = useState<ProductImage[]>(initialProduct?.images || []);
  const [variants, setVariants] = useState<ProductVariant[]>(initialProduct?.variants || []);
  const [attributes, setAttributes] = useState<Record<string, string | number | undefined>>(
    (initialProduct?.attributes as Record<string, string | number | undefined>) || {},
  );
  const [submitting, setSubmitting] = useState(false);

  const handleCategoryChange = (newCat: Category) => {
    setCategory(newCat);
    // If vehicle, default listingType to enquiry
    if (newCat === "vehicles") {
      setListingType("enquiry");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast("Title is required", "error");
      return;
    }
    if (basePrice < 0) {
      showToast("Base price cannot be negative", "error");
      return;
    }
    if (category === "clothing" && variants.length === 0) {
      showToast("Clothing products require at least one variant (size/color)", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateProductInput = {
        isActive: initialProduct?.isActive ?? true,
        title: title.trim(),
        description: description.trim(),
        category,
        brand: brand.trim(),
        basePrice,
        images,
        attributes,
        listingType,
        variants: category === "clothing" ? variants : [],
        stock: category === "clothing" ? undefined : stock,
      };

      if (slug.trim()) {
        payload.slug = slug.trim();
      }

      if (isEdit && initialProduct) {
        await apiClient(`/v1/admin/products/${initialProduct.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Product updated successfully", "success");
      } else {
        await apiClient("/v1/admin/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Product created successfully", "success");
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save product",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8 max-w-4xl">
      {/* Basic Info */}
      <div className="space-y-4 p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          General Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="prod-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Product Title *
            </label>
            <input
              id="prod-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ergonomic Mechanical Keyboard"
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="prod-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Slug (Optional, auto-generated from title if blank)
            </label>
            <input
              id="prod-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. ergonomic-mechanical-keyboard"
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="prod-brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Brand / Manufacturer *
            </label>
            <input
              id="prod-brand"
              type="text"
              required
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Keychron, Apple, UrbanStyle"
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="prod-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description *
            </label>
            <textarea
              id="prod-desc"
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed product highlights, specifications, and materials..."
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="prod-cat" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Category *
            </label>
            <select
              id="prod-cat"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as Category)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prod-listing" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Listing Type *
            </label>
            <select
              id="prod-listing"
              value={listingType}
              onChange={(e) => setListingType(e.target.value as ListingType)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
            >
              {LISTING_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {lt === "purchasable" ? "Purchasable (Cart & Checkout)" : "Enquiry Only"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pricing & Stock */}
      <div className="space-y-4 p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Pricing & Inventory
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prod-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Base Price (INR ₹) *
            </label>
            <input
              id="prod-price"
              type="number"
              min="0"
              required
              value={basePrice}
              onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {category !== "clothing" && (
            <div>
              <label htmlFor="prod-stock" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Inventory Stock *
              </label>
              <input
                id="prod-stock"
                type="number"
                min="0"
                required
                value={stock}
                onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Category-Adaptive Specifications */}
      <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
        <CategoryAdaptiveFields
          category={category}
          attributes={attributes}
          onChange={setAttributes}
        />
      </div>

      {/* Variant Editor (for Clothing) */}
      {category === "clothing" && (
        <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
          <VariantEditor
            variants={variants}
            onChange={setVariants}
            basePrice={basePrice}
          />
        </div>
      )}

      {/* Multi-Image Upload */}
      <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
        <MultiImageUpload images={images} onChange={setImages} maxImages={6} />
      </div>

      {/* Submit / Cancel Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="px-5 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition disabled:opacity-50"
        >
          {submitting ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
        </button>
      </div>
    </form>
  );
}
