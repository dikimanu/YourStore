import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts } from "@/lib/serverApi";
import type { Product } from "@yourstore/shared";
import { HeroCarousel } from "@/components/HeroCarousel";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Home — YourStore",
  description:
    "Shop gadgets, clothing, electronics, vehicles, home, foods, books, health and industrial products at YourStore.",
};

const CATEGORY_META: Record<
  string,
  { label: string; emoji: string; color: string }
> = {
  gadgets: { label: "Gadgets", emoji: "🎧", color: "from-purple-600 to-indigo-600" },
  clothing: { label: "Clothing", emoji: "👕", color: "from-pink-500 to-rose-500" },
  electronics: { label: "Electronics", emoji: "💻", color: "from-blue-600 to-cyan-500" },
  vehicles: { label: "Vehicles", emoji: "🚗", color: "from-green-600 to-teal-500" },
  home: { label: "Home", emoji: "🏠", color: "from-orange-500 to-amber-500" },
  foods: { label: "Foods & Grocery", emoji: "🍎", color: "from-emerald-500 to-lime-600" },
  books: { label: "Books", emoji: "📚", color: "from-amber-600 to-yellow-600" },
  health: { label: "Health & Wellness", emoji: "🩺", color: "from-teal-500 to-cyan-600" },
  industrial: { label: "Lab & Industrial Supplies", emoji: "⚙️", color: "from-slate-600 to-zinc-700" },
};

export default async function HomePage() {
  // Fetch featured products (latest 8) for the homepage
  const data = await fetchProducts<Product>(
    { limit: 8, sort: "newest" },
    { revalidate: 60, tags: ["products"] },
  ).catch(() => null);

  const featured = data?.products ?? [];

  return (
    <div className="space-y-16">
      <HeroCarousel />

      {/* Categories grid */}
      <section>
        <h2 className="text-2xl font-bold mb-6 section-heading">Shop by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(CATEGORY_META).map(([slug, meta]) => (
            <Link
              key={slug}
              href={`/category/${slug}`}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br ${meta.color} p-6 text-white font-semibold text-center hover:scale-105 hover:shadow-lg transition-transform duration-200`}
            >
              <span className="text-3xl" role="img" aria-label={meta.label}>
                {meta.emoji}
              </span>
              <span>{meta.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      {featured.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold section-heading">New Arrivals</h2>
            <Link
              href="/products"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* USP strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        {[
          { icon: "🚀", title: "Fast Delivery", sub: "Pan-India shipping" },
          { icon: "🔒", title: "Secure Payments", sub: "256-bit encryption" },
          { icon: "↩️", title: "Easy Returns", sub: "7-day hassle-free" },
          { icon: "⭐", title: "Top Quality", sub: "Curated catalogue" },
        ].map((usp) => (
          <div
            key={usp.title}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-1"
          >
            <div className="text-2xl">{usp.icon}</div>
            <p className="font-semibold text-sm">{usp.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{usp.sub}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
