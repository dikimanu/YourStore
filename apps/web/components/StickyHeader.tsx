"use client";

/**
 * StickyHeader — client component that adds blur/shadow on scroll and
 * a mobile hamburger drawer. Consumes useAuth so mobile and desktop
 * are always in sync with authentication state.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/lib/AuthContext";

const NAV_LINKS = [
  { label: "Products", href: "/products" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "Cart", href: "/cart" },
];

export function StickyHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  /* ── Scroll detection ──────────────────────────────────────── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Close drawer on route change ─────────────────────────── */
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /* ── Escape key closes drawer ─────────────────────────────── */
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  /* ── Trap focus inside drawer ─────────────────────────────── */
  useEffect(() => {
    if (!drawerOpen || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button, input, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();
  }, [drawerOpen]);

  /* ── Lock body scroll when drawer open ────────────────────── */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const handleSearch = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
        setSearchQuery("");
      }
    },
    [searchQuery, router],
  );

  const headerClass = [
    "sticky top-0 z-40 w-full transition-all duration-200",
    scrolled
      ? "shadow-md backdrop-blur-md bg-white/90 dark:bg-gray-950/90 border-b border-gray-200/60 dark:border-gray-800/60"
      : "bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800",
  ].join(" ");

  return (
    <>
      <header className={headerClass}>
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 shrink-0"
          >
            YourStore
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label="Main navigation"
            className="hidden md:flex gap-5 items-center text-sm font-medium"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                  pathname === link.href
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop search + UserMenu */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-xs justify-end">
            <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
              <label htmlFor="header-search" className="sr-only">
                Search products
              </label>
              <input
                id="header-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </form>
            <UserMenu />
          </div>

          {/* Mobile: hamburger + UserMenu */}
          <div className="flex md:hidden items-center gap-2">
            <UserMenu />
            <button
              ref={hamburgerRef}
              type="button"
              aria-label={drawerOpen ? "Close menu" : "Open menu"}
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => setDrawerOpen((v) => !v)}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {drawerOpen ? (
                <svg
                  aria-hidden="true"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-white dark:bg-gray-950 shadow-2xl flex flex-col transition-transform duration-250 ease-out md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400"
          >
            YourStore
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => {
              setDrawerOpen(false);
              hamburgerRef.current?.focus();
            }}
            className="p-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Drawer search */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <form onSubmit={handleSearch} className="flex gap-2">
            <label htmlFor="drawer-search" className="sr-only">
              Search products
            </label>
            <input
              id="drawer-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Go
            </button>
          </form>
        </div>

        {/* Drawer user status */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          {isLoading ? (
            <div className="h-6 w-32 skeleton rounded" />
          ) : isAuthenticated && user ? (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {user.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                className="flex-1 py-1.5 px-3 text-center text-sm font-medium border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="flex-1 py-1.5 px-3 text-center text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Drawer nav links */}
        <nav aria-label="Mobile navigation" className="flex flex-col px-5 py-4 gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {isAuthenticated && (
            <>
              <Link
                href="/orders"
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/orders"
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                My Orders
              </Link>
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40`}
                >
                  Admin Portal
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  void logout();
                  setDrawerOpen(false);
                  router.push("/login");
                }}
                className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition mt-2"
              >
                Sign Out
              </button>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
