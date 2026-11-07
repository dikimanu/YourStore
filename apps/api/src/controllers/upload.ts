import crypto from "node:crypto";
import { Request, Response } from "express";
import { SignUploadInput } from "@yourstore/shared";
import { AppError } from "../lib/errors.js";

/**
 * Generates a signed Cloudinary upload signature.
 * Signs on the server using SHA-1 (or SHA-256) per Cloudinary specifications so
 * CLOUDINARY_API_SECRET is never exposed to the client.
 * Restricts uploads to the fixed folder "yourstore/products".
 * Returns strictly: { signature, timestamp, apiKey, cloudName, folder }
 */
export function signUpload(
  req: Request<unknown, unknown, SignUploadInput>,
  res: Response,
): void {
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"];
  const apiKey = process.env["CLOUDINARY_API_KEY"];
  const apiSecret = process.env["CLOUDINARY_API_SECRET"];

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      500,
      "INTERNAL_ERROR",
      "Cloudinary credentials are not configured on the server",
    );
  }


  const timestamp = Math.round(Date.now() / 1000);
  const folder = "yourstore/products";

  // Cloudinary signature parameters must be sorted alphabetically by key:
  // Here: folder=..., timestamp=...
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;

  // Signature is SHA-1 of paramsToSign + apiSecret
  const signature = crypto
    .createHash("sha1")
    .update(`${paramsToSign}${apiSecret}`)
    .digest("hex");

  res.status(200).json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
  });
}
