/**
 * Client-side image compression using HTML5 Canvas.
 * Compresses images before direct upload to Cloudinary to save bandwidth
 * and ensure uploads conform to constraints (< 10 MB).
 */
export async function compressImage(
  file: File,
  maxWidth = 2000,
  maxHeight = 2000,
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // If the file is already small (e.g. < 400KB), no need to compress heavily
    if (file.size < 400 * 1024 && !file.type.includes("bmp")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Determine output MIME type: prefer webp if supported, or image/jpeg
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        mimeType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for client-side compression"));
    };

    img.src = objectUrl;
  });
}
