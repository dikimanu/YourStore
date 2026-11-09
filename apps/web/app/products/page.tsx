import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductCard } from "@/components/ProductCard";
import { FilterBar } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { fetchProducts } from "@/lib/serverApi";
import type { Product } from "@yourstore/shared";

export const revalidate = 60;

export const metadata: Metadata = { title: "All Products" };

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const search = sp.search ?? sp.q ?? "";
  const sort = sp.sort ?? "newest";
  const minPrice = sp.minPrice;
  const maxPrice = sp.maxPrice;
  const category = sp.category ?? "";

  const data = await fetchProducts<Product>(
    {
      page,
      limit: 16,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
      ...(minPrice ? { minPrice } : {}),
      ...(maxPrice ? { maxPrice } : {}),
      ...(category ? { category } : {}),
    },
    { revalidate: 60, tags: ["products"] },
  ).catch(() => null);

  const products = data?.products ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold section-heading">
          {search ? `Results for "${search}"` : "All Products"}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {total} product{total !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Search box */}
      <form method="GET" action="/products" className="flex gap-2">
        <label htmlFor="products-search" className="sr-only">
          Search products
        </label>
        <input
          id="products-search"
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Search by name or brand…"
          className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Search
        </button>
      </form>

      {/* Filter bar (client component, Suspense boundary required for useSearchParams) */}
      <Suspense>
        <FilterBar showCategory />
      </Suspense>

      {products.length === 0 ? (
        <div className="py-20 text-center text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-4">🔍</p>
          <p className="font-medium">No products match your filters.</p>
          <p className="text-sm mt-1">Try adjusting the search or clearing filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}

      <Suspense>
        <Pagination currentPage={page} totalPages={totalPages} />
      </Suspense>
    </div>
  );
}
