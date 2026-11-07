import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  CLIENT_ORIGIN: z.string().url(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  REVALIDATE_SECRET: z.string().min(8).optional(),
  SENTRY_DSN: z.string().url().optional(),
  SHIPPING_FLAT: z.coerce.number().nonnegative().default(49),
  FREE_SHIPPING_THRESHOLD: z.coerce.number().nonnegative().default(499),
  TAX_PERCENT: z.coerce.number().nonnegative().default(18),
});

function validateEnv() {
  if (process.env["NODE_ENV"] === "test" || process.env["VITEST"] === "true") {
    process.env["JWT_ACCESS_SECRET"] =
      process.env["JWT_ACCESS_SECRET"] || "test_jwt_access_secret_32chars_long!";
    process.env["JWT_REFRESH_SECRET"] =
      process.env["JWT_REFRESH_SECRET"] || "test_jwt_refresh_secret_32chars_long";
    process.env["CLIENT_ORIGIN"] =
      process.env["CLIENT_ORIGIN"] || "http://localhost:3000";
    process.env["STRIPE_WEBHOOK_SECRET"] =
      process.env["STRIPE_WEBHOOK_SECRET"] || "whsec_test_mock_webhook_secret";
    process.env["STRIPE_SECRET_KEY"] =
      process.env["STRIPE_SECRET_KEY"] || "sk_test_mock_stripe_key";
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌  Invalid environment variables:\n");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
