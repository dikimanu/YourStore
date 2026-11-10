import { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import {
  CreateProductInputSchema,
  CsvImportRowResult,
  CATEGORIES,
  LISTING_TYPES,
  Category,
  ListingType,
} from "@yourstore/shared";
import { Product } from "../models/Product.js";
import { createAuditLog } from "../lib/auditLog.js";
import { triggerRevalidation } from "../lib/revalidate.js";
import { BadRequestError } from "../lib/errors.js";

// ---- Constants ----
const MAX_BYTES = 1_000_000; // 1 MB
const MAX_ROWS = 200;

/** Characters that trigger CSV formula injection in spreadsheet apps. */
const FORMULA_INJECTION_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

// ---- Helpers ----

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Returns the sanitised string or null + an error message if formula injection detected. */
function checkFormulaInjection(value: string): { safe: string } | { error: string } {
  if (value.length > 0 && FORMULA_INJECTION_CHARS.has(value[0] as string)) {
    return {
      error: `Cell starts with a potentially dangerous character ('${value[0]}') — possible formula injection attempt`,
    };
  }
  return { safe: value };
}

/** Parse a raw cell value as a boolean (true/false/1/0/yes/no). */
function parseBool(raw: string, defaultVal: boolean): boolean {
  const v = raw.trim().toLowerCase();
  if (v === "" ) return defaultVal;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultVal;
}

/** Parse variants JSON cell; returns the parsed array or an error string. */
function parseVariantsCell(
  raw: string,
): Array<{ sku: string; options: { size?: string; color?: string }; priceOverride?: number; stock: number }> | string {
  if (!raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return "variants must be a JSON array";
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) return "each variant must be an object";
      const v = item as Record<string, unknown>;
      if (typeof v["sku"] !== "string" || !v["sku"]) return "each variant must have a non-empty 'sku'";
      if (typeof v["stock"] !== "number" || !Number.isInteger(v["stock"]) || v["stock"] < 0) {
        return "each variant must have a non-negative integer 'stock'";
      }
      if (v["priceOverride"] !== undefined && (typeof v["priceOverride"] !== "number" || v["priceOverride"] < 0)) {
        return "variant 'priceOverride' must be a non-negative number";
      }
      if (v["options"] !== undefined && (typeof v["options"] !== "object" || v["options"] === null)) {
        return "variant 'options' must be an object";
      }
    }
    return parsed as Array<{ sku: string; options: { size?: string; color?: string }; priceOverride?: number; stock: number }>;
  } catch {
    return "variants is not valid JSON";
  }
}

/** Parse attributes JSON cell; returns the parsed record or an error string. */
function parseAttributesCell(raw: string): Record<string, unknown> | string {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return "attributes must be a JSON object";
    }
    return parsed as Record<string, unknown>;
  } catch {
    return "attributes is not valid JSON";
  }
}

// ---- Row parsing and validation ----

interface RawRow {
  title?: string;
  slug?: string;
  description?: string;
  category?: string;
  brand?: string;
  basePrice?: string;
  stock?: string;
  listingType?: string;
  isActive?: string;
  imageUrl?: string;
  imagePublicId?: string;
  attributes?: string;
  variants?: string;
}

interface ParsedRowData {
  title: string;
  slug: string;
  description: string;
  category: Category;
  brand: string;
  basePrice: number;
  stock?: number;
  listingType: ListingType;
  isActive: boolean;
  images: Array<{ url: string; publicId: string; alt: string }>;
  attributes: Record<string, unknown>;
  variants: Array<{ sku: string; options: { size?: string; color?: string }; priceOverride?: number; stock: number }>;
}

