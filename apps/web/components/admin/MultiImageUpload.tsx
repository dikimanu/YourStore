"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { apiClient } from "../../../lib/api";
import { compressImage } from "../../../lib/compress";
import { useToast } from "../../../components/Toast";
import { Image as ProductImage } from "@yourstore/shared";

interface MultiImageUploadProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  maxImages?: number;
}

interface SignUploadResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
}

export function MultiImageUpload({
  images,
  onChange,
  maxImages = 6,
}: MultiImageUploadProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > maxImages) {
      showToast(
        `Cannot upload more than ${maxImages} images total (currently have ${images.length})`,
        "error",
      );
      return;
    }

    setUploading(true);
    const newUploadedImages: ProductImage[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        setUploadProgress(`Processing image ${i + 1} of ${files.length}...`);

        // Check raw file size limit (10 MB per brief)
        if (file.size > 10 * 1024 * 1024) {
          showToast(`File "${file.name}" exceeds maximum allowed size of 10 MB`, "error");
          continue;
        }

        // Validate MIME type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
        if (!allowedTypes.includes(file.type)) {
          showToast(`File "${file.name}" has unsupported type: ${file.type}`, "error");
          continue;
        }

        // 1. Compress image in the browser before upload
        setUploadProgress(`Compressing "${file.name}"...`);
        const compressedBlob = await compressImage(file);

        // 2. Request signed upload credentials from API
        setUploadProgress(`Requesting signature for "${file.name}"...`);
        const signData = await apiClient<SignUploadResponse>("/v1/admin/uploads/sign", {
          method: "POST",
          body: JSON.stringify({
            fileType: file.type,
            fileSize: compressedBlob.size,
            imageCount: 1,
          }),
        });

        // 3. Upload directly to Cloudinary using signed parameters
        setUploadProgress(`Uploading "${file.name}" to Cloudinary...`);
        const formData = new FormData();
        formData.append("file", compressedBlob, file.name);
        formData.append("api_key", signData.apiKey);
        formData.append("timestamp", signData.timestamp.toString());
        formData.append("signature", signData.signature);
        formData.append("folder", signData.folder);

        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`;
        const res = await fetch(cloudinaryUrl, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
          throw new Error(
            errData.error?.message || `Cloudinary upload failed with status ${res.status}`,
          );
        }

        const cloudRes = (await res.json()) as CloudinaryUploadResponse;

        newUploadedImages.push({
          url: cloudRes.secure_url,
          publicId: cloudRes.public_id,
          alt: file.name.replace(/\.[^/.]+$/, ""),
        });
      }

      if (newUploadedImages.length > 0) {
        onChange([...images, ...newUploadedImages]);
        showToast(
          `Uploaded ${newUploadedImages.length} image${newUploadedImages.length > 1 ? "s" : ""} successfully`,
          "success",
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to upload image",
        "error",
      );
    } finally {
      setUploading(false);
      setUploadProgress("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleAltChange = (index: number, alt: string) => {
    const updated = [...images];
    const target = updated[index];
    if (target) {
      updated[index] = { ...target, alt };
      onChange(updated);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Product Images (Max {maxImages}, up to 10 MB each)
        </label>
        <span className="text-xs text-gray-500">
          {images.length} of {maxImages} images
        </span>
      </div>

      {/* Grid of uploaded images */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {images.map((img, idx) => (
            <div
              key={img.publicId || idx}
              className="relative border border-gray-200 dark:border-gray-800 rounded-lg p-2 bg-gray-50 dark:bg-gray-900 flex flex-col gap-2"
            >
              <div className="relative w-full h-32 rounded overflow-hidden bg-gray-200 dark:bg-gray-800">
                <Image
                  src={img.url}
                  alt={img.alt || `Product image ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`alt-${idx}`} className="sr-only">
                  Alt text for image {idx + 1}
                </label>
                <input
                  id={`alt-${idx}`}
                  type="text"
                  placeholder="Alt description"
                  value={img.alt}
                  onChange={(e) => handleAltChange(idx, e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveImage(idx)}
                className="text-xs text-red-600 hover:text-red-700 dark:hover:text-red-400 font-medium self-end"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload trigger */}
      {images.length < maxImages && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            disabled={uploading}
            onChange={(e) => void handleFilesSelected(e)}
            className="hidden"
            id="multi-image-upload-input"
          />
          <label
            htmlFor="multi-image-upload-input"
            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 transition ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">{uploadProgress}</span>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Click to select images
                </p>
                <p className="text-xs text-gray-500">
                  JPEG, PNG, WebP or AVIF (compressed in-browser before upload)
                </p>
              </div>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
