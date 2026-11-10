"use client";

/**
 * FilterBar — URL-driven filter + sort bar with responsive mobile collapse drawer.
 * Reads and updates URL search params via useRouter / useSearchParams.
 * Never stores state locally — URL is the single source of truth.
 */
import React, { useCallback, useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface FilterBarProps {
  /** If true, also shows category selector */
  showCategory?: boolean;
}

const CATEGORIES = ["gadgets", "clothing", "electronics", "home", "foods", "books", "health", "industrial"] as const;

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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Close drawer on navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname, searchParams]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
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
  const hasActiveFilters = Boolean(minPrice || maxPrice || sort || category);

  const filterControls = (
    <>
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
          className="w-full sm:w-28 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
          className="w-full sm:w-28 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

      {hasActiveFilters && (
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
    </>
  );

  return (
    <>
      {/* Mobile trigger button */}
      <div className="md:hidden flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          aria-expanded={mobileDrawerOpen}
          aria-controls="mobile-filter-drawer"
        >
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          Filters & Sort {hasActiveFilters ? "• Active" : ""}
        </button>
        {isPending && (
          <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
            Loading…
          </span>
        )}
      </div>

      {/* Desktop view */}
      <div
        className={`hidden md:flex flex-wrap gap-3 items-end ${isPending ? "opacity-60 pointer-events-none" : ""}`}
        aria-busy={isPending}
      >
        {filterControls}
      </div>

      {/* Mobile slide-over drawer backdrop */}
      {mobileDrawerOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile slide-over drawer */}
      <div
        id="mobile-filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Filter products"
        className={`fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] bg-white dark:bg-gray-950 p-6 shadow-2xl flex flex-col gap-5 overflow-y-auto transition-transform duration-250 ease-out md:hidden ${
          mobileDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold">Filters & Sort</h2>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1 rounded text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {filterControls}
        </div>
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(false)}
          className="mt-auto w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
        >
          Apply Filters
        </button>
      </div>
    </>
  );
}
