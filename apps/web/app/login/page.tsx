"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginInputSchema, LoginInput } from "@yourstore/shared";
import { apiClient, ApiClientError } from "../../lib/api";
import { useToast } from "../../components/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<LoginInput>({
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | undefined; password?: string | undefined }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});

    // Client-side Zod validation
    const result = LoginInputSchema.safeParse(formData);
    if (!result.success) {
      const errors: { email?: string | undefined; password?: string | undefined } = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof typeof errors;
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      showToast("Please check the form for errors.", "error");
      return;
    }

    setIsSubmitting(true);
    void (async () => {
      try {
        await apiClient("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify(result.data),
        });

        showToast("Logged in successfully! Redirecting...", "success");
        router.push("/");
        router.refresh();
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "Failed to log in";
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
            Welcome back
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Log in to your account to continue shopping
          </p>
        </div>

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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className={`w-full px-3.5 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 bg-transparent ${
                fieldErrors.password
                  ? "border-red-500 focus:ring-red-500/20"
                  : "border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20"
              }`}
              placeholder="••••••••"
            />
            {fieldErrors.password && (
              <p id="password-error" className="mt-1 text-xs text-red-500">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition shadow disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
