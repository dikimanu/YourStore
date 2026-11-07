"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ForgotPasswordInputSchema, ForgotPasswordInput } from "@yourstore/shared";
import { apiClient, ApiClientError } from "../../lib/api";
import { useToast } from "../../components/Toast";

export default function ForgotPasswordPage() {
  const { showToast } = useToast();

  const [formData, setFormData] = useState<ForgotPasswordInput>({ email: "" });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | undefined }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ email: e.target.value });
    if (fieldErrors.email) {
      setFieldErrors({});
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});

    const result = ForgotPasswordInputSchema.safeParse(formData);
    if (!result.success) {
      setFieldErrors({ email: result.error.issues[0]?.message ?? "Invalid email" });
      showToast("Please enter a valid email address.", "error");
      return;
    }

    setIsSubmitting(true);
    void (async () => {
      try {
        await apiClient<{ success: boolean; message: string }>("/api/v1/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify(result.data),
        });

        setSubmitted(true);
        showToast("Reset instructions sent! Please check your inbox.", "success");
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "Failed to process request";
        showToast(message, "error");
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="bg-white dark:bg-gray-900 shadow-md rounded-xl p-8 border border-gray-200 dark:border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Forgot password?
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-300">
              If an account exists for <strong>{formData.email}</strong>, a password reset link has been dispatched.
            </div>
            <p className="text-xs text-gray-500">
              The link is single-use and will expire in 1 hour.
            </p>
            <div className="pt-4">
              <Link
                href="/login"
                className="inline-block py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition"
              >
                Return to Log In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className={`w-full px-3.5 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 bg-transparent ${
                  fieldErrors.email
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
                placeholder="you@example.com"
              />
              {fieldErrors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-500">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition shadow disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

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