function validateRow(
  raw: RawRow,
  lineIndex: number,
): CsvImportRowResult {
  const line = lineIndex + 2; // 1-based, +1 for header row
  const errors: string[] = [];

  // ---- String fields with formula injection check ----
  const textFields: Array<keyof RawRow> = [
    "title", "slug", "description", "category", "brand",
    "listingType", "imageUrl", "imagePublicId", "attributes", "variants",
  ];
  for (const field of textFields) {
    const val = raw[field];
    if (val && val.length > 0) {
      const check = checkFormulaInjection(val);
      if ("error" in check) {
        errors.push(`${field}: ${check.error}`);
      }
    }
  }

  // If formula injection found we stop processing this row
  if (errors.length > 0) {
    return { line, valid: false, errors };
  }

  // ---- title ----
  const title = (raw.title ?? "").trim();
  if (!title) errors.push("title is required");

  // ---- description ----
  const description = (raw.description ?? "").trim();
  if (!description) errors.push("description is required");

  // ---- category ----
  const categoryRaw = (raw.category ?? "").trim().toLowerCase() as Category;
  if (!CATEGORIES.includes(categoryRaw)) {
    errors.push(`category must be one of: ${CATEGORIES.join(", ")}`);
  }

  // ---- brand ----
  const brand = (raw.brand ?? "").trim();
  if (!brand) errors.push("brand is required");

  // ---- basePrice ----
  const basePriceRaw = (raw.basePrice ?? "").trim();
  const basePrice = Number(basePriceRaw);
  if (!basePriceRaw || Number.isNaN(basePrice) || basePrice < 0) {
    errors.push("basePrice must be a non-negative number");
  }

  // ---- stock ----
  const stockRaw = (raw.stock ?? "").trim();
  let stock: number | undefined;
  if (stockRaw !== "") {
    const stockNum = Number(stockRaw);
    if (Number.isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
      errors.push("stock must be a non-negative integer");
    } else {
      stock = stockNum;
    }
  }

  // ---- listingType ----
  const listingTypeRaw = (raw.listingType ?? "").trim().toLowerCase();
  const listingType: ListingType = (LISTING_TYPES.includes(listingTypeRaw as ListingType)
    ? listingTypeRaw
    : "purchasable") as ListingType;

  // ---- isActive ----
  const isActive = parseBool(raw.isActive ?? "", true);


  // ---- images (optional) ----
  const images: Array<{ url: string; publicId: string; alt: string }> = [];
  const imageUrl = (raw.imageUrl ?? "").trim();
  const imagePublicId = (raw.imagePublicId ?? "").trim();
  if (imageUrl || imagePublicId) {
    if (!imageUrl) errors.push("imageUrl is required when imagePublicId is provided");
    if (!imagePublicId) errors.push("imagePublicId is required when imageUrl is provided");
    if (imageUrl && imagePublicId) {
      images.push({ url: imageUrl, publicId: imagePublicId, alt: title });
    }
  }

  // ---- attributes ----
  let attributes: Record<string, unknown> = {};
  const attrRaw = (raw.attributes ?? "").trim();
  if (attrRaw) {
    const attrResult = parseAttributesCell(attrRaw);
    if (typeof attrResult === "string") {
      errors.push(`attributes: ${attrResult}`);
    } else {
      attributes = attrResult;
    }
  }

  // ---- variants ----
  const varRaw = (raw.variants ?? "").trim();
  const variantsResult = parseVariantsCell(varRaw);
  const variants = typeof variantsResult === "string" ? [] : variantsResult;
  if (typeof variantsResult === "string") {
    errors.push(`variants: ${variantsResult}`);
  }

  // Check for duplicate variant SKUs within the row
  if (variants.length > 0) {
    const skusSeen = new Set<string>();
    for (const v of variants) {
      if (skusSeen.has(v.sku)) {
        errors.push(`variants: duplicate sku '${v.sku}' within row`);
      }
      skusSeen.add(v.sku);
    }
  }

  if (errors.length > 0) {
    return { line, valid: false, errors };
  }

  // ---- Final Zod validation via CreateProductInputSchema ----
  const generatedSlug = raw.slug?.trim() ? slugify(raw.slug.trim()) : slugify(title);

  const zodInput = {
    title,
    slug: generatedSlug,
    description,
    category: categoryRaw,
    brand,
    basePrice,
    images,
    attributes,
    variants,
    listingType,
    isActive,
    ...(stock !== undefined ? { stock } : {}),
  };

  const zodResult = CreateProductInputSchema.safeParse(zodInput);
  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      errors.push(`${issue.path.join(".") || "row"}: ${issue.message}`);
    }
    return { line, valid: false, errors };
  }

  const data: ParsedRowData = {
    title,
    slug: generatedSlug,
    description,
    category: categoryRaw,
    brand,
    basePrice,
    listingType,
    isActive,
    images,
    attributes,
    variants,
    ...(stock !== undefined ? { stock } : {}),
  };

  return {
    line,
    valid: true,
    errors: [],
    data: {
      title: data.title,
      slug: data.slug,
      description: data.description,
      category: data.category,
      brand: data.brand,
      basePrice: data.basePrice,
      listingType: data.listingType,
      isActive: data.isActive,
      ...(data.stock !== undefined ? { stock: data.stock } : {}),
    },
  };
}

