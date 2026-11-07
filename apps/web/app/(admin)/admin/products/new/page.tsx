"use client";

import React from "react";
import { ProductForm } from "@/components/admin/ProductForm";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Add New Product
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Fill in the details below. Fields marked with * are required.
        </p>
      </div>
      <ProductForm />
    </div>
  );
}
