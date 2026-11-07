/**
 * Custom Next.js image loader for Cloudinary.
 * Uses imageUrl() from @yourstore/shared — the ONLY place that builds Cloudinary URLs.
 * Falls through to the src URL as-is for placeholder images (placehold.co, http*).
 */
import { imageUrl, IMAGE_PRESET_WIDTHS } from "@yourstore/shared";
import type { ImagePreset } from "@yourstore/shared";

interface LoaderParams {
  src: string;
  width: number;
  quality?: number;
}

// Map a requested width to the nearest preset
function widthToPreset(width: number): ImagePreset {
  if (width <= IMAGE_PRESET_WIDTHS.thumb) return "thumb";
  if (width <= IMAGE_PRESET_WIDTHS.card) return "card";
  if (width <= IMAGE_PRESET_WIDTHS.detail) return "detail";
  return "zoom";
}

export default function cloudinaryLoader({ src, width }: LoaderParams): string {
  // If already a full URL (seed placeholders, external images) return as-is
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  const preset = widthToPreset(width);
  return imageUrl(src, preset);
}
