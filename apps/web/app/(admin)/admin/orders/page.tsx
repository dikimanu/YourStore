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
  const [search, setSearch] = useState("");
  const [filterOrderId, setFilterOrderId] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedOrderId, setDebouncedOrderId] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedOrderId(filterOrderId); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [filterOrderId]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedEmail(filterEmail); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [filterEmail]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "15" });
      if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
      if (debouncedOrderId.trim()) qs.set("orderId", debouncedOrderId.trim());
      if (debouncedEmail.trim()) qs.set("email", debouncedEmail.trim());
      if (filterStatus) qs.set("status", filterStatus);
      if (filterPaymentMethod) qs.set("paymentMethod", filterPaymentMethod);
      if (filterPaymentStatus) qs.set("paymentStatus", filterPaymentStatus);
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", toDate);

      const res = await apiClient<AdminOrdersResponse>(
        `/v1/admin/orders?${qs.toString()}`,
      );
      setOrders(res.orders);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    debouncedOrderId,
    debouncedEmail,
    filterStatus,
    filterPaymentMethod,
    filterPaymentStatus,
    fromDate,
    toDate,
    showToast,
  ]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleAdvanceStatus = async (order: ApiOrder) => {
    const nextStatus = VALID_NEXT_STATUS[order.status];
    if (!nextStatus) return;

    const oid = order._id ?? order.id ?? "";
    setAdvancingId(oid);
    try {
      await apiClient(`/v1/admin/orders/${oid}/status`, {
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

  const clearAllFilters = () => {
    setSearch("");
    setFilterOrderId("");
    setFilterEmail("");
    setFilterStatus("");
    setFilterPaymentMethod("");
    setFilterPaymentStatus("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search ||
    filterOrderId ||
    filterEmail ||
    filterStatus ||
    filterPaymentMethod ||
    filterPaymentStatus ||
    fromDate ||
    toDate,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Order Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} order{total !== 1 ? "s" : ""} total
          </p>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Extended Filters */}
      <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search by order ID or customer name/email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Exact Order ID"
            value={filterOrderId}
            onChange={(e) => setFilterOrderId(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            placeholder="Exact customer email"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={filterPaymentMethod}
            onChange={(e) => { setFilterPaymentMethod(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Methods</option>
            <option value="stripe">Stripe</option>
            <option value="cod">COD</option>
          </select>

          <select
            value={filterPaymentStatus}
            onChange={(e) => { setFilterPaymentStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Payment Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-1/2 px-2 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="From Date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-1/2 px-2 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="To Date"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
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
                        {oid.slice(-8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      {order.items?.map((it) => `${it.title} ×${it.qty}`).join(", ") ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      ₹{order.pricing?.total?.toLocaleString("en-IN") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="capitalize font-medium text-gray-700 dark:text-gray-300">
                        {order.payment?.method}
                      </span>
                      {" • "}
                      <span
                        className={
                          order.payment?.status === "paid"
                            ? "text-green-600 font-semibold"
                            : order.payment?.status === "failed"
                              ? "text-red-500 font-semibold"
                              : "text-gray-500"
                        }
                      >
                        {order.payment?.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {nextStatus ? (
                        <button
                          type="button"
                          onClick={() => void handleAdvanceStatus(order)}
                          disabled={isAdvancing}
                          className="px-2.5 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition"
                        >
                          {isAdvancing ? "Updating…" : `→ ${nextStatus}`}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-900"
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
