import Link from "next/link";

const SHOP_LINKS = [
  { label: "All Products", href: "/products" },
  { label: "New Arrivals", href: "/products?sort=newest" },
  { label: "Gadgets", href: "/products?category=gadgets" },
  { label: "Electronics", href: "/products?category=electronics" },
  { label: "Clothing", href: "/products?category=clothing" },
  { label: "Vehicles", href: "/products?category=vehicles" },
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
              Help
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

          {/* Col 4 — Contact & Social */}
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
                Contact
              </h3>
              <a
                href="mailto:satyabratapal50@gmail.com"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition break-all"
              >
                satyabratapal50@gmail.com
              </a>
              <div className="mt-2">
                <Link
                  href="/contact"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Contact form →
                </Link>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">
                Follow Us
              </h3>
              <div className="flex gap-3">
                {/* LinkedIn */}
                <a
                  href="https://www.linkedin.com/in/satyabrata-pal-03b5a7373"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn profile of Satyabrata Pal"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 0h-14C2.239 0 0 2.239 0 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5V5c0-2.761-2.239-5-5-5zM8 19H5V9h3v10zM6.5 7.5a1.5 1.5 0 11.001-3.001A1.5 1.5 0 016.5 7.5zM20 19h-3v-5.5c0-1.378-.028-3.152-1.921-3.152-1.921 0-2.217 1.5-2.217 3.049V19h-3V9h2.882v1.368h.04c.401-.76 1.381-1.561 2.843-1.561C18.92 8.807 20 10.44 20 13.13V19z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/_satyabrata.pal"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram profile of Satyabrata Pal"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gradient-to-br hover:from-pink-500 hover:to-orange-400 hover:text-white dark:hover:from-pink-500 dark:hover:to-orange-400 dark:hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>

                {/* Email */}
                <a
                  href="mailto:satyabratapal50@gmail.com"
                  aria-label="Email Satyabrata Pal"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>© 2026 YourStore. Built by Satyabrata Pal.</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <Link href="/shipping-and-returns" className="hover:underline">Shipping &amp; Returns</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
