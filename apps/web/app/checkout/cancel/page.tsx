"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function CheckoutCancelPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const orderId = params.get("order_id");
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    // Auto-cancel order if order_id is in URL (Stripe redirect on cancel)
    if (orderId && !cancelled) {
      setCancelling(true);
      void apiClient(`/api/v1/orders/${orderId}/cancel`, { method: "POST" })
        .then(() => {
          setCancelled(true);
          showToast("Order cancelled and payment session expired.", "info");
        })
        .catch(() => {
          // Order may already be cancelled or not found — that's okay
          setCancelled(true);
        })
        .finally(() => setCancelling(false));
    }
  }, [orderId, cancelled, showToast]);

  return (
    <div className="max-w-lg mx-auto text-center py-24 space-y-6">
      <div className="text-6xl">❌</div>
      <h1 className="text-3xl font-bold text-red-600 dark:text-red-400">
        Checkout Cancelled
      </h1>
      <p className="text-gray-600 dark:text-gray-300">
        {cancelling
          ? "Cancelling your order…"
          : "Your checkout session was cancelled. No payment has been taken."}
      </p>
      {orderId && (
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
          Order: {orderId}
        </p>
      )}
      <div className="flex gap-4 justify-center pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Try Again
        </button>
        <Link
          href="/cart"
          className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Back to Cart
        </Link>
      </div>
    </div>
  );
}
