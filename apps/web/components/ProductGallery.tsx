"use client";

import React, { useState } from "react";
import Image from "next/image";
import { imageUrl } from "@yourstore/shared";
import type { ProductImage } from "@yourstore/shared";

interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
}

const PLACEHOLDER_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%231f2937'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='18' fill='%236b7280'%3ENo Image%3C/text%3E%3C/svg%3E";

function isSeedPlaceholder(publicId: string): boolean {
  return publicId.startsWith("seed-placeholder/");
}

export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const activeImage = images[selectedIndex] || images[0];

  const mainSrc = activeImage
    ? isSeedPlaceholder(activeImage.publicId)
      ? activeImage.url
      : imageUrl(activeImage.publicId, "detail")
    : PLACEHOLDER_DATA_URI;

  const zoomSrc = activeImage
    ? isSeedPlaceholder(activeImage.publicId)
      ? activeImage.url
      : imageUrl(activeImage.publicId, "zoom")
    : PLACEHOLDER_DATA_URI;

  return (
    <div className="space-y-4">
      {/* Main Image with Click-to-Zoom */}
      <div
        onClick={() => setIsZoomed(true)}
        className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 cursor-zoom-in group"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsZoomed(true);
          }
        }}
        aria-label="Click to zoom image"
      >
        <Image
          src={mainSrc}
          alt={activeImage?.alt || title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition duration-300 group-hover:scale-105"
          placeholder="blur"
          blurDataURL={PLACEHOLDER_DATA_URI}
          unoptimized={
            mainSrc.startsWith("https://placehold.co") ||
            mainSrc.startsWith("data:")
          }
        />
        <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 transition">
          🔍 Click to zoom
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, idx) => {
            const thumbSrc = isSeedPlaceholder(img.publicId)
              ? img.url
              : imageUrl(img.publicId, "thumb");
            const isSelected = idx === selectedIndex;
            return (
              <button
                type="button"
                key={img.publicId || idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative aspect-square rounded-lg overflow-hidden border transition bg-gray-100 dark:bg-gray-800 ${
                  isSelected
                    ? "border-blue-600 ring-2 ring-blue-600/30"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600"
                }`}
                aria-label={`View image ${idx + 1}`}
              >
                <Image
                  src={thumbSrc}
                  alt={img.alt || `${title} thumbnail ${idx + 1}`}
                  fill
                  sizes="100px"
                  className="object-cover"
                  unoptimized={
                    thumbSrc.startsWith("https://placehold.co") ||
                    thumbSrc.startsWith("data:")
                  }
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Click-to-Zoom Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed product image"
        >
          <button
            type="button"
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white bg-black/40 rounded-full"
            aria-label="Close zoom"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative max-w-5xl max-h-[90vh] w-full h-[80vh]">
            <Image
              src={zoomSrc}
              alt={activeImage?.alt || title}
              fill
              sizes="100vw"
              className="object-contain"
              unoptimized={
                zoomSrc.startsWith("https://placehold.co") ||
                zoomSrc.startsWith("data:")
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
