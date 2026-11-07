import type { MetadataRoute } from "next";
import { CATEGORIES } from "@yourstore/shared";
import { fetchProducts } from "@/lib/serverApi";
import type { Product } from "@yourstore/shared";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";

  // Static core routes
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/products",
    "/wishlist",
    "/privacy",
    "/terms",
    "/shipping-and-returns",
  ].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/products" ? "daily" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));

  // Category routes
  const categoryRoutes: MetadataRoute.Sitemap = (CATEGORIES as readonly string[]).map((cat) => ({
    url: `${siteUrl}/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Fetch product slugs for sitemap
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const data = await fetchProducts<Product>({ limit: 100 }, { revalidate: 3600 });
    productRoutes = (data?.products || []).map((p) => ({
      url: `${siteUrl}/product/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    // If backend is sleeping/unreachable during sitemap build, return static & category routes
  }

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
