import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/ProductCard";
import { FilterBar } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { fetchProducts } from "@/lib/serverApi";
import { CATEGORIES, Category, Product } from "@yourstore/shared";

export const revalidate = 60;
export const dynamicParams = true;

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function isValidCategory(cat: string): cat is Category {
  return (CATEGORIES as readonly string[]).includes(cat);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isValidCategory(category)) {
    return { title: "Category Not Found" };
  }
  const title = category.charAt(0).toUpperCase() + category.slice(1);
  return {
    title: `${title} — YourStore`,
    description: `Shop our curated selection of ${category} products.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category } = await params;
  if (!isValidCategory(category)) {
    notFound();
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const search = sp.search ?? sp.q ?? "";
  const sort = sp.sort ?? "newest";
  const minPrice = sp.minPrice;
  const maxPrice = sp.maxPrice;

  const data = await fetchProducts<Product>(
    {
      page,
      limit: 16,
      category,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
      ...(minPrice ? { minPrice } : {}),
      ...(maxPrice ? { maxPrice } : {}),
    },
    { revalidate: 60, tags: ["products", `category-${category}`] },
  ).catch(() => null);

  const products = data?.products ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;
  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{categoryTitle}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {total} product{total !== 1 ? "s" : ""} available
        </p>
      </div>

      <Suspense>
        <FilterBar showCategory={false} />
      </Suspense>

      {products.length === 0 ? (
        <div className="py-20 text-center text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-4">📦</p>
          <p className="font-medium">No products found in this category.</p>
          <p className="text-sm mt-1">Try adjusting your filters or price range.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
