import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";

export default function CategoryLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-28 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"
          />
        ))}
      </div>
      <ProductGridSkeleton count={16} />
    </div>
  );
}
