"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegisterInputSchema, RegisterInput } from "@yourstore/shared";
import { apiClient, ApiClientError } from "../../lib/api";
import { useToast } from "@/components/Toast";
import { PasswordInput } from "@/components/PasswordInput";

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<RegisterInput>({
    name: "",
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string | undefined;
    email?: string | undefined;
    password?: string | undefined;
  }>({});
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

    // Client-side Zod validation reusing shared RegisterInputSchema
    const result = RegisterInputSchema.safeParse(formData);
    if (!result.success) {
      const errors: { name?: string | undefined; email?: string | undefined; password?: string | undefined } = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof typeof errors;
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      showToast("Please fix the validation errors in the form.", "error");
      return;
    }

    setIsSubmitting(true);
    void (async () => {
      try {
        await apiClient("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify(result.data),
        });

        showToast("Registration successful! Welcome to YourStore.", "success");
        router.push("/");
        router.refresh();
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "Registration failed";
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
            Create an account
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Sign up to get access to orders, wishlist, and fast checkout
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={formData.name}
              onChange={handleChange}
              disabled={isSubmitting}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              className={`w-full px-3.5 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 bg-transparent ${
                fieldErrors.name
                  ? "border-red-500 focus:ring-red-500/20"
                  : "border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20"
              }`}
              placeholder="Alice Doe"
            />
            {fieldErrors.name && (
              <p id="name-error" className="mt-1 text-xs text-red-500">
                {fieldErrors.name}
              </p>
            )}
          </div>

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
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              label=""
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting}
              error={fieldErrors.password}
              helperText="Must be at least 8 chars and contain uppercase, lowercase, number, and special character."
              placeholder="At least 8 chars, 1 uppercase, 1 number, 1 symbol"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition shadow disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
