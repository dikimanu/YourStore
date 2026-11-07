import type { Metadata } from "next";
import Link from "next/link";
import { ToastProvider } from "../components/Toast";
import { CartProvider } from "../lib/CartContext";
import { WishlistProvider } from "../lib/WishlistContext";
import { RecentlyViewedProvider } from "../lib/RecentlyViewedContext";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "YourStore",
    template: "%s | YourStore",
  },
  description: "Multi-category e-commerce platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 antialiased flex flex-col justify-between">
        <ToastProvider>
          <CartProvider>
            <WishlistProvider>
              <RecentlyViewedProvider>
                <div>
                  <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-40">
                    <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
                      <Link href="/" className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                        YourStore
                      </Link>
                      <nav className="flex gap-6 items-center text-sm font-medium">
                        <Link href="/products" className="hover:underline">
                          Products
                        </Link>
                        <Link href="/wishlist" className="hover:underline">
                          Wishlist
                        </Link>
                        <Link href="/cart" className="hover:underline">
                          Cart
                        </Link>
                        <Link href="/orders" className="hover:underline">
                          My Orders
                        </Link>
                        <Link href="/login" className="hover:underline">
                          Log In
                        </Link>
                        <Link
                          href="/register"
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition"
                        >
                          Sign Up
                        </Link>
                      </nav>
                    </div>
                  </header>
                  <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
                </div>
                <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
                  <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    &copy; {new Date().getFullYear()} YourStore. All rights reserved.
                  </div>
                </footer>
              </RecentlyViewedProvider>
            </WishlistProvider>
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
