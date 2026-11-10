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

  // Reply modal state
  const [selectedEnquiry, setSelectedEnquiry] = useState<AdminEnquiryItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<"replied" | "resolved">("replied");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

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

  const handleOpenReplyModal = (item: AdminEnquiryItem) => {
    setSelectedEnquiry(item);
    setReplyText(item.adminReply || "");
    setReplyStatus((item.status as "replied" | "resolved") || "replied");
  };

  const handleCloseReplyModal = () => {
    setSelectedEnquiry(null);
    setReplyText("");
    setIsSubmittingReply(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;
    if (!replyText.trim()) {
      showToast("Please enter a reply message", "error");
      return;
    }

    setIsSubmittingReply(true);
    try {
      await apiClient(`/v1/admin/enquiries/${selectedEnquiry.id}/reply`, {
        method: "POST",
        body: JSON.stringify({
          reply: replyText.trim(),
          status: replyStatus,
        }),
      });

      // Update state dynamically
      setEnquiries((prev) =>
        prev.map((item) =>
          item.id === selectedEnquiry.id
            ? {
                ...item,
                status: replyStatus,
                adminReply: replyText.trim(),
                repliedAt: new Date(),
              }
            : item,
        ),
      );

      showToast("Reply sent successfully", "success");
      handleCloseReplyModal();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to send reply",
        "error",
      );
    } finally {
      setIsSubmittingReply(false);
    }
  };

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
                  <th className="px-6 py-3.5 font-semibold text-center">STATUS</th>
                  <th className="px-6 py-3.5 font-semibold text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {enquiries.map((e) => {
                  const status = e.status || "pending";
                  return (
                    <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {e.name}
                        {e.email && (
                          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                            {e.email}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {e.phone}
                      </td>
                      <td className="px-6 py-4">
                        {e.product.slug ? (
                          <Link
                            href={`/product/${e.product.slug}`}
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
                      <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs">
                        {e.preferredDate && (
                          <span className="block font-medium text-amber-600 dark:text-amber-400 mb-0.5">
                            Date: {new Date(e.preferredDate).toLocaleDateString("en-IN")}
                          </span>
                        )}
                        <span className="line-clamp-2">{e.message || "No notes"}</span>
                        {e.adminReply && (
                          <span className="block text-[11px] text-blue-600 dark:text-blue-400 mt-1 italic line-clamp-1">
                            Reply: {e.adminReply}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-gray-500 dark:text-gray-400">
                        {new Date(e.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            status === "resolved"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                              : status === "replied"
                                ? "bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenReplyModal(e)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
                        >
                          {e.adminReply ? "View / Edit Reply" : "Reply"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Reply Modal */}
      {selectedEnquiry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reply-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 id="reply-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                Reply to Customer Inquiry
              </h3>
              <button
                type="button"
                onClick={handleCloseReplyModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-md text-lg leading-none"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Customer & Inquiry Details */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {selectedEnquiry.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {selectedEnquiry.phone}
                </span>
              </div>
              {selectedEnquiry.email && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Email:</span>
                  <span className="text-gray-700 dark:text-gray-300">{selectedEnquiry.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Target Vehicle:</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {selectedEnquiry.product.title || "Kia Seltos X-Line HTX+ Diesel"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Inquiry Type:</span>
                <span className="capitalize text-gray-700 dark:text-gray-300">
                  {selectedEnquiry.type === "visit" ? "Showroom Visit" : "General Inquiry"}
                </span>
              </div>
              {selectedEnquiry.preferredDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Visit Date:</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {new Date(selectedEnquiry.preferredDate).toLocaleDateString("en-IN")}
                  </span>
                </div>
              )}
              {selectedEnquiry.message && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 block mb-1">
                    Customer Message:
                  </span>
                  <p className="italic text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                    &ldquo;{selectedEnquiry.message}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSendReply} className="space-y-4">
              <div>
                <label
                  htmlFor="reply-status"
                  className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1"
                >
                  Status
                </label>
                <select
                  id="reply-status"
                  value={replyStatus}
                  onChange={(e) => setReplyStatus(e.target.value as "replied" | "resolved")}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="replied">Replied (Follow-up needed)</option>
                  <option value="resolved">Resolved (Deal finalized or closed)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="admin-reply-text"
                  className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1"
                >
                  Response / Dealership Notes
                </label>
                <textarea
                  id="admin-reply-text"
                  rows={4}
                  required
                  placeholder="Type your response to the customer or appointment notes here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseReplyModal}
                  disabled={isSubmittingReply}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReply}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {isSubmittingReply ? "Sending..." : "Send Reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
