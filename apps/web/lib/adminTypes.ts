/**
 * AdminProduct extends the shared Product schema shape with the `id` field
 * that the API serialises from MongoDB's `_id` before sending the response.
 * The shared `Product` type (from Zod) does not include `id` because that is
 * a database concern; the API controller maps `_id -> id` on every admin
 * endpoint, so this augmented type correctly models what the browser receives.
 */
import type { Product } from "@yourstore/shared";

export type AdminProduct = Product & { id: string };
