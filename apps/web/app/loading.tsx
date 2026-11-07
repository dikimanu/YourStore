import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-16">
      {/* Hero skeleton */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-800 h-64 animate-pulse" />
      {/* Category grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
      {/* Product grid skeleton */}
      <ProductGridSkeleton count={8} />
    </div>
  );
}
