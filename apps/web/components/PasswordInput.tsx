"use client";

import React, { useState } from "react";

export interface PasswordInputProps {
  label?: string;
  id: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string | undefined;
  error?: string | undefined;
  helperText?: string | undefined;
  className?: string;
}

export function PasswordInput({
  label = "Password",
  id,
  name = id,
  value,
  onChange,
  autoComplete = "current-password",
  required = false,
  disabled = false,
  placeholder = "••••••••",
  error,
  helperText,
  className = "",
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={`w-full pl-3.5 pr-10 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-2 bg-transparent ${
            error
              ? "border-red-500 focus:ring-red-500/20"
              : "border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500/20"
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded disabled:opacity-50"
        >
          {showPassword ? (
            /* Eye Off SVG */
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
              />
            </svg>
          ) : (
            /* Eye SVG */
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-500">
          {error}
        </p>
      ) : helperText ? (
        <p
          id={`${id}-helper`}
          className="mt-1 text-xs text-gray-500 dark:text-gray-400"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
