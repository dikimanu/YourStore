import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  REVALIDATE_SECRET: z.string().min(8).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌  Invalid web environment variables:\n");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
