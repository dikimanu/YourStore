"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiClient, ApiClientError } from "../../lib/api";
import { useToast } from "../../components/Toast";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    token ? "verifying" : "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    async function verify() {
      try {
        await apiClient<{ success: boolean; message: string }>("/api/v1/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });

        if (isMounted) {
          setStatus("success");
          showToast("Email verified successfully! You can now log in.", "success");
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof ApiClientError ? err.message : "Invalid or expired verification token.";
          setStatus("error");
          setErrorMessage(message);
          showToast(message, "error");
        }
      }
    }

    void verify();

    return () => {
      isMounted = false;
    };
  }, [token, showToast]);

  if (!token) {
    return (
      <div className="text-center py-6">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300 mb-6">
          No verification token was found in the link. Please check the email you received.
        </div>
        <Link
          href="/login"
          className="inline-block py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition"
        >
          Go to Log In
        </Link>
      </div>
    );
  }

  if (status === "verifying") {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Verifying your email address...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-950/80 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
          ✓
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Email Verified Successfully
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Your email address has been confirmed. You now have full access to YourStore.
        </p>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-block py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition shadow"
          >
            Log In Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-6 space-y-4">
      <div className="w-12 h-12 bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
        ✕
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Verification Failed
      </h2>
      <p className="text-sm text-red-600 dark:text-red-400">
        {errorMessage || "The link may have expired or was already used."}
      </p>
      <div className="pt-2">
        <Link
          href="/login"
          className="inline-block py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition shadow"
        >
          Return to Log In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="bg-white dark:bg-gray-900 shadow-md rounded-xl p-8 border border-gray-200 dark:border-gray-800">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Email Verification
          </h1>
        </div>

        <Suspense fallback={<div className="text-center text-sm py-8 text-gray-500">Loading...</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
