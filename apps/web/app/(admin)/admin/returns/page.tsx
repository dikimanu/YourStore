"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiClient, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { OrderStatus } from "@yourstore/shared";

interface ReturnRequestData {
  reason: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decision?: "approve" | "reject";
  note?: string;
}

interface ReturnOrderItem {
  _id?: string;
  id?: string;
  status: OrderStatus;
  user?: {
    _id: string;
    id?: string;
    name: string;
    email: string;
  };
  items: Array<{
    title: string;
    qty: number;
    unitPrice: number;
    variantSku?: string;
  }>;
  pricing: {
    total: number;
  };
  payment: {
    method: "stripe" | "cod";
    status: "pending" | "paid" | "failed" | "refunded";
  };
  returnRequest?: ReturnRequestData;
  createdAt: string;
  updatedAt: string;
}

interface ReturnsResponse {
  orders: ReturnOrderItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const STATUS_COLOR: Record<string, string> = {
  ReturnRequested: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  Returned: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Refunded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export default function AdminReturnsPage() {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<ReturnOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Reject dialog state
  const [rejectingOrder, setRejectingOrder] = useState<ReturnOrderItem | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  // Action processing state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient<ReturnsResponse>(`/v1/admin/returns?page=${page}&limit=15`);
      setOrders(res.orders);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to load returns";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    void fetchReturns();
  }, [fetchReturns]);

  // Handle Approve
  const handleApprove = async (order: ReturnOrderItem) => {
    const orderId = order.id ?? order._id;
    if (!orderId) return;
    setActionLoadingId(orderId);
    try {
      await apiClient(`/v1/admin/orders/${orderId}/return`, {
        method: "PATCH",
        body: JSON.stringify({ decision: "approve" }),
      });
      showToast(`Return approved for order #${orderId}`, "success");
      void fetchReturns();
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to approve return";
      showToast(msg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Submit Reject
  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingOrder) return;
    const orderId = rejectingOrder.id ?? rejectingOrder._id;
    if (!orderId) return;
    setSubmittingReject(true);
    try {
      await apiClient(`/v1/admin/orders/${orderId}/return`, {
        method: "PATCH",
        body: JSON.stringify({
          decision: "reject",
          note: rejectNote.trim() || undefined,
        }),
      });
      showToast(`Return rejected for order #${orderId}`, "success");
      setRejectingOrder(null);
      setRejectNote("");
      void fetchReturns();
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to reject return";
      showToast(msg, "error");
    } finally {
      setSubmittingReject(false);
    }
  };

  // Handle Refund
  const handleRefund = async (order: ReturnOrderItem) => {
    const orderId = order.id ?? order._id;
    if (!orderId) return;
    setActionLoadingId(orderId);
    try {
      await apiClient(`/v1/admin/orders/${orderId}/refund`, {
        method: "PATCH",
      });
      showToast(`Refund processed for order #${orderId}`, "success");
      void fetchReturns();
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to process refund";
      showToast(msg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Returns & Refunds Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Process return requests, approve restocking, and issue customer refunds.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 space-y-4 shadow-sm animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded" />
            ))}
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <span className="text-4xl block mb-2" role="img" aria-label="Return">
            📦
          </span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No return requests found</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-sm mx-auto">
            All return requests and refunds have been handled. New requests will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Order ID</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map((o) => {
                const orderId = o.id ?? o._id ?? "";
                const isProcessing = actionLoadingId === orderId;

                return (
                  <tr key={orderId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">
                      <Link href={`/orders/${orderId}`} target="_blank" className="hover:underline">
                        #{orderId.slice(-8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{o.user?.name ?? "Customer"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{o.user?.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      ₹{o.pricing.total.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {o.payment.method} · {o.payment.status}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2">
                        {o.returnRequest?.reason ?? "No reason provided"}
                      </p>
                      {o.returnRequest?.note && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5">
                          Note: {o.returnRequest.note}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {o.status === "ReturnRequested" && (
                          <>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => void handleApprove(o)}
                              className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50"
                            >
                              {isProcessing ? "..." : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => setRejectingOrder(o)}
                              className="px-2.5 py-1 text-xs font-medium border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {o.status === "Returned" && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void handleRefund(o)}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
                          >
                            {isProcessing ? "..." : "Refund"}
                          </button>
                        )}
                        {o.status === "Refunded" && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            Refund Complete ✓
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Reject Return Request</h3>
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitReject(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Rejection Note (Optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Explain why the return was rejected..."
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setRejectingOrder(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submittingReject ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