// ---- CSV parsing ----

function parseCsv(csv: string): RawRow[] {
  return parse<RawRow>(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: false, // Keep everything as strings — we cast manually
  });
}

// ---- Shared validation logic (preview + commit) ----

interface ValidationResult {
  rows: CsvImportRowResult[];
  validCount: number;
  invalidCount: number;
  validRows: ParsedRowData[];
}

async function validateCsvImport(csvText: string): Promise<ValidationResult> {
  const byteLength = Buffer.byteLength(csvText, "utf8");
  if (byteLength > MAX_BYTES) {
    throw new BadRequestError(`CSV exceeds the 1 MB limit (received ${byteLength} bytes)`);
  }

  let rawRows: RawRow[];
  try {
    rawRows = parseCsv(csvText);
  } catch (err) {
    throw new BadRequestError(
      `CSV parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (rawRows.length === 0) {
    throw new BadRequestError("CSV contains no data rows");
  }

  if (rawRows.length > MAX_ROWS) {
    throw new BadRequestError(
      `CSV exceeds the maximum of ${MAX_ROWS} rows (found ${rawRows.length})`,
    );
  }

  // Per-row validation
  const rowResults: CsvImportRowResult[] = rawRows.map((raw, i) => validateRow(raw, i));

  // Check for duplicate slugs within the file
  const slugsSeen = new Map<string, number>();
  for (const result of rowResults) {
    if (result.valid && result.data) {
      const s = result.data.slug;
      if (slugsSeen.has(s)) {
        result.valid = false;
        result.errors.push(
          `Duplicate slug '${s}' in file (first seen on line ${slugsSeen.get(s) ?? "?"})`,
        );
      } else {
        slugsSeen.set(s, result.line);
      }
    }
  }

  // Check for duplicate variant SKUs across the entire file
  const globalSkusSeen = new Map<string, number>();
  for (const raw of rawRows) {
    // We need the actual parsed variants to check cross-row SKU uniqueness
    const varRaw = (raw.variants ?? "").trim();
    const variantsResult = parseVariantsCell(varRaw);
    if (typeof variantsResult !== "string") {
      for (const v of variantsResult) {
        const lineIndex = rawRows.indexOf(raw);
        const line = lineIndex + 2;
        if (globalSkusSeen.has(v.sku)) {
          // Find the rowResult for this line and mark it invalid
          const rowResult = rowResults[lineIndex];
          if (rowResult) {
            rowResult.valid = false;
            rowResult.errors.push(
              `Duplicate variant sku '${v.sku}' across file (first seen on line ${globalSkusSeen.get(v.sku) ?? "?"})`,
            );
          }
        } else {
          globalSkusSeen.set(v.sku, line);
        }
      }
    }
  }

  // Check database for existing slugs (batch query — no N+1)
  const candidateSlugs = rowResults
    .filter((r) => r.valid && r.data)
    .map((r) => r.data?.slug ?? "")
    .filter(Boolean);

  if (candidateSlugs.length > 0) {
    const existingProducts = await Product.find(
      { slug: { $in: candidateSlugs } },
      { slug: 1 },
    ).lean();

    if (existingProducts.length > 0) {
      const existingSlugs = new Set(existingProducts.map((p) => p.slug));
      for (const result of rowResults) {
        if (result.valid && result.data && existingSlugs.has(result.data.slug)) {
          result.valid = false;
          result.errors.push(`Slug '${result.data.slug}' already exists in the database`);
        }
      }
    }
  }

  const validCount = rowResults.filter((r) => r.valid).length;
  const invalidCount = rowResults.filter((r) => !r.valid).length;

  // Collect valid rows for potential insertion (re-parse them from raw)
  const validRows: ParsedRowData[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const result = rowResults[i];
    if (result?.valid) {
      const raw = rawRows[i];
      if (!raw) continue;
      const title = (raw.title ?? "").trim();
      const generatedSlug = raw.slug?.trim() ? slugify(raw.slug.trim()) : slugify(title);
      const basePriceNum = Number((raw.basePrice ?? "").trim());
      const stockRaw = (raw.stock ?? "").trim();
      const stockNum = stockRaw !== "" ? Number(stockRaw) : undefined;
      const categoryRaw = (raw.category ?? "").trim().toLowerCase() as Category;
      const listingTypeRaw = (raw.listingType ?? "").trim().toLowerCase();
      const listingType: ListingType = (LISTING_TYPES.includes(listingTypeRaw as ListingType)
        ? listingTypeRaw
        : "purchasable") as ListingType;
      const isActive = parseBool(raw.isActive ?? "", true);
      const attrResult = parseAttributesCell((raw.attributes ?? "").trim());
      const attributes = typeof attrResult === "string" ? {} : attrResult;
      const varResult = parseVariantsCell((raw.variants ?? "").trim());
      const variants = typeof varResult === "string" ? [] : varResult;
      const imageUrl = (raw.imageUrl ?? "").trim();
      const imagePublicId = (raw.imagePublicId ?? "").trim();
      const images: Array<{ url: string; publicId: string; alt: string }> = [];
      if (imageUrl && imagePublicId) {
        images.push({ url: imageUrl, publicId: imagePublicId, alt: title });
      }

      const rowData: ParsedRowData = {
        title,
        slug: generatedSlug,
        description: (raw.description ?? "").trim(),
        category: categoryRaw,
        brand: (raw.brand ?? "").trim(),
        basePrice: basePriceNum,
        listingType,
        isActive,
        images,
        attributes,
        variants,
        ...(stockNum !== undefined ? { stock: stockNum } : {}),
      };
      validRows.push(rowData);
    }
  }

  return { rows: rowResults, validCount, invalidCount, validRows };
}

// ---- Controller: Preview ----

/**
 * POST /api/v1/admin/products/import/preview
 * Validates the CSV without writing anything to the database.
 */
export async function adminImportPreview(req: Request, res: Response): Promise<void> {
  const { csv } = req.body as { csv: string };

  const { rows, validCount, invalidCount } = await validateCsvImport(csv);

  res.status(200).json({ rows, validCount, invalidCount });
}

// ---- Controller: Commit ----

/**
 * POST /api/v1/admin/products/import/commit
 * Re-validates server-side, then insertMany with ordered:true only if ALL rows are valid.
 */
export async function adminImportCommit(req: Request, res: Response): Promise<void> {
  const { csv } = req.body as { csv: string };

  const { rows, validCount, invalidCount, validRows } = await validateCsvImport(csv);

  if (invalidCount > 0) {
    throw new BadRequestError("Import aborted: one or more rows are invalid", {
      rows,
      validCount,
      invalidCount,
    });
  }

  if (validCount === 0) {
    throw new BadRequestError("No valid rows to import");
  }

  let importedCount = 0;
  try {
    const docs = validRows.map((row) => ({
      title: row.title,
      slug: row.slug,
      description: row.description,
      category: row.category,
      brand: row.brand,
      basePrice: row.basePrice,
      images: row.images,
      attributes: row.attributes,
      variants: row.variants,
      listingType: row.listingType,
      isActive: row.isActive,
      ...(row.stock !== undefined ? { stock: row.stock } : {}),
    }));

    const result = await Product.insertMany(docs, { ordered: true });
    importedCount = result.length;
  } catch (err) {
    // Try to surface the slug that failed
    if (
      err instanceof Error &&
      "writeErrors" in err &&
      Array.isArray((err as Record<string, unknown>)["writeErrors"])
    ) {
      const writeErrors = (err as Record<string, unknown>)["writeErrors"] as Array<
        Record<string, unknown>
      >;
      const firstErr = writeErrors[0];
      const keyValue =
        firstErr &&
        typeof firstErr["err"] === "object" &&
        firstErr["err"] !== null &&
        "keyValue" in (firstErr["err"] as Record<string, unknown>)
          ? (firstErr["err"] as Record<string, unknown>)["keyValue"]
          : undefined;
      throw new BadRequestError(
        `Database insert failed${keyValue ? ` (duplicate key: ${JSON.stringify(keyValue)})` : ""}`,
      );
    }
    throw new BadRequestError(
      `Database insert failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Audit log
  await createAuditLog({
    actor: req.user?.id ?? "admin",
    action: "PRODUCT_CSV_IMPORT",
    targetType: "Product",
    meta: { importedCount, slugs: validRows.map((r) => r.slug) },
  });

  // On-demand revalidation — ignore failures
  const paths = new Set<string>(["/"]);
  for (const row of validRows) {
    paths.add(`/category/${row.category}`);
    paths.add(`/product/${row.slug}`);
  }
  void triggerRevalidation(Array.from(paths)).catch(() => undefined);

  res.status(200).json({
    imported: importedCount,
    message: `Successfully imported ${importedCount} product${importedCount === 1 ? "" : "s"}`,
  });
}
