"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
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

interface OrderShippingAddress {
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  state: string;
  pincode: string;
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
  shippingAddress: OrderShippingAddress;
  statusHistory: OrderStatusHistoryItem[];
  couponCode?: string | undefined;
  createdAt: string;
  updatedAt: string;
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

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [orderId, setOrderId] = useState<string>("");

  useEffect(() => {
    void params.then((p) => setOrderId(p.id));
  }, [params]);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await apiClient<{ order: ApiOrder }>(`/api/v1/orders/${orderId}`);
      setOrder(res.order);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "UNAUTHORIZED") {
        router.push(`/login?redirect=/orders/${orderId}`);
      } else if (err instanceof ApiClientError && err.code === "NOT_FOUND") {
        showToast("Order not found", "error");
        router.push("/orders");
      } else {
        showToast(err instanceof Error ? err.message : "Failed to load order", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, router, showToast]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  const handleCancel = async () => {
    if (!order) return;
    const id = order._id ?? order.id ?? "";
    setCancelling(true);
    try {
      await apiClient(`/api/v1/orders/${id}/cancel`, { method: "POST" });
      showToast("Order cancelled successfully", "success");
      void fetchOrder();
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to cancel order", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const isCancellable = CANCELLABLE_STATUSES.includes(order.status);
  const oid = order._id ?? order.id ?? "";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/orders"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← My Orders
        </Link>
        <h1 className="text-xl font-bold">Order Details</h1>
      </div>

      {/* Header */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">Order #{oid}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Placed on{" "}
              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[order.status] ?? ""}`}
            >
              {order.status}
            </span>
            {isCancellable && (
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void handleCancel()}
                className="text-sm px-4 py-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel Order"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <section className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold">Items Ordered</h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {order.items.map((item, i) => (
            <div key={i} className="flex gap-4 p-4">
              {item.image && (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized={
                      item.image.startsWith("https://placehold.co") ||
                      item.image.startsWith("data:")
                    }
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.title}</p>
                {item.variantSku && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">SKU: {item.variantSku}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Qty: {item.qty} × ₹{item.unitPrice.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex-shrink-0">
                ₹{(item.unitPrice * item.qty).toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 space-y-2">
          <h2 className="font-semibold mb-3">Pricing</h2>
          {[
            ["Subtotal", order.pricing.subtotal],
            ["Shipping", order.pricing.shipping],
            ["Tax", order.pricing.tax],
            ["Discount", -order.pricing.discount],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">{String(label)}</span>
              <span className={Number(value) < 0 ? "text-green-600 dark:text-green-400" : ""}>
                {Number(value) < 0 ? "−" : ""}₹{Math.abs(Number(value)).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
          <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-800 pt-2">
            <span>Total</span>
            <span>₹{order.pricing.total.toLocaleString("en-IN")}</span>
          </div>
          {order.couponCode && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Coupon applied: {order.couponCode}
            </p>
          )}
        </section>

        <section className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 space-y-2">
          <h2 className="font-semibold mb-3">Delivery Address</h2>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <p className="font-medium">{order.shippingAddress.name}</p>
            <p>{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
              {order.shippingAddress.pincode}
            </p>
            <p className="text-gray-500 dark:text-gray-400">{order.shippingAddress.phone}</p>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-800 text-sm">
            <p>
              <span className="text-gray-500 dark:text-gray-400">Payment: </span>
              <span className="capitalize">
                {order.payment.method === "cod" ? "Cash on Delivery" : "Stripe"} · {order.payment.status}
              </span>
            </p>
          </div>
        </section>
      </div>

      {/* Status Timeline */}
      {order.statusHistory.length > 0 && (
        <section className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900">
          <h2 className="font-semibold mb-4">Order Timeline</h2>
          <ol className="relative border-l border-gray-300 dark:border-gray-700 ml-3 space-y-6">
            {[...order.statusHistory].reverse().map((entry, i) => (
              <li key={i} className="ml-6">
                <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 ring-4 ring-white dark:ring-gray-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {entry.status}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(entry.at).toLocaleString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {entry.note && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                      {entry.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
