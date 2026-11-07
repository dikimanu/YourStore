"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { OrderStatus } from "@yourstore/shared";

interface OrderItem {
  productId: string;
  title: string;
  variantSku?: string | undefined;
  unitPrice: number;
  qty: number;
  image?: string | undefined;
}

interface OrderPricing {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
}

interface OrderPayment {
  method: "stripe" | "cod";
  status: "pending" | "paid" | "failed" | "refunded";
}

interface OrderStatusHistoryItem {
  status: OrderStatus;
  at: string;
  by: string;
  note?: string | undefined;
}

interface ApiOrder {
  _id: string;
  id?: string | undefined;
  status: OrderStatus;
  items: OrderItem[];
  pricing: OrderPricing;
  payment: OrderPayment;
  statusHistory: OrderStatusHistoryItem[];
  couponCode?: string | undefined;
  createdAt: string;
}

interface OrdersResponse {
  orders: ApiOrder[];
  total: number;
  page: number;
  totalPages: number;
}

const CANCELLABLE_STATUSES: OrderStatus[] = ["PendingPayment", "Placed", "Processing"];

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

export default function OrdersPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient<OrdersResponse>(
        `/api/v1/orders?page=${page}&limit=10`,
      );
      setOrders(res.orders);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "UNAUTHORIZED") {
        router.push("/login?redirect=/orders");
      } else {
        showToast(err instanceof Error ? err.message : "Failed to load orders", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [page, router, showToast]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await apiClient(`/api/v1/orders/${orderId}/cancel`, { method: "POST" });
      showToast("Order cancelled successfully", "success");
      void fetchOrders();
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to cancel order", "error");
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">No orders yet</p>
        <Link
          href="/products"
          className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">{total} order{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const orderId = order._id ?? order.id ?? "";
          const isCancellable = CANCELLABLE_STATUSES.includes(order.status);
          const isCancelling = cancellingId === orderId;
          return (
            <div
              key={orderId}
              className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">#{orderId}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[order.status] ?? ""}`}
                  >
                    {order.status}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                    {order.payment.method === "cod" ? "COD" : "Stripe"} · {order.payment.status}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                {order.items.slice(0, 3).map((item, i) => (
                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300">
                    {item.title}
                    {item.variantSku ? ` (${item.variantSku})` : ""} × {item.qty}
                  </p>
                ))}
                {order.items.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    +{order.items.length - 3} more item(s)
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-800 pt-3">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Total: ₹{order.pricing.total.toLocaleString("en-IN")}
                </span>
                <div className="flex gap-2">
                  <Link
                    href={`/orders/${orderId}`}
                    className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    View Details
                  </Link>
                  {isCancellable && (
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => void handleCancel(orderId)}
                      className="text-sm px-3 py-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-50"
                    >
                      {isCancelling ? "Cancelling…" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
