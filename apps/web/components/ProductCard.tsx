/**
 * ProductCard — server component.
 * Renders a product summary card for grids. Uses imageUrl() via the
 * custom cloudinaryLoader; falls back to a neutral placeholder SVG
 * if the image publicId is a seed placeholder (no Cloudinary asset exists).
 */
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@yourstore/shared";
import { imageUrl } from "@yourstore/shared";

interface ProductCardProps {
  product: Product & { id?: string; slug: string };
}

const PLACEHOLDER_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%231f2937'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='14' fill='%236b7280'%3ENo Image%3C/text%3E%3C/svg%3E";

function isSeedPlaceholder(publicId: string): boolean {
  return publicId.startsWith("seed-placeholder/");
}

export function ProductCard({ product }: ProductCardProps) {
  const firstImage = product.images[0];

  // For seed placeholders, use the placehold.co URL directly (from seedData).
  // For real Cloudinary assets, use imageUrl() — the only URL-builder.
  const imgSrc = firstImage
    ? isSeedPlaceholder(firstImage.publicId)
      ? firstImage.url // placehold.co URL stored in seed
      : imageUrl(firstImage.publicId, "card")
    : PLACEHOLDER_DATA_URI;

  const imgAlt = firstImage?.alt || product.title;

  const isEnquiry = product.listingType === "enquiry";

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200"
    >
      <div className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <Image
          src={imgSrc}
          alt={imgAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          placeholder="blur"
          blurDataURL={PLACEHOLDER_DATA_URI}
          unoptimized={
            imgSrc.startsWith("https://placehold.co") ||
            imgSrc.startsWith("data:")
          }
        />
        {!product.isActive && (
          <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded">
            Archived
          </span>
        )}
        {isEnquiry && (
          <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-semibold px-2 py-0.5 rounded">
            Enquiry
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {product.brand}
        </p>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {product.title}
        </h3>

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
            ₹{product.basePrice.toLocaleString("en-IN")}
          </span>
          {isEnquiry ? (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Enquire
            </span>
          ) : (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              View →
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
