"use client";

import React, { useEffect } from "react";
import Link from "next/link";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log unexpected errors
    console.error("Storefront error caught:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-5">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 text-3xl">
        ⚠️
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
        Something went wrong
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
        An unexpected error occurred while loading this page. You can try reloading or return home.
      </p>
      <div className="pt-2 flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold rounded-xl transition"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
