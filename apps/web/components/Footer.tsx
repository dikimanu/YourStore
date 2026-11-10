import Link from "next/link";

const SHOP_LINKS = [
  { label: "All Products", href: "/products" },
  { label: "New Arrivals", href: "/products?sort=newest" },
  { label: "Gadgets", href: "/products?category=gadgets" },
  { label: "Electronics", href: "/products?category=electronics" },
  { label: "Clothing", href: "/products?category=clothing" },
  { label: "Home", href: "/products?category=home" },
  { label: "Foods & Grocery", href: "/products?category=foods" },
  { label: "Books", href: "/products?category=books" },
  { label: "Health & Wellness", href: "/products?category=health" },
  { label: "Lab & Industrial", href: "/products?category=industrial" },
];

const HELP_LINKS = [
  { label: "Shipping & Returns", href: "/shipping-and-returns" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "My Orders", href: "/orders" },
  { label: "Wishlist", href: "/wishlist" },
];

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-16">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Col 1 — Brand */}
          <div className="space-y-3">
            <Link
              href="/"
              className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight"
            >
              YourStore
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-xs">
              Everything you need, delivered fast. Quality products across 8 categories —
              curated for India.
            </p>
          </div>

          {/* Col 2 — Shop */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
              Shop
            </h3>
            <ul className="space-y-2">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Help */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
              Help &amp; Info
            </h3>
            <ul className="space-y-2">
              {HELP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Trust */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Trust &amp; Safety
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                100% genuine products
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                7-day easy returns
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                Secure checkout with Stripe &amp; COD
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                Free shipping on orders over ₹499
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 dark:text-gray-400 gap-4">
          <p>© {new Date().getFullYear()} YourStore. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:underline">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
