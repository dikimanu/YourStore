"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiClient, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { CouponType } from "@yourstore/shared";

interface CouponItem {
  _id?: string;
  id?: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  expiresAt?: string | null;
  usageLimit?: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CouponsResponse {
  coupons: CouponItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export default function AdminCouponsPage() {
  const { showToast } = useToast();

  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "inactive">("all");

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createCode, setCreateCode] = useState("");
  const [createType, setCreateType] = useState<CouponType>("percent");
  const [createValue, setCreateValue] = useState<string>("10");
  const [createMinOrder, setCreateMinOrder] = useState<string>("0");
  const [createExpiresAt, setCreateExpiresAt] = useState<string>("");
  const [createUsageLimit, setCreateUsageLimit] = useState<string>("");
  const [createIsActive, setCreateIsActive] = useState<boolean>(true);

  // Edit Modal
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editType, setEditType] = useState<CouponType>("percent");
  const [editValue, setEditValue] = useState<string>("");
  const [editMinOrder, setEditMinOrder] = useState<string>("");
  const [editExpiresAt, setEditExpiresAt] = useState<string>("");
  const [editUsageLimit, setEditUsageLimit] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Toggle state loader
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "15");
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await apiClient<CouponsResponse>(`/v1/admin/coupons?${params.toString()}`);
      setCoupons(res.coupons);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to load coupons";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, showToast]);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  // Open Edit Modal
  const openEditModal = (c: CouponItem) => {
    setEditingCoupon(c);
    setEditType(c.type);
    setEditValue(c.value.toString());
    setEditMinOrder(c.minOrder?.toString() ?? "0");
    if (c.expiresAt) {
      const d = new Date(c.expiresAt);
      const iso = d.toISOString().slice(0, 16);
      setEditExpiresAt(iso);
    } else {
      setEditExpiresAt("");
    }
    setEditUsageLimit(c.usageLimit !== undefined && c.usageLimit !== null ? c.usageLimit.toString() : "");
    setEditIsActive(c.isActive);
  };

  // Submit Create
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        code: createCode.trim().toUpperCase(),
        type: createType,
        value: Number(createValue),
        minOrder: Number(createMinOrder) || 0,
        isActive: createIsActive,
      };

      if (createExpiresAt.trim()) {
        payload["expiresAt"] = new Date(createExpiresAt).toISOString();
      }
      if (createUsageLimit.trim()) {
        payload["usageLimit"] = Number(createUsageLimit);
      }

      await apiClient("/v1/admin/coupons", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast(`Coupon "${createCode.trim().toUpperCase()}" created successfully`, "success");
      setShowCreateModal(false);
      // Reset form
      setCreateCode("");
      setCreateType("percent");
      setCreateValue("10");
      setCreateMinOrder("0");
      setCreateExpiresAt("");
      setCreateUsageLimit("");
      setCreateIsActive(true);
      void fetchCoupons();
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to create coupon";
      showToast(msg, "error");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    setEditSubmitting(true);
    const couponId = editingCoupon.id ?? editingCoupon._id;
    try {
      const payload: Record<string, unknown> = {
        type: editType,
        value: Number(editValue),
        minOrder: Number(editMinOrder) || 0,
        isActive: editIsActive,
      };

      if (editExpiresAt.trim()) {
        payload["expiresAt"] = new Date(editExpiresAt).toISOString();
      } else {
        payload["expiresAt"] = null;
      }

      if (editUsageLimit.trim()) {
        payload["usageLimit"] = Number(editUsageLimit);
      } else {
        payload["usageLimit"] = null;
      }

      await apiClient(`/v1/admin/coupons/${couponId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      showToast(`Coupon updated successfully`, "success");
      setEditingCoupon(null);
      void fetchCoupons();
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to update coupon";
      showToast(msg, "error");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (c: CouponItem) => {
    const couponId = c.id ?? c._id;
    if (!couponId) return;
    setTogglingId(couponId);
    try {
      if (c.isActive) {
        // Soft delete
        await apiClient(`/v1/admin/coupons/${couponId}`, {
          method: "DELETE",
        });
        showToast(`Coupon "${c.code}" deactivated`, "success");
      } else {
        // Activate via PATCH
        await apiClient(`/v1/admin/coupons/${couponId}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true }),
        });
        showToast(`Coupon "${c.code}" activated`, "success");
      }
      void fetchCoupons();
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to toggle coupon status";
      showToast(msg, "error");
    } finally {
      setTogglingId(null);
    }
  };

  const isExpired = (c: CouponItem) => {
    if (!c.expiresAt) return false;
    return new Date(c.expiresAt).getTime() <= Date.now();
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | "active" | "expired" | "inactive");
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="expired">Expired Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          + Create Coupon
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 space-y-4 shadow-sm animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800/60 rounded" />
            ))}
          </div>
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <span className="text-4xl block mb-2" role="img" aria-label="Coupon">
            🎟️
          </span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No coupons found</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-sm mx-auto">
            {search || statusFilter !== "all"
              ? "Try adjusting your search criteria or filter to find coupons."
              : "Create your first discount coupon to start offering promotions to customers."}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              + Create Coupon
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="px-4 py-3 font-semibold">Min Order</th>
                <th className="px-4 py-3 font-semibold">Expiry</th>
                <th className="px-4 py-3 font-semibold">Usage</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {coupons.map((c) => {
                const couponId = c.id ?? c._id ?? c.code;
                const expired = isExpired(c);
                return (
                  <tr key={couponId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-300">
                      {c.type}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {c.type === "percent" ? `${c.value}%` : `₹${c.value}`}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      ₹{c.minOrder}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {c.expiresAt ? (
                        <span className={expired ? "text-red-500 font-medium" : ""}>
                          {new Date(c.expiresAt).toLocaleDateString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                          {expired ? " (Expired)" : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400">No Expiry</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {c.usedCount} / {c.usageLimit !== undefined && c.usageLimit !== null ? c.usageLimit : "∞"}
                    </td>
                    <td className="px-4 py-3">
                      {!c.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          Inactive
                        </span>
                      ) : expired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(c)}
                          className="px-2.5 py-1 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleToggleActive(c)}
                          disabled={togglingId === (c.id ?? c._id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                            c.isActive
                              ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                              : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          }`}
                        >
                          {togglingId === (c.id ?? c._id) ? "..." : c.isActive ? "Deactivate" : "Activate"}
                        </button>
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create New Coupon</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateCoupon(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Coupon Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER25"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">3-20 characters: letters, numbers, and dashes.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value as CouponType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={createType === "percent" ? 100 : undefined}
                    value={createValue}
                    onChange={(e) => setCreateValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Min Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={createMinOrder}
                    onChange={(e) => setCreateMinOrder(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Unlimited if empty"
                    value={createUsageLimit}
                    onChange={(e) => setCreateUsageLimit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Expiry Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={createExpiresAt}
                  onChange={(e) => setCreateExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="createIsActive"
                  checked={createIsActive}
                  onChange={(e) => setCreateIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="createIsActive" className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                  Active immediately
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {createSubmitting ? "Creating..." : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Coupon</h2>
                <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                  {editingCoupon.code}
                </span>
              </div>
              <button
                onClick={() => setEditingCoupon(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleEditCoupon(e)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as CouponType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={editType === "percent" ? 100 : undefined}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Min Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editMinOrder}
                    onChange={(e) => setEditMinOrder(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Usage Limit (Used: {editingCoupon.usedCount})
                  </label>
                  <input
                    type="number"
                    min={editingCoupon.usedCount || 1}
                    placeholder="Unlimited if empty"
                    value={editUsageLimit}
                    onChange={(e) => setEditUsageLimit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Expiry Date & Time (Leave blank for no expiry)
                </label>
                <input
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="editIsActive" className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingCoupon(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
