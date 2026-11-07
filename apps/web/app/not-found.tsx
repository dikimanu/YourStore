import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Page Not Found",
  description: "The page you requested could not be found.",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-5">
      <div className="text-7xl font-extrabold text-blue-600 dark:text-blue-400">404</div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
        Page Not Found
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
        The page you are looking for might have been moved, removed, or does not exist.
      </p>
      <div className="pt-2 flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          Return to Home
        </Link>
        <Link
          href="/products"
          className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold rounded-xl transition"
        >
          Browse Products
        </Link>
      </div>
    </div>
  );
}
