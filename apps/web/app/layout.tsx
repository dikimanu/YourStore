import type { Metadata, Viewport } from "next";
import { ToastProvider } from "../components/Toast";
import { CartProvider } from "../lib/CartContext";
import { WishlistProvider } from "../lib/WishlistContext";
import { RecentlyViewedProvider } from "../lib/RecentlyViewedContext";
import { ApiWakingBanner } from "../components/ApiWakingBanner";
import { Footer } from "@/components/Footer";
import { StickyHeader } from "@/components/StickyHeader";
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
                <ApiWakingBanner />
                <div>
                  <StickyHeader />
                  <main className="mx-auto max-w-7xl px-4 py-8 page-enter">{children}</main>
                </div>
                <Footer />
              </RecentlyViewedProvider>
            </WishlistProvider>
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

export const viewport: Viewport = { themeColor: "#2563eb" };
