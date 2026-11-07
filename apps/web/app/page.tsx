import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts } from "@/lib/serverApi";
import type { Product } from "@yourstore/shared";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Home — YourStore",
  description:
    "Shop gadgets, clothing, electronics, vehicles and home products at YourStore.",
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
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 px-6 py-16 sm:px-12 sm:py-24 text-white text-center">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Everything you need,{" "}
            <span className="text-yellow-300">delivered fast.</span>
          </h1>
          <p className="text-lg text-blue-100 max-w-xl mx-auto">
            Explore 60+ products across gadgets, clothing, electronics, vehicles
            and home — curated for quality, priced for India.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/products"
              className="rounded-lg bg-white text-blue-700 font-semibold px-6 py-3 hover:bg-blue-50 transition"
            >
              Shop All
            </Link>
            <Link
              href="/category/electronics"
              className="rounded-lg border border-white/40 text-white font-semibold px-6 py-3 hover:bg-white/10 transition"
            >
              Browse Electronics
            </Link>
          </div>
        </div>
        {/* Decorative blobs */}
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </section>

      {/* Categories grid */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Shop by Category</h2>
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
            <h2 className="text-2xl font-bold">New Arrivals</h2>
            <Link
              href="/products"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
