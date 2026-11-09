"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { User } from "@yourstore/shared";

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await apiClient<{ user: User }>("/v1/auth/me");
      setUser(res.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser, pathname]);

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await apiClient("/api/v1/auth/logout", { method: "POST" });
      setUser(null);
      setIsOpen(false);
      showToast("Signed out successfully", "success");
      router.push("/login");
      router.refresh();
    } catch {
      showToast("Failed to sign out", "error");
    }
  };

  // While checking auth status, render empty container to prevent flicker
  if (loading) {
    return <div className="w-16 h-8" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className="hover:underline">
          Log In
        </Link>
        <Link
          href="/register"
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  const initial = user.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        id="user-menu-button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="User account menu"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-9 h-9 rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 transition shadow-sm"
      >
        {initial}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
          className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl py-2 z-50 focus:outline-none text-sm text-gray-700 dark:text-gray-200"
        >
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user.email}
            </p>
          </div>

          <div className="py-1">
            <Link
              href="/orders"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              My Orders
            </Link>

            {user.role === "admin" && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition font-medium text-blue-600 dark:text-blue-400"
              >
                Admin
              </Link>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-red-600 dark:text-red-400 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
