"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { apiClient, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { CsvImportPreviewResponse, CsvImportRowResult } from "@yourstore/shared";

// ---- Template CSV ----

const TEMPLATE_HEADERS = [
  "title",
  "slug",
  "description",
  "category",
  "brand",
  "basePrice",
  "stock",
  "listingType",
  "isActive",
  "imageUrl",
  "imagePublicId",
  "attributes",
  "variants",
];

const TEMPLATE_EXAMPLE_ROW = [
  "Sample Product",
  "sample-product",
  "A great product description",
  "electronics",
  "Acme",
  "999",
  "50",
  "purchasable",
  "true",
  "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  "sample",
  '{"warranty":"1 year"}',
  "",
];

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS.join(","), TEMPLATE_EXAMPLE_ROW.join(",")];
  const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Max sizes ----
const MAX_BYTES = 1_000_000;

// ---- Sub-components ----

function RowStatusBadge({ valid }: { valid: boolean }) {
  return valid ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      ✓ Valid
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
      ✗ Invalid
    </span>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-label="Loading preview…">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      ))}
    </div>
  );
}

// ---- Main page ----

export default function AdminProductImportPage() {
  const { showToast } = useToast();

  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvImportPreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // ---- File picker handler ----
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith(".csv")) {
        showToast("Please select a .csv file", "error");
        return;
      }

      if (file.size > MAX_BYTES) {
        showToast(
          `File is too large (${(file.size / 1024).toFixed(0)} KB). Maximum is 1 MB.`,
          "error",
        );
        return;
      }

      setFileName(file.name);
      setPreview(null);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === "string") {
          setCsvText(text);
        }
      };
      reader.readAsText(file, "utf-8");
    },
    [showToast],
  );

  // ---- Preview ----
  const handlePreview = useCallback(async () => {
    if (!csvText.trim()) {
      showToast("Paste or upload a CSV first", "info");
      return;
    }

    setPreviewing(true);
    setPreview(null);

    try {
      const result = await apiClient<CsvImportPreviewResponse>(
        "/v1/admin/products/import/preview",
        {
          method: "POST",
          body: JSON.stringify({ csv: csvText }),
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );
      setPreview(result);

      if (result.invalidCount === 0) {
        showToast(
          `Preview complete — ${result.validCount} valid row${result.validCount === 1 ? "" : "s"}, ready to import`,
          "success",
        );
      } else {
        showToast(
          `Preview found ${result.invalidCount} invalid row${result.invalidCount === 1 ? "" : "s"}. Fix errors before importing.`,
          "error",
        );
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Preview failed";
      showToast(message, "error");
    } finally {
      setPreviewing(false);
    }
  }, [csvText, showToast]);

  // ---- Commit ----
  const handleCommit = useCallback(async () => {
    if (!preview || preview.invalidCount > 0) return;

    setCommitting(true);

    try {
      const result = await apiClient<{ imported: number; message: string }>(
        "/v1/admin/products/import/commit",
        {
          method: "POST",
          body: JSON.stringify({ csv: csvText }),
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );

      showToast(result.message, "success");

      // Reset state after successful import
      setCsvText("");
      setFileName(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Commit failed";
      showToast(message, "error");
    } finally {
      setCommitting(false);
    }
  }, [csvText, preview, showToast]);

  // ---- Render helpers ----

  const canCommit =
    preview !== null && preview.invalidCount === 0 && preview.validCount > 0 && !committing;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">CSV Product Import</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload or paste a CSV to bulk-import products. Max 200 rows, 1 MB.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to Products
        </Link>
      </div>

      {/* Instructions + Template */}
      <section className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm space-y-2">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200">Required columns</h3>
        <p className="text-blue-700 dark:text-blue-300">
          <code className="font-mono">title</code>,{" "}
          <code className="font-mono">description</code>,{" "}
          <code className="font-mono">category</code> (gadgets | clothing | electronics |
          home | foods | books | health | industrial), <code className="font-mono">brand</code>,{" "}
          <code className="font-mono">basePrice</code>
        </p>
        <p className="text-blue-700 dark:text-blue-300">
          Optional: <code className="font-mono">slug</code>, <code className="font-mono">stock</code>,{" "}
          <code className="font-mono">listingType</code> (purchasable | enquiry),{" "}
          <code className="font-mono">isActive</code> (true/false),{" "}
          <code className="font-mono">imageUrl</code>,{" "}
          <code className="font-mono">imagePublicId</code>,{" "}
          <code className="font-mono">attributes</code> (JSON object),{" "}
          <code className="font-mono">variants</code> (JSON array)
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
        >
          ⬇ Download Template CSV
        </button>
      </section>

      {/* File input */}
      <section className="space-y-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">1. Upload or paste CSV</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <label
            htmlFor="csv-file"
            className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition"
          >
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {fileName ? (
                <>
                  <strong className="text-gray-800 dark:text-gray-200">{fileName}</strong> — click
                  to change
                </>
              ) : (
                "Click to choose a .csv file (max 1 MB)"
              )}
            </span>
            <input
              id="csv-file"
              ref={fileRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="csv-paste"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Or paste CSV text directly
          </label>
          <textarea
            id="csv-paste"
            rows={8}
            className="w-full font-mono text-xs border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`title,slug,description,category,brand,basePrice\nMy Product,,Great product,electronics,Acme,999`}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setPreview(null);
              setFileName(null);
            }}
          />
        </div>
      </section>

      {/* Preview button */}
      <section className="space-y-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">2. Preview</h3>
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={previewing || !csvText.trim()}
          className="px-5 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {previewing ? "Previewing…" : "Preview CSV"}
        </button>

        {previewing && <Skeleton />}

        {/* Preview results */}
        {preview && !previewing && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex flex-wrap gap-4 items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium">
                Total rows:{" "}
                <strong>{preview.rows.length}</strong>
              </span>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ Valid: <strong>{preview.validCount}</strong>
              </span>
              {preview.invalidCount > 0 && (
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  ✗ Invalid: <strong>{preview.invalidCount}</strong>
                </span>
              )}
              {preview.invalidCount === 0 && (
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  🎉 All rows valid — ready to import!
                </span>
              )}
            </div>

            {/* Error list */}
            {preview.invalidCount > 0 && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-red-800 dark:text-red-200 text-sm">
                  Errors to fix ({preview.invalidCount} row
                  {preview.invalidCount === 1 ? "" : "s"})
                </h4>
                <ul className="space-y-2 text-sm">
                  {preview.rows
                    .filter((r) => !r.valid)
                    .map((r: CsvImportRowResult) => (
                      <li key={r.line} className="flex flex-col gap-0.5">
                        <span className="font-mono font-semibold text-red-700 dark:text-red-300">
                          Line {r.line}:
                        </span>
                        <ul className="ml-4 list-disc text-red-600 dark:text-red-400">
                          {r.errors.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Row table */}
            {preview.rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Line
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Title
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Slug
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Category
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Price
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {preview.rows.map((row: CsvImportRowResult) => (
                      <tr
                        key={row.line}
                        className={
                          row.valid
                            ? ""
                            : "bg-red-50 dark:bg-red-950"
                        }
                      >
                        <td className="px-3 py-2 font-mono text-gray-500 dark:text-gray-400">
                          {row.line}
                        </td>
                        <td className="px-3 py-2">
                          <RowStatusBadge valid={row.valid} />
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate text-gray-800 dark:text-gray-200">
                          {row.data?.title ?? (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[140px] truncate">
                          {row.data?.slug ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {row.data?.category ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {row.data ? `₹${row.data.basePrice.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {row.data?.listingType ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.rows.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No rows found in the CSV.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Commit button */}
      <section className="space-y-2 pb-8">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">3. Import</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The Commit button is enabled only when every row in the preview is valid. The import is
          all-or-nothing.
        </p>
        <button
          type="button"
          onClick={() => void handleCommit()}
          disabled={!canCommit}
          className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {committing
            ? "Importing…"
            : preview && preview.validCount > 0
            ? `Commit ${preview.validCount} Product${preview.validCount === 1 ? "" : "s"}`
            : "Commit Import"}
        </button>
        {preview && preview.invalidCount > 0 && (
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Fix {preview.invalidCount} error{preview.invalidCount === 1 ? "" : "s"} before
            importing.
          </p>
        )}
      </section>
    </div>
  );
}
