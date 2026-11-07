import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductInteractiveSection } from "@/components/ProductInteractiveSection";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/serverApi";
import { imageUrl, Product } from "@yourstore/shared";

type ProductWithId = Product & { id: string };

function formatAttribute(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export const revalidate = 60;

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const res = await fetchProductBySlug<Product>(slug, {
    revalidate: 60,
  }).catch(() => null);

  if (!res?.product) {
    return { title: "Product Not Found" };
  }

  const p = res.product;
  return {
    title: `${p.title} — YourStore`,
    description: p.description.slice(0, 160),
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;

  const [productRes, relatedRes] = await Promise.all([
    fetchProductBySlug<ProductWithId>(slug, {
      revalidate: 60,
      tags: [`product-${slug}`],
    }).catch(() => null),
    fetchRelatedProducts<ProductWithId>(slug, {
      revalidate: 60,
    }).catch(() => null),
  ]);

  if (!productRes?.product) {
    notFound();
  }

  const product = productRes.product;
  const related = (relatedRes?.products ?? []);

  const isEnquiry = product.listingType === "enquiry";

  const primaryImage = product.images[0];
  const primaryImageUrl = primaryImage
    ? primaryImage.publicId.startsWith("seed-placeholder/")
      ? primaryImage.url
      : imageUrl(primaryImage.publicId, "card")
    : undefined;

  const currentViewedItem = {
    id: product.id,
    slug: product.slug,
    title: product.title,
    basePrice: product.basePrice,
    image: primaryImageUrl,
    category: product.category,
    brand: product.brand,
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((img) => img.url),
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.basePrice,
      availability:
        product.stock === undefined || product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `https://yourstore.in/product/${product.slug}`,
    },
  };

  return (
    <div className="space-y-16 pb-16">
      {/* Product JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-gray-500 dark:text-gray-400">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:underline">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link
              href={`/category/${product.category}`}
              className="capitalize hover:underline"
            >
              {product.category}
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-xs sm:max-w-md">
            {product.title}
          </li>
        </ol>
      </nav>

      {/* Main Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images gallery with click-to-zoom */}
        <ProductGallery images={product.images} title={product.title} />

        {/* Product Info */}
        <div className="flex flex-col gap-6">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-blue-600 dark:text-blue-400">
              {product.brand}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-1">
              {product.title}
            </h1>
          </div>

          {/* Pricing, Variant Selector & Add-To-Cart */}
          <ProductInteractiveSection product={product} isEnquiry={isEnquiry} />

          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line pt-4 border-t border-gray-200 dark:border-gray-800">
            {product.description}
          </p>

          {/* Category Attributes List */}
          {product.attributes && Object.keys(product.attributes).length > 0 && (
            <div className="space-y-3 pt-6 border-t border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Specifications
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {Object.entries(product.attributes).map(([key, value]) => {
                  if (value === undefined || value === null || value === "") return null;
                  const label = key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase());
                  return (
                    <div
                      key={key}
                      className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60"
                    >
                      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-200 text-right">
                        {formatAttribute(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="pt-12 border-t border-gray-200 dark:border-gray-800 space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold">Related Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Viewed */}
      <RecentlyViewed currentProduct={currentViewedItem} />
    </div>
  );
}
