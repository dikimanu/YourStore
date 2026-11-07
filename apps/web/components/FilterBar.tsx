"use client";

/**
 * FilterBar — URL-driven filter + sort bar.
 * Reads and updates URL search params via useRouter / useSearchParams.
 * Never stores state locally — URL is the single source of truth.
 */
import React, { useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface FilterBarProps {
  /** If true, also shows category selector */
  showCategory?: boolean;
}

const CATEGORIES = ["gadgets", "clothing", "electronics", "vehicles", "home"] as const;

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Price: Low → High", value: "price_asc" },
  { label: "Price: High → Low", value: "price_desc" },
  { label: "Top Rated", value: "rating" },
] as const;

export function FilterBar({ showCategory = false }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when any filter changes
      params.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const category = searchParams.get("category") ?? "";

  return (
    <div
      className={`flex flex-wrap gap-3 items-end ${isPending ? "opacity-60 pointer-events-none" : ""}`}
      aria-busy={isPending}
    >
      {showCategory && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-category" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Category
          </label>
          <select
            id="filter-category"
            value={category}
            onChange={(e) => setParam("category", e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-min" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Min Price (₹)
        </label>
        <input
          id="filter-min"
          type="number"
          min={0}
          placeholder="0"
          value={minPrice}
          onChange={(e) => setParam("minPrice", e.target.value)}
          className="w-28 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-max" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Max Price (₹)
        </label>
        <input
          id="filter-max"
          type="number"
          min={0}
          placeholder="Any"
          value={maxPrice}
          onChange={(e) => setParam("maxPrice", e.target.value)}
          className="w-28 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-sort" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Sort By
        </label>
        <select
          id="filter-sort"
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {(minPrice || maxPrice || sort || category) && (
        <button
          type="button"
          onClick={() => {
            startTransition(() => {
              router.push(pathname);
            });
          }}
          className="mt-auto px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-300 dark:border-gray-700 rounded-lg transition-colors"
          aria-label="Clear all filters"
        >
          Clear filters
        </button>
      )}

      {isPending && (
        <span className="mt-auto text-xs text-gray-500 dark:text-gray-400 animate-pulse">
          Loading…
        </span>
      )}
    </div>
  );
}
