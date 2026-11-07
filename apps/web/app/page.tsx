import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        Welcome to <span className="text-indigo-500">YourStore</span>
      </h1>
      <p className="max-w-xl text-lg text-gray-600 dark:text-gray-400">
        A production-quality multi-category e-commerce platform. Browse gadgets, clothing,
        electronics, vehicles and home products — all in one place.
      </p>
      <a
        href="/products"
        className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-500 transition-colors"
      >
        Shop Now
      </a>
    </div>
  );
}
