"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <div className="max-w-lg mx-auto text-center py-24 space-y-6">
      <div className="text-6xl">🎉</div>
      <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">
        Payment Successful!
      </h1>
      <p className="text-gray-600 dark:text-gray-300">
        Thank you for your order. Your payment was processed successfully and your order has been
        placed.
      </p>
      {sessionId && (
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono break-all">
          Session: {sessionId}
        </p>
      )}
      <div className="flex gap-4 justify-center pt-4">
        <Link
          href="/orders"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          View My Orders
        </Link>
        <Link
          href="/products"
          className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
