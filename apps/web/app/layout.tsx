import type { Metadata } from "next";
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
      <body className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 antialiased">
        <header className="border-b border-gray-200 dark:border-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-tight">
              YourStore
            </a>
            <nav className="flex gap-6 text-sm font-medium">
              <a href="/products" className="hover:underline">
                Products
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="border-t border-gray-200 dark:border-gray-800 mt-16">
          <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} YourStore. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
