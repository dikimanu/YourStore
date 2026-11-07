import Stripe from "stripe";
import { env } from "../env.js";
import { InternalServerError } from "./errors.js";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new InternalServerError("Stripe secret key is not configured");
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
    typescript: true,
  });

  return stripeClient;
}
