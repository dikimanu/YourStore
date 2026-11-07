export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Array<{ path: string; message: string }>;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly details?: Array<{ path: string; message: string }> | undefined;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiClientError";
    this.code = payload.code;
    this.details = payload.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiErrorPayload;
}

/**
 * Universal client fetcher routing through Next.js rewrite (/api/* -> backend API).
 * Automatically injects the required X-Requested-With CSRF protection header
 * on state-changing methods (POST, PUT, PATCH, DELETE) and includes credentials for httpOnly cookies.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  // Enforce CSRF header check on state-changing requests
  if (isStateChanging && !headers.has("X-Requested-With")) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }

  // Ensure endpoint starts with /api
  const normalizedEndpoint = endpoint.startsWith("/api") ? endpoint : `/api${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const response = await fetch(normalizedEndpoint, {
    ...options,
    method,
    headers,
    credentials: "include", // First-party httpOnly cookie transport; never localStorage
  });

  const contentType = response.headers.get("content-type");
  let responseData: unknown = null;
  if (contentType && contentType.includes("application/json")) {
    responseData = await response.json();
  }

  if (!response.ok) {
    const errorBody = responseData as { error?: ApiErrorPayload } | null;
    const payload: ApiErrorPayload = errorBody?.error || {
      code: "API_ERROR",
      message: response.statusText || `Request failed with status ${response.status}`,
    };
    throw new ApiClientError(payload);
  }

  return responseData as T;
}
