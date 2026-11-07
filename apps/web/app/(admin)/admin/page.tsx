"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { AdminStatsResponse, OrderStatus } from "@yourstore/shared";
import { ORDER_STATUSES } from "@yourstore/shared";

// Lazy-load the chart component with next/dynamic (ssr: false)
const SalesChart = dynamic(() => import("@/components/admin/SalesChart"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg animate-pulse">
      <span className="text-sm text-gray-400">Loading chart...</span>
    </div>
  ),
});

const STATUS_COLORS: Record<OrderStatus, string> = {
  PendingPayment: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Placed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Processing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  Dispatched: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  OutForDelivery: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  Delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  ReturnRequested: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Returned: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  Refunded: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export default function AdminDashboardPage() {
  const { showToast } = useToast();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(
    async (selectedDays: 7 | 30 | 90) => {
      setLoading(true);
      try {
        const data = await apiClient<AdminStatsResponse>(
          `/v1/admin/stats?days=${selectedDays}`,
        );
        setStats(data);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to load dashboard metrics",
          "error",
        );
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void fetchStats(days);
  }, [days, fetchStats]);

  // Compute pending actions = Placed + ReturnRequested
  const pendingActionsCount = stats?.orderCounts
    ? (stats.orderCounts.Placed || 0) + (stats.orderCounts.ReturnRequested || 0)
    : 0;

  return (
    <div className="space-y-8">
      {/* Top Header & Range Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Business Overview
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time sales performance and operational indicators
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800">
          {([7, 30, 90] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                days === option
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Last {option} Days
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm animate-pulse space-y-3"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
              <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
            </div>
          ))
        ) : (
          <>
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total Revenue
              </span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{stats.totals.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                Excludes cancelled & pending
              </span>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Qualifying Orders
              </span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.totals.orders}
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                In the selected {days}-day window
              </span>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Avg. Order Value
              </span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{stats.totals.averageOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                Per successful order
              </span>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pending Actions
              </span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {pendingActionsCount}
              </p>
              <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                <Link
                  href="/admin/orders"
                  className="hover:text-blue-600 underline"
                >
                  {stats.orderCounts.Placed || 0} Placed
                </Link>
                <span>•</span>
                <Link
                  href="/admin/returns"
                  className="hover:text-blue-600 underline"
                >
                  {stats.orderCounts.ReturnRequested || 0} Returns
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sales By Day Chart */}
      <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Revenue Over Time
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Daily revenue in ₹ (Asia/Kolkata timezone)
            </p>
          </div>
        </div>

        {loading || !stats ? (
          <div className="w-full h-72 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg animate-pulse" />
        ) : (
          <SalesChart data={stats.salesByDay} />
        )}
      </div>

      {/* Status Breakdown & Top Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Breakdown */}
        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Order Status Breakdown
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Total count across all lifetime order records
          </p>

          {loading || !stats ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ORDER_STATUSES.map((status) => {
                const count = stats.orderCounts[status] || 0;
                return (
                  <div
                    key={status}
                    className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 flex flex-col justify-between"
                  >
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block w-fit mb-2 ${STATUS_COLORS[status]}`}
                    >
                      {status}
                    </span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Products Table */}
        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Top Products
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Top 5 products by units sold in the selected range
          </p>

          {loading || !stats ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : stats.topProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No product sales recorded in this timeframe.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    <th className="pb-3">Product</th>
                    <th className="pb-3 text-right">Units</th>
                    <th className="pb-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {stats.topProducts.map((p) => (
                    <tr key={p.productId}>
                      <td className="py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                        {p.title}
                      </td>
                      <td className="py-3 text-right text-gray-700 dark:text-gray-300">
                        {p.units}
                      </td>
                      <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">
                        ₹{p.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Low-stock Alert List */}
      <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Low-Stock Inventory Alerts
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Active purchasable items with ≤ 5 units remaining (max 20)
            </p>
          </div>
          <Link
            href="/admin/products"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Manage Catalog →
          </Link>
        </div>

        {loading || !stats ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : stats.lowStock.length === 0 ? (
          <div className="py-8 text-center text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
            ✓ All active purchasable products are adequately stocked.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  <th className="pb-3">Product Title</th>
                  <th className="pb-3">SKU / Variant</th>
                  <th className="pb-3 text-right">Remaining Stock</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {stats.lowStock.map((item, idx) => (
                  <tr key={`${item.productId}-${item.sku ?? idx}`}>
                    <td className="py-3 font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {item.sku || "—"}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.stock === 0
                            ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                        }`}
                      >
                        {item.stock} left
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/products/${item.productId}/edit`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Edit Stock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
