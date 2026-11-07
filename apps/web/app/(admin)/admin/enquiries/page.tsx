"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { AdminEnquiryItem, AdminEnquiriesResponse } from "@yourstore/shared";

export default function AdminEnquiriesPage() {
  const { showToast } = useToast();
  const [enquiries, setEnquiries] = useState<AdminEnquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "15",
      });
      if (typeFilter) {
        queryParams.set("type", typeFilter);
      }
      if (debouncedSearch.trim()) {
        queryParams.set("search", debouncedSearch.trim());
      }

      const res = await apiClient<AdminEnquiriesResponse>(
        `/v1/admin/enquiries?${queryParams.toString()}`,
      );
      setEnquiries(res.enquiries);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load enquiries",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, debouncedSearch, showToast]);

  useEffect(() => {
    void fetchEnquiries();
  }, [fetchEnquiries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Vehicle Inquiries & Visit Bookings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Prospect leads, visit appointment requests and customer contact history ({total} total)
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search by lead name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Inquiry Types</option>
          <option value="enquiry">General Inquiry</option>
          <option value="visit">Book a Visit / Test Drive</option>
        </select>

        {(search || typeFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTypeFilter("");
              setPage(1);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table Content */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : enquiries.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            No inquiries found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Contact Name</th>
                  <th className="px-6 py-3.5 font-semibold">Phone</th>
                  <th className="px-6 py-3.5 font-semibold">Target Product</th>
                  <th className="px-6 py-3.5 font-semibold">Type</th>
                  <th className="px-6 py-3.5 font-semibold">Preferred Date / Note</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {enquiries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {e.name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {e.phone}
                    </td>
                    <td className="px-6 py-4">
                      {e.product.slug ? (
                        <Link
                          href={`/products/${e.product.slug}`}
                          target="_blank"
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {e.product.title}
                        </Link>
                      ) : (
                        <span className="text-gray-500">{e.product.title}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          e.type === "visit"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {e.type === "visit" ? "Showroom Visit" : "General Inquiry"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      {e.preferredDate && (
                        <span className="block font-medium text-amber-600 dark:text-amber-400 mb-0.5">
                          Date: {new Date(e.preferredDate).toLocaleDateString("en-IN")}
                        </span>
                      )}
                      <span>{e.message || "No notes"}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500 dark:text-gray-400">
                      {new Date(e.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-800 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
