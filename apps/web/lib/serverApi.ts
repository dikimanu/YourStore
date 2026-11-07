/**
 * Server-side API fetch helper.
 * Calls the backend directly via API_URL (bypasses the Next.js /api/* rewrite).
 * Never used on the client — import only in server components and generateMetadata.
 */
import { env } from "@/lib/env";

export interface ApiListResponse<T> {
  products: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiProductResponse<T> {
  product: T;
}

export interface ServerApiOptions {
  /** Additional query params */
  params?: Record<string, string | number | undefined>;
  /** ISR revalidation in seconds (default 60) */
  revalidate?: number;
  /** Request tags for on-demand revalidation */
  tags?: string[];
}

async function serverFetch<T>(
  path: string,
  options: ServerApiOptions = {},
): Promise<T> {
  const { params = {}, revalidate = 60, tags } = options;

  const url = new URL(`${env.API_URL}/api${path}`);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") {
      url.searchParams.set(key, String(val));
    }
  }

  const res = await fetch(url.toString(), {
    next: {
      revalidate,
      ...(tags ? { tags } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`API error ${String(res.status)}: ${path}`);
  }

  return res.json() as Promise<T>;
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export function fetchProducts<T>(
  params: Record<string, string | number | undefined>,
  options?: Omit<ServerApiOptions, "params">,
) {
  return serverFetch<ApiListResponse<T>>("/v1/products", { params, ...options });
}

export function fetchProductBySlug<T>(
  slug: string,
  options?: Omit<ServerApiOptions, "params">,
) {
  return serverFetch<ApiProductResponse<T>>(`/v1/products/${slug}`, options);
}

export function fetchRelatedProducts<T>(
  slug: string,
  options?: Omit<ServerApiOptions, "params">,
) {
  return serverFetch<{ products: T[] }>(`/v1/products/${slug}/related`, options);
}

export function fetchSuggestions(
  query: string,
  options?: Omit<ServerApiOptions, "params">,
) {
  return serverFetch<{ suggestions: string[] }>("/v1/products/suggestions", {
    params: { q: query },
    ...options,
  });
}
