"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { AdminAuditLogItem, AdminAuditLogsResponse } from "@yourstore/shared";

export default function AdminAuditLogsPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [actionFilter, setActionFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [debouncedAction, setDebouncedAction] = useState("");
  const [debouncedTargetType, setDebouncedTargetType] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAction(actionFilter);
      setDebouncedTargetType(targetTypeFilter);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [actionFilter, targetTypeFilter]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (debouncedAction.trim()) {
        queryParams.set("action", debouncedAction.trim());
      }
      if (debouncedTargetType.trim()) {
        queryParams.set("targetType", debouncedTargetType.trim());
      }

      const res = await apiClient<AdminAuditLogsResponse>(
        `/v1/admin/audit-logs?${queryParams.toString()}`,
      );
      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load audit logs",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debouncedAction, debouncedTargetType, showToast]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Administrative Audit Trail
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Immutable log of state mutations, order transitions, refund events and catalog updates ({total} total)
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Filter by action (e.g. order.refund, order.status_update)..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Target type (e.g. Order, Product)..."
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {(actionFilter || targetTypeFilter) && (
          <button
            type="button"
            onClick={() => {
              setActionFilter("");
              setTargetTypeFilter("");
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
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            No audit records found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-6 py-3.5 font-semibold">Actor</th>
                  <th className="px-6 py-3.5 font-semibold">Action</th>
                  <th className="px-6 py-3.5 font-semibold">Target</th>
                  <th className="px-6 py-3.5 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono text-xs">
                {logs.map((log) => {
                  const actorName =
                    typeof log.actor === "object" && log.actor !== null
                      ? log.actor.name || log.actor.id || "Admin"
                      : String(log.actor);

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition">
                      <td className="px-6 py-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(log.at).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-gray-900 dark:text-white">
                        {actorName}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300">
                        <span className="text-gray-500">{log.targetType}:</span> {log.targetId || "—"}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {log.meta ? JSON.stringify(log.meta) : "—"}
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-800 text-sm font-sans">
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
    </div>
  );
}
