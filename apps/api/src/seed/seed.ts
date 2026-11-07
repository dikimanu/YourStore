/**
 * Database seed script — Phase 2 C-i
 *
 * Safety rules:
 *  - Refuses to run when NODE_ENV === "production".
 *  - Clears ONLY the users and products collections (leaves orders, reviews, etc. untouched).
 *  - Idempotent: safe to run multiple times.
 *
 * Usage:
 *   pnpm seed          (from apps/api)
 *   SEED_ADMIN_PASSWORD=... SEED_USER_PASSWORD=... pnpm seed
 */

import "dotenv/config";
import mongoose from "mongoose";
import { CreateProductInputSchema } from "@yourstore/shared";
import { hashPassword } from "../lib/password.js";
import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { SEED_PRODUCTS } from "./seedData.js";

// ─── Environment guards ───────────────────────────────────────────────────────

const NODE_ENV = process.env["NODE_ENV"] ?? "development";

if (NODE_ENV === "production") {
  console.error(
    "❌  Seed refused: NODE_ENV is 'production'. " +
      "This script must not run against a production database.",
  );
  process.exit(1);
}

const MONGO_URI = process.env["MONGO_URI"];
if (!MONGO_URI) {
  console.error("❌  MONGO_URI is not set. Add it to your .env file.");
  process.exit(1);
}

const SEED_ADMIN_PASSWORD = process.env["SEED_ADMIN_PASSWORD"];
if (!SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.trim().length < 8) {
  console.error(
    "❌  SEED_ADMIN_PASSWORD is missing or too short (min 8 chars). " +
      "Set it in your .env file or as an environment variable.",
  );
  process.exit(1);
}

const SEED_USER_PASSWORD = process.env["SEED_USER_PASSWORD"];
if (!SEED_USER_PASSWORD || SEED_USER_PASSWORD.trim().length < 8) {
  console.error(
    "❌  SEED_USER_PASSWORD is missing or too short (min 8 chars). " +
      "Set it in your .env file or as an environment variable.",
  );
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log(`\n🌱  YourStore seed — environment: ${NODE_ENV}`);

  // Connect
  console.log("🔌  Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI as string, { serverSelectionTimeoutMS: 10000 });
  console.log("✅  Connected.\n");

  // ── 1. Clear collections ───────────────────────────────────────────────────
  console.log("🗑️   Clearing users collection...");
  await User.deleteMany({});
  console.log("🗑️   Clearing products collection...");
  await Product.deleteMany({});

  // ── 2. Seed users ─────────────────────────────────────────────────────────
  console.log("\n👤  Hashing passwords (Argon2id)...");
  const [adminHash, userHash] = await Promise.all([
    hashPassword(SEED_ADMIN_PASSWORD as string),
    hashPassword(SEED_USER_PASSWORD as string),
  ]);

  const adminUser = await User.create({
    name: "Store Admin",
    email: "admin@yourstore.test",
    passwordHash: adminHash,
    role: "admin",
    emailVerified: true,
  });

  const demoUser = await User.create({
    name: "Demo Customer",
    email: "customer@yourstore.test",
    passwordHash: userHash,
    role: "user",
    emailVerified: true,
  });

  console.log(`✅  Created admin:    ${adminUser.email}  (role: admin)`);
  console.log(`✅  Created customer: ${demoUser.email}  (role: user)`);

  // ── 3. Validate & seed products ───────────────────────────────────────────
  console.log(`\n📦  Validating and inserting ${String(SEED_PRODUCTS.length)} products...\n`);

  let inserted = 0;
  let failed = 0;

  for (const raw of SEED_PRODUCTS) {
    // Ensure slug is computed the same way the API does
    const candidateSlug = raw.slug ? slugify(raw.slug) : slugify(raw.title);
    const productData = { ...raw, slug: candidateSlug };

    // Validate against the shared Zod schema before touching the DB
    const parsed = CreateProductInputSchema.safeParse(productData);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `    [${i.path.join(".")}] ${i.message}`)
        .join("\n");
      console.error(`❌  Validation failed for "${productData.title}":\n${issues}`);
      failed++;
      continue;
    }

    try {
      await Product.create({
        ...parsed.data,
        ratingAvg: 0,
        ratingCount: 0,
        isActive: true,
      });
      console.log(
        `  ✓  [${productData.category.padEnd(11)}]  ${productData.title}`,
      );
      inserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗  Failed to insert "${productData.title}": ${msg}`);
      failed++;
    }
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────────");
  console.log(`📊  Products inserted : ${String(inserted)}`);
  if (failed > 0) {
    console.log(`⚠️   Products failed   : ${String(failed)}`);
  }
  console.log("────────────────────────────────────────────\n");

  console.log("🎉  Seed complete!\n");
  console.log("   Admin login  : admin@yourstore.test  / $SEED_ADMIN_PASSWORD");
  console.log("   Customer login: customer@yourstore.test / $SEED_USER_PASSWORD\n");

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

seed().catch((err: unknown) => {
  console.error("❌  Seed error:", err instanceof Error ? err.message : err);
  void mongoose.disconnect();
  process.exit(1);
});
