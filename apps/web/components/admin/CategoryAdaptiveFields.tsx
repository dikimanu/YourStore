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

  if (category === "vehicles") {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Vehicle Specifications
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="veh-year" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Model Year
            </label>
            <input
              id="veh-year"
              type="number"
              placeholder="2024"
              value={(attributes["modelYear"]) ?? ""}
              onChange={(e) =>
                handleFieldChange(
                  "modelYear",
                  e.target.value ? parseInt(e.target.value, 10) : undefined,
                )
              }
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="veh-mileage" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Mileage (e.g. 18 km/l or 450 km range)
            </label>
            <input
              id="veh-mileage"
              type="text"
              value={(attributes["mileage"]) || ""}
              onChange={(e) => handleFieldChange("mileage", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="veh-fuel" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Fuel Type
            </label>
            <select
              id="veh-fuel"
              value={(attributes["fuelType"]) || "electric"}
              onChange={(e) => handleFieldChange("fuelType", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            >
              <option value="electric">Electric</option>
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="hybrid">Hybrid</option>
              <option value="cng">CNG</option>
            </select>
          </div>
          <div>
            <label htmlFor="veh-trans" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Transmission
            </label>
            <select
              id="veh-trans"
              value={(attributes["transmission"]) || "automatic"}
              onChange={(e) => handleFieldChange("transmission", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            >
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label htmlFor="veh-cond" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Condition
            </label>
            <select
              id="veh-cond"
              value={(attributes["condition"]) || "new"}
              onChange={(e) => handleFieldChange("condition", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            >
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
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
