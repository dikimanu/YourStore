/**
 * ProductCardSkeleton — loading placeholder for product cards with shimmer.
 * Matches ProductCard layout exactly so there's no layout shift.
 */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="w-full aspect-[4/3] skeleton" />
      <div className="flex flex-col p-4 gap-3">
        <div className="h-3 w-16 skeleton rounded" />
        <div className="h-4 w-full skeleton rounded" />
        <div className="h-4 w-3/4 skeleton rounded" />
        <div className="mt-2 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="h-5 w-20 skeleton rounded" />
          <div className="h-4 w-10 skeleton rounded" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
