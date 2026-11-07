"use client";

import React, { useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { EnquiryType } from "@yourstore/shared";

interface VehicleEnquiryFormProps {
  productId: string;
  productTitle: string;
}

export function VehicleEnquiryForm({
  productId,
  productTitle,
}: VehicleEnquiryFormProps) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EnquiryType>("enquiry");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [preferredDate, setPreferredDate] = useState("");

  const handleOpen = (type: EnquiryType) => {
    setActiveTab(type);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setMessage("");
    setPreferredDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        productId,
        name: name.trim(),
        phone: phone.trim(),
        message: message.trim(),
        type: activeTab,
      };

      if (activeTab === "visit") {
        if (!preferredDate) {
          showToast("Please choose a preferred visit date", "error");
          setLoading(false);
          return;
        }
        payload["preferredDate"] = new Date(preferredDate).toISOString();
      }

      const res = await apiClient<{ message: string }>("/api/v1/enquiries", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast(res.message, "success");
      handleClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        showToast(err.message, "error");
      } else {
        showToast(
          err instanceof Error ? err.message : "Failed to submit request",
          "error",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Get tomorrow's date string in YYYY-MM-DD for min date picker
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0] || "";

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={() => handleOpen("enquiry")}
          className="w-full py-3 px-5 rounded-xl font-semibold bg-amber-500 hover:bg-amber-600 text-white transition focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm"
        >
          Enquire Now
        </button>
        <button
          type="button"
          onClick={() => handleOpen("visit")}
          className="w-full py-3 px-5 rounded-xl font-semibold border-2 border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          Book a Dealership Visit
        </button>
      </div>

      {/* Modal dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enquiry-dialog-title"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h2 id="enquiry-dialog-title" className="text-lg font-bold">
                  {activeTab === "visit" ? "Book a Dealership Visit" : "Vehicle Enquiry"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs sm:max-w-sm mt-0.5">
                  {productTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Type selector tabs */}
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("enquiry")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === "enquiry"
                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                General Enquiry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("visit")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === "visit"
                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                Schedule Visit / Test Ride
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label htmlFor="enquiry-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  id="enquiry-name"
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="enquiry-phone" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  10-Digit Mobile Number *
                </label>
                <input
                  id="enquiry-phone"
                  type="tel"
                  required
                  pattern="^(?:(?:\+91[\s-]?)?|0)?[6-9]\d{9}$"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {activeTab === "visit" && (
                <div>
                  <label htmlFor="enquiry-date" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Preferred Visit Date *
                  </label>
                  <input
                    id="enquiry-date"
                    type="date"
                    required
                    min={minDate}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div>
                <label htmlFor="enquiry-message" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message / Questions (optional)
                </label>
                <textarea
                  id="enquiry-message"
                  rows={3}
                  maxLength={1000}
                  placeholder={
                    activeTab === "visit"
                      ? "Any preferred timing or specific questions about the vehicle?"
                      : "Ask about pricing on road, financing, color availability..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition disabled:opacity-50 shadow-sm"
                >
                  {loading ? "Submitting…" : activeTab === "visit" ? "Confirm Visit" : "Submit Enquiry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
