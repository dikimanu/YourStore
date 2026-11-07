"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiClient, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { OrderStatus, ORDER_STATUSES } from "@yourstore/shared";

interface OrderItem {
  productId: string;
  title: string;
  qty: number;
  unitPrice: number;
}

interface OrderPricing {
  total: number;
}

interface OrderPayment {
  method: "stripe" | "cod";
  status: "pending" | "paid" | "failed" | "refunded";
}

interface ApiOrder {
  _id: string;
  id?: string | undefined;
  status: OrderStatus;
  items: OrderItem[];
  pricing: OrderPricing;
  payment: OrderPayment;
  couponCode?: string | undefined;
  createdAt: string;
}

interface AdminOrdersResponse {
  orders: ApiOrder[];
  total: number;
  page: number;
  totalPages: number;
}

const VALID_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Placed: "Processing",
  Processing: "Dispatched",
  Dispatched: "OutForDelivery",
  OutForDelivery: "Delivered",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  PendingPayment: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  Placed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Processing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  Dispatched: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  OutForDelivery: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  Delivered: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  ReturnRequested: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300",
  Returned: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  Refunded: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
};

export default function AdminOrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  // Filters
  const [filterOrderId, setFilterOrderId] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [debouncedOrderId, setDebouncedOrderId] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedOrderId(filterOrderId); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [filterOrderId]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedEmail(filterEmail); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [filterEmail]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "15" });
      if (debouncedOrderId.trim()) qs.set("orderId", debouncedOrderId.trim());
      if (debouncedEmail.trim()) qs.set("email", debouncedEmail.trim());
      if (filterStatus) qs.set("status", filterStatus);

      const res = await apiClient<AdminOrdersResponse>(
        `/api/v1/admin/orders?${qs.toString()}`,
      );
      setOrders(res.orders);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedOrderId, debouncedEmail, filterStatus, showToast]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleAdvanceStatus = async (order: ApiOrder) => {
    const nextStatus = VALID_NEXT_STATUS[order.status];
    if (!nextStatus) return;

    const oid = order._id ?? order.id ?? "";
    setAdvancingId(oid);
    try {
      await apiClient(`/api/v1/admin/orders/${oid}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`Order advanced to ${nextStatus}`, "success");
      void fetchOrders();
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to update status", "error");
    } finally {
      setAdvancingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Order Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} order{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          onClick={() => { setFilterOrderId(""); setFilterEmail(""); setFilterStatus(""); setPage(1); }}
        >
          Clear Filters
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filter by Order ID"
          value={filterOrderId}
          onChange={(e) => setFilterOrderId(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <input
          type="email"
          placeholder="Filter by customer email"
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr>
              {["Order ID", "Date", "Items", "Total", "Payment", "Status", "Action"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-950">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                  Loading orders…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const oid = order._id ?? order.id ?? "";
                const nextStatus = VALID_NEXT_STATUS[order.status];
                const isAdvancing = advancingId === oid;
                return (
                  <tr key={oid} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${oid}`}
                        className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        #{oid.slice(-8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate">
                        {order.items.map((i) => `${i.title} ×${i.qty}`).join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      ₹{order.pricing.total.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {order.payment.method.toUpperCase()} · {order.payment.status}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[order.status] ?? ""}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {nextStatus ? (
                        <button
                          type="button"
                          disabled={isAdvancing}
                          onClick={() => void handleAdvanceStatus(order)}
                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition"
                        >
                          {isAdvancing ? "…" : `→ ${nextStatus}`}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
