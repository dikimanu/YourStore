import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { AddToCartButton } from "@/components/AddToCartButton";
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

const PLACEHOLDER_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%231f2937'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='18' fill='%236b7280'%3ENo Image%3C/text%3E%3C/svg%3E";

function isSeedPlaceholder(publicId: string): boolean {
  return publicId.startsWith("seed-placeholder/");
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

  const mainImage = product.images[0];
  const mainImgSrc = mainImage
    ? isSeedPlaceholder(mainImage.publicId)
      ? mainImage.url
      : imageUrl(mainImage.publicId, "detail")
    : PLACEHOLDER_DATA_URI;

  const isEnquiry = product.listingType === "enquiry";
  const inStock = product.stock === undefined || product.stock > 0;

  return (
    <div className="space-y-16">
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
        {/* Images gallery */}
        <div className="space-y-4">
          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800">
            <Image
              src={mainImgSrc}
              alt={mainImage?.alt || product.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              placeholder="blur"
              blurDataURL={PLACEHOLDER_DATA_URI}
              unoptimized={
                mainImgSrc.startsWith("https://placehold.co") ||
                mainImgSrc.startsWith("data:")
              }
            />
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.images.map((img, idx) => {
                const thumbSrc = isSeedPlaceholder(img.publicId)
                  ? img.url
                  : imageUrl(img.publicId, "thumb");
                return (
                  <div
                    key={img.publicId || idx}
                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800"
                  >
                    <Image
                      src={thumbSrc}
                      alt={img.alt || `${product.title} view ${idx + 1}`}
                      fill
                      sizes="100px"
                      className="object-cover"
                      unoptimized={
                        thumbSrc.startsWith("https://placehold.co") ||
                        thumbSrc.startsWith("data:")
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

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

          {/* Pricing & Stock Status */}
          <div className="flex items-center gap-4">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
              ₹{product.basePrice.toLocaleString("en-IN")}
            </span>
            {isEnquiry ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Enquiry Only
              </span>
            ) : inStock ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                In Stock {product.stock !== undefined ? `(${product.stock})` : ""}
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                Out of Stock
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line">
            {product.description}
          </p>

          {/* Variants (Clothing) */}
          {product.category === "clothing" && product.variants.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold">Available Variants</h2>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <div
                    key={v.sku}
                    className="border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900"
                  >
                    <span className="font-semibold">{v.options.size || "Standard"}</span>
                    {v.options.color && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {" "}
                        / {v.options.color}
                      </span>
                    )}
                    <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                      {v.stock > 0 ? `${v.stock} left` : "Out of stock"}
                      {v.priceOverride !== undefined && ` · ₹${v.priceOverride}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            {isEnquiry ? (
              <div className="w-full text-center py-3.5 px-6 rounded-xl font-semibold bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer">
                Submit Enquiry
              </div>
            ) : (
              <AddToCartButton
                productId={product.id ?? ""}
                inStock={inStock}
              />
            )}
          </div>

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
    </div>
  );
}
