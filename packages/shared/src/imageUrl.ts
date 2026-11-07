import { ImagePreset, IMAGE_PRESET_WIDTHS } from "./constants.js";

/**
 * Builds an optimized Cloudinary URL for a given publicId and preset.
 * Strictly supports the four fixed presets:
 * - thumb: 200w
 * - card: 400w
 * - detail: 800w
 * - zoom: 1400w
 * Always applies f_auto,q_auto,c_limit.
 *
 * @param publicId Cloudinary public_id (or path)
 * @param preset "thumb" | "card" | "detail" | "zoom"
 * @param cloudName Optional cloudName override or fallback to env / generic
 */
export function imageUrl(
  publicId: string,
  preset: ImagePreset,
  cloudName = process.env["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"] ||
    process.env["CLOUDINARY_CLOUD_NAME"] ||
    "yourstore",
): string {
  // If the publicId is already a full URL, return it if not a cloudinary URL,
  // or extract the publicId. Usually publicId is just the Cloudinary asset identifier.
  if (publicId.startsWith("http://") || publicId.startsWith("https://")) {
    return publicId;
  }

  const width = IMAGE_PRESET_WIDTHS[preset];
  // Strictly four presets, f_auto,q_auto,c_limit,w_<width>
  const transformation = `f_auto,q_auto,c_limit,w_${width}`;
  const cleanPublicId = publicId.replace(/^\//, "");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${cleanPublicId}`;
}
