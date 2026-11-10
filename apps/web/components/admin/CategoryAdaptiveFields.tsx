"use client";

import React from "react";
import { Category } from "@yourstore/shared";

interface CategoryAdaptiveFieldsProps {
  category: Category;
  attributes: Record<string, string | number | undefined>;
  onChange: (attributes: Record<string, string | number | undefined>) => void;
}

export function CategoryAdaptiveFields({
  category,
  attributes,
  onChange,
}: CategoryAdaptiveFieldsProps) {
  const handleFieldChange = (key: string, value: string | number | undefined) => {
    onChange({
      ...attributes,
      [key]: value === "" ? undefined : value,
    });
  };

  if (category === "electronics") {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Electronics Specifications
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="elec-storage" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Storage (e.g. 256GB SSD)
            </label>
            <input
              id="elec-storage"
              type="text"
              value={(attributes["storage"]) || ""}
              onChange={(e) => handleFieldChange("storage", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="elec-ram" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              RAM (e.g. 16GB)
            </label>
            <input
              id="elec-ram"
              type="text"
              value={(attributes["ram"]) || ""}
              onChange={(e) => handleFieldChange("ram", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="elec-warranty" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Warranty (e.g. 1 Year Manufacturer)
            </label>
            <input
              id="elec-warranty"
              type="text"
              value={(attributes["warranty"]) || ""}
              onChange={(e) => handleFieldChange("warranty", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="elec-power" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Power Rating (e.g. 65W Fast Charging)
            </label>
            <input
              id="elec-power"
              type="text"
              value={(attributes["powerRating"]) || ""}
              onChange={(e) => handleFieldChange("powerRating", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }

  if (category === "clothing") {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Clothing Attributes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="cloth-gender" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Gender
            </label>
            <select
              id="cloth-gender"
              value={(attributes["gender"]) || "unisex"}
              onChange={(e) => handleFieldChange("gender", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            >
              <option value="unisex">Unisex</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="kids">Kids</option>
            </select>
          </div>
          <div>
            <label htmlFor="cloth-age" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Age Group (e.g. Adult, Teen)
            </label>
            <input
              id="cloth-age"
              type="text"
              value={(attributes["ageGroup"]) || ""}
              onChange={(e) => handleFieldChange("ageGroup", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="cloth-mat" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Material (e.g. 100% Organic Cotton)
            </label>
            <input
              id="cloth-mat"
              type="text"
              value={(attributes["material"]) || ""}
              onChange={(e) => handleFieldChange("material", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }


  if (category === "home") {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Home & Living Attributes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="home-dim" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Dimensions (e.g. 120cm x 60cm x 75cm)
            </label>
            <input
              id="home-dim"
              type="text"
              value={(attributes["dimensions"]) || ""}
              onChange={(e) => handleFieldChange("dimensions", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="home-wt" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Weight (e.g. 14.5 kg)
            </label>
            <input
              id="home-wt"
              type="text"
              value={(attributes["weight"]) || ""}
              onChange={(e) => handleFieldChange("weight", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="home-mat" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Material (e.g. Solid Teak Wood)
            </label>
            <input
              id="home-mat"
              type="text"
              value={(attributes["material"]) || ""}
              onChange={(e) => handleFieldChange("material", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }

  if (category === "foods") {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Foods & Grocery Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="food-weight" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Weight (e.g. 500g, 1kg)
            </label>
            <input
              id="food-weight"
              type="text"
              value={attributes["weight"] || ""}
              onChange={(e) => handleFieldChange("weight", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="food-expiry" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Expiry Info (e.g. 12 months from manufacture)
            </label>
            <input
              id="food-expiry"
              type="text"
              value={attributes["expiryInfo"] || ""}
              onChange={(e) => handleFieldChange("expiryInfo", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="food-vegnonveg" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Veg / Non-Veg
            </label>
            <select
              id="food-vegnonveg"
              value={attributes["vegNonVeg"] || ""}
              onChange={(e) => handleFieldChange("vegNonVeg", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            >
              <option value="">Select...</option>
              <option value="veg">Veg</option>
              <option value="non-veg">Non-Veg</option>
            </select>
          </div>
          <div>
            <label htmlFor="food-brandorigin" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Brand Origin (e.g. India, Italy)
            </label>
            <input
              id="food-brandorigin"
              type="text"
              value={attributes["brandOrigin"] || ""}
              onChange={(e) => handleFieldChange("brandOrigin", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }

  if (category === "books") {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Book Specifications
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="book-author" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Author
            </label>
            <input
              id="book-author"
              type="text"
              value={attributes["author"] || ""}
              onChange={(e) => handleFieldChange("author", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="book-publisher" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Publisher
            </label>
            <input
              id="book-publisher"
              type="text"
              value={attributes["publisher"] || ""}
              onChange={(e) => handleFieldChange("publisher", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="book-language" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Language
            </label>
            <input
              id="book-language"
              type="text"
              value={attributes["language"] || ""}
              onChange={(e) => handleFieldChange("language", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="book-pages" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Pages
            </label>
            <input
              id="book-pages"
              type="number"
              value={attributes["pages"] !== undefined ? attributes["pages"] : ""}
              onChange={(e) => handleFieldChange("pages", e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="book-isbn" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              ISBN
            </label>
            <input
              id="book-isbn"
              type="text"
              value={attributes["isbn"] || ""}
              onChange={(e) => handleFieldChange("isbn", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }

  if (category === "health") {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Health & Wellness Specifications
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="health-packsize" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Pack Size (e.g. 60 Capsules, 200ml)
            </label>
            <input
              id="health-packsize"
              type="text"
              value={attributes["packSize"] || ""}
              onChange={(e) => handleFieldChange("packSize", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="health-ingredients" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Ingredients
            </label>
            <input
              id="health-ingredients"
              type="text"
              value={attributes["ingredients"] || ""}
              onChange={(e) => handleFieldChange("ingredients", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="health-usage" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Usage Instructions
            </label>
            <input
              id="health-usage"
              type="text"
              value={attributes["usage"] || ""}
              onChange={(e) => handleFieldChange("usage", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="health-expiry" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Expiry Info (e.g. 24 months from manufacture)
            </label>
            <input
              id="health-expiry"
              type="text"
              value={attributes["expiryInfo"] || ""}
              onChange={(e) => handleFieldChange("expiryInfo", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }

  if (category === "industrial") {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Lab & Industrial Specifications
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ind-material" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Material (e.g. Borosilicate 3.3, Nitrile)
            </label>
            <input
              id="ind-material"
              type="text"
              value={attributes["material"] || ""}
              onChange={(e) => handleFieldChange("material", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="ind-capacity" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Capacity (e.g. 500 mL, 25 L)
            </label>
            <input
              id="ind-capacity"
              type="text"
              value={attributes["capacity"] || ""}
              onChange={(e) => handleFieldChange("capacity", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="ind-grade" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Grade (e.g. Class A, Industrial Heavy-Duty)
            </label>
            <input
              id="ind-grade"
              type="text"
              value={attributes["grade"] || ""}
              onChange={(e) => handleFieldChange("grade", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="ind-safetynote" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Safety Note (e.g. Autoclavable up to 121°C)
            </label>
            <input
              id="ind-safetynote"
              type="text"
              value={attributes["safetyNote"] || ""}
              onChange={(e) => handleFieldChange("safetyNote", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }

  // Gadgets
  return (
    <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        Gadget Specifications
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="gad-storage" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Storage (e.g. 128GB)
          </label>
          <input
            id="gad-storage"
            type="text"
            value={(attributes["storage"]) || ""}
            onChange={(e) => handleFieldChange("storage", e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
          />
        </div>
        <div>
          <label htmlFor="gad-ram" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            RAM (e.g. 8GB)
          </label>
          <input
            id="gad-ram"
            type="text"
            value={(attributes["ram"]) || ""}
            onChange={(e) => handleFieldChange("ram", e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
          />
        </div>
        <div>
          <label htmlFor="gad-war" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Warranty (e.g. 2 Years)
          </label>
          <input
            id="gad-war"
            type="text"
            value={(attributes["warranty"]) || ""}
            onChange={(e) => handleFieldChange("warranty", e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
          />
        </div>
      </div>
    </div>
  );
}
