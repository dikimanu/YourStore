"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ResetPasswordInputSchema } from "@yourstore/shared";
import { apiClient, ApiClientError } from "../../lib/api";
import { useToast } from "../../components/Toast";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string | undefined; confirmPassword?: string | undefined }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});

    if (!token) {
      showToast("Missing or invalid password reset token.", "error");
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      showToast("Passwords do not match.", "error");
      return;
    }

    // Validate using shared ResetPasswordInputSchema
    const result = ResetPasswordInputSchema.safeParse({ token, password });
    if (!result.success) {
      const errors: { password?: string | undefined; confirmPassword?: string | undefined } = {};
      for (const issue of result.error.issues) {
        if (issue.path.includes("password")) {
          errors.password = issue.message;
        }
      }
      setFieldErrors(errors);
      showToast("Password does not meet security requirements.", "error");
      return;
    }

    setIsSubmitting(true);
    void (async () => {
      try {
        await apiClient<{ success: boolean; message: string }>("/api/v1/auth/reset-password", {
          method: "POST",
          body: JSON.stringify(result.data),
        });

        showToast("Password reset successfully! Please log in with your new password.", "success");
        router.push("/login");
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "Failed to reset password.";
        showToast(message, "error");
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  if (!token) {
    return (
      <div className="text-center py-6">
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300 mb-4">
          No password reset token provided. Please request a new link.
        </div>
        <Link
          href="/forgot-password"
          className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition"
        >
          Request Reset Link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
          disabled={isSubmitting}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          className={`w-full px-3.5 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 bg-transparent ${
            fieldErrors.password
              ? "border-red-500 focus:ring-red-500/20"
              : "border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20"
          }`}
          placeholder="New secure password"
        />
        {fieldErrors.password ? (
          <p id="password-error" className="mt-1 text-xs text-red-500">
            {fieldErrors.password}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Min 8 chars, including uppercase, lowercase, number, and special symbol.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          disabled={isSubmitting}
          aria-describedby={fieldErrors.confirmPassword ? "confirm-error" : undefined}
          className={`w-full px-3.5 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 bg-transparent ${
            fieldErrors.confirmPassword
              ? "border-red-500 focus:ring-red-500/20"
              : "border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20"
          }`}
          placeholder="Re-enter new password"
        />
        {fieldErrors.confirmPassword && (
          <p id="confirm-error" className="mt-1 text-xs text-red-500">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition shadow disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {isSubmitting ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="bg-white dark:bg-gray-900 shadow-md rounded-xl p-8 border border-gray-200 dark:border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Create new password
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Enter your new password below to regain access to your account.
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-sm py-8 text-gray-500">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>

        <div className="text-center mt-6">
          <Link
            href="/login"
            className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            &larr; Back to Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
