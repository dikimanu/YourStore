export default function ProductLoading() {
  return (
    <div className="space-y-16 animate-pulse">
      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-800 rounded" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <div className="space-y-4">
          <div className="aspect-[4/3] w-full rounded-2xl bg-gray-200 dark:bg-gray-800" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg bg-gray-200 dark:bg-gray-800"
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>

          <div className="h-9 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-20 w-full bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-12 w-full bg-gray-200 dark:bg-gray-800 rounded-xl" />

          <div className="space-y-2 pt-6">
            <div className="h-5 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 dark:bg-gray-800 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
