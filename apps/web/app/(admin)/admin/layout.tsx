"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { User } from "@yourstore/shared";

interface AdminRoleGuardProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminRoleGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminAuth() {
      try {
        const res = await apiClient<{ user: User }>("/v1/auth/me");
        if (!isMounted) return;

        if (res.user && res.user.role === "admin") {
          setCurrentUser(res.user);
          setAuthorized(true);
        } else {
          // Logged in but not an admin
          setAuthorized(false);
        }
      } catch {
        if (!isMounted) return;
        // Not authenticated: redirect to login
        router.push("/login?redirect=/admin");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void checkAdminAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" role="status">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 dark:text-gray-400">Verifying administrative access...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 text-center bg-gray-50 dark:bg-gray-900 border border-red-200 dark:border-red-900 rounded-lg">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">403 - Forbidden</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          You do not have permission to view this page. An administrator account is required.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 transition"
          >
            Return Home
          </Link>
          <Link
            href="/login?redirect=/admin"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Switch Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
            Admin Panel
          </span>
          <h1 className="text-2xl font-bold">Store Administration</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Signed in as <strong>{currentUser?.email}</strong>
          </span>
          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/products"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Products
          </Link>
          <Link
            href="/admin/orders"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Orders
          </Link>
          <Link
            href="/admin/returns"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Returns
          </Link>
          <Link
            href="/admin/coupons"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Coupons
          </Link>
          <Link
            href="/admin/customers"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Customers
          </Link>
          <Link
            href="/admin/enquiries"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Enquiries
          </Link>
          <Link
            href="/admin/audit-log"
            className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Audit Logs
          </Link>
          <Link
            href="/admin/products/new"
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
          >
            + Add Product
          </Link>
        </div>
      </header>
      <section>{children}</section>
    </div>
  );
}
