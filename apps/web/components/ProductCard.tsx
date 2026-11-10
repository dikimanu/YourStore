/**
 * ProductCard — server component.
 * Renders a refined product summary card for grids with image zoom on hover,
 * category chip, rating stars, stock badge, and price emphasis.
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

  const imgSrc = firstImage
    ? isSeedPlaceholder(firstImage.publicId)
      ? firstImage.url
      : imageUrl(firstImage.publicId, "card")
    : PLACEHOLDER_DATA_URI;

  const imgAlt = firstImage?.alt || product.title;
  const ratingAvg = Math.round(product.ratingAvg ?? 0);
  const ratingCount = product.ratingCount ?? 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-1 motion-reduce:hover:translate-y-0 transition-all duration-200"
    >
      <div className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <Image
          src={imgSrc}
          alt={imgAlt}
          fill
          sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:group-hover:scale-100"
          placeholder="blur"
          blurDataURL={PLACEHOLDER_DATA_URI}
          unoptimized={
            imgSrc.startsWith("https://placehold.co") ||
            imgSrc.startsWith("data:")
          }
        />
        {/* Category chip */}
        <span className="absolute top-2 left-2 bg-gray-900/80 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded capitalize">
          {product.category}
        </span>

        {/* Stock badge / status */}
        {product.stock !== undefined && product.stock === 0 ? (
          <span className="absolute bottom-2 left-2 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
            Out of Stock
          </span>
        ) : product.stock !== undefined && product.stock > 0 && product.stock <= 10 ? (
          <span className="absolute bottom-2 left-2 bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
            Only {product.stock} left
          </span>
        ) : null}

        {!product.isActive && (
          <span className="absolute top-2 right-2 bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded">
            Archived
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
            {product.brand}
          </p>
          {/* Rating stars */}
          <div className="flex items-center text-amber-400 text-xs shrink-0" aria-label={`Rating: ${product.ratingAvg ?? 0} out of 5`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`w-3.5 h-3.5 ${
                  star <= ratingAvg ? "fill-amber-400 text-amber-400" : "fill-gray-300 dark:fill-gray-700 text-gray-300 dark:text-gray-700"
                }`}
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            {ratingCount > 0 && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-1">
                ({ratingCount})
              </span>
            )}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {product.title}
        </h3>

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-base font-extrabold text-blue-700 dark:text-blue-300">
            ₹{product.basePrice.toLocaleString("en-IN")}
          </span>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
