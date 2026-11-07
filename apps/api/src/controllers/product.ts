import { Request, Response } from "express";
import {
  ProductQuery,
  CreateProductInput,
  UpdateProductInput,
} from "@yourstore/shared";
import { Product } from "../models/Product.js";
import { NotFoundError, ConflictError } from "../lib/errors.js";
import { createAuditLog } from "../lib/auditLog.js";
import { triggerRevalidation } from "../lib/revalidate.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------- Public Endpoints ----------------

/**
 * Public: List products with filters, sorting, text search, and pagination.
 * Always filters by isActive = true and uses .lean() for performance.
 */
export async function listProducts(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ProductQuery;
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  // Build filter object
  const filter: Record<string, unknown> = { isActive: true };

  if (query.category) {
    filter["category"] = query.category;
  }

  if (query.brand) {
    filter["brand"] = query.brand;
  }

  if (query.listingType) {
    filter["listingType"] = query.listingType;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (query.minPrice !== undefined) priceFilter["$gte"] = query.minPrice;
    if (query.maxPrice !== undefined) priceFilter["$lte"] = query.maxPrice;
    filter["basePrice"] = priceFilter;
  }

  if (query.inStock === "true") {
    filter["$or"] = [
      { stock: { $gt: 0 } },
      { "variants.stock": { $gt: 0 } },
    ];
  } else if (query.inStock === "false") {
    filter["stock"] = { $lte: 0 };
    filter["variants.stock"] = { $lte: 0 };
  }

  if (query.search) {
    filter["$text"] = { $search: query.search };
  }

  // Determine sort order
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  switch (query.sort) {
    case "price_asc":
      sortOption = { basePrice: 1 };
      break;
    case "price_desc":
      sortOption = { basePrice: -1 };
      break;
    case "rating":
      sortOption = { ratingAvg: -1, ratingCount: -1 };
      break;
    case "title_asc":
      sortOption = { title: 1 };
      break;
    case "newest":
    default:
      sortOption = { createdAt: -1 };
      break;
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    products: products.map((p) => {
      const doc = p as unknown as Record<string, unknown>;
      doc["id"] = doc["_id"]?.toString();
      delete doc["_id"];
      delete doc["__v"];
      return doc;
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

/**
 * Public: Get product detail by unique slug.
 */
export async function getProductBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  const product = await Product.findOne({ slug: slug?.toLowerCase(), isActive: true }).lean();
  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const doc = product as unknown as Record<string, unknown>;
  doc["id"] = doc["_id"]?.toString();
  delete doc["_id"];
  delete doc["__v"];

  res.status(200).json({ product: doc });
}

/**
 * Public: Instant debounced search suggestions.
 * Returns up to 6 matching active products with title, slug, and thumbnail.
 */
export async function getProductSuggestions(req: Request, res: Response): Promise<void> {
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  if (!q || q.length < 2) {
    res.status(200).json({ suggestions: [] });
    return;
  }

  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const suggestions = await Product.find(
    {
      isActive: true,
      $or: [{ title: regex }, { brand: regex }],
    },
    { title: 1, slug: 1, basePrice: 1, brand: 1, category: 1, images: { $slice: 1 } },
  )
    .limit(6)
    .lean();

  res.status(200).json({
    suggestions: suggestions.map((p) => {
      const doc = p as unknown as Record<string, unknown>;
      doc["id"] = doc["_id"]?.toString();
      delete doc["_id"];
      return doc;
    }),
  });
}

/**
 * Public: Related products based on category, excluding current product.
 */
export async function getRelatedProducts(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const current = await Product.findById(id).lean();
  if (!current) {
    throw new NotFoundError("Product not found");
  }

  const related = await Product.find({
    category: current.category,
    _id: { $ne: current._id },
    isActive: true,
  })
    .sort({ ratingAvg: -1, createdAt: -1 })
    .limit(4)
    .lean();

  res.status(200).json({
    products: related.map((p) => {
      const doc = p as unknown as Record<string, unknown>;
      doc["id"] = doc["_id"]?.toString();
      delete doc["_id"];
      delete doc["__v"];
      return doc;
    }),
  });
}

// ---------------- Admin Endpoints ----------------

/**
 * Admin: List all products including inactive ones with pagination and filter support.
 */
export async function adminListProducts(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ProductQuery;
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (query.category) filter["category"] = query.category;
  if (query.brand) filter["brand"] = query.brand;
  if (query.search) {
    const regex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter["$or"] = [{ title: regex }, { brand: regex }];
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    products: products.map((p) => {
      const doc = p as unknown as Record<string, unknown>;
      doc["id"] = doc["_id"]?.toString();
      delete doc["_id"];
      delete doc["__v"];
      return doc;
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

/**
 * Admin: Create a new product.
 */
export async function adminCreateProduct(req: Request, res: Response): Promise<void> {
  const data = req.body as CreateProductInput;

  const generatedSlug = data.slug ? slugify(data.slug) : slugify(data.title);

  // Check unique slug
  const existingSlug = await Product.findOne({ slug: generatedSlug });
  if (existingSlug) {
    throw new ConflictError(`Product with slug '${generatedSlug}' already exists.`);
  }

  const product = new Product({
    ...data,
    slug: generatedSlug,
  });

  await product.save();

  await createAuditLog({
    actor: req.user?.id || "admin",
    action: "PRODUCT_CREATE",
    targetType: "Product",
    targetId: product._id.toString(),
    meta: { title: product.title, category: product.category, slug: product.slug },
  });

  // Trigger on-demand revalidation in the web app
  void triggerRevalidation([
    "/",
    `/category/${product.category}`,
    `/product/${product.slug}`,
  ]);

  res.status(201).json({ product: product.toJSON() });
}

/**
 * Admin: Update an existing product.
 */
export async function adminUpdateProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const data = req.body as UpdateProductInput;

  const product = await Product.findById(id);
  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const previousSlug = product.slug;
  const previousCategory = product.category;

  if (data.slug) {
    const newSlug = slugify(data.slug);
    if (newSlug !== product.slug) {
      const existing = await Product.findOne({ slug: newSlug, _id: { $ne: product._id } });
      if (existing) {
        throw new ConflictError(`Slug '${newSlug}' is already taken.`);
      }
      product.slug = newSlug;
    }
  }

  if (data.title !== undefined) product.title = data.title;
  if (data.description !== undefined) product.description = data.description;
  if (data.category !== undefined) product.category = data.category;
  if (data.brand !== undefined) product.brand = data.brand;
  if (data.basePrice !== undefined) product.basePrice = data.basePrice;
  if (data.images !== undefined) product.images = data.images;
  if (data.attributes !== undefined) product.attributes = data.attributes;
  if (data.variants !== undefined) product.variants = data.variants;
  if (data.stock !== undefined) product.stock = data.stock;
  if (data.listingType !== undefined) product.listingType = data.listingType;
  if (data.isActive !== undefined) product.isActive = data.isActive;

  await product.save();

  await createAuditLog({
    actor: req.user?.id || "admin",
    action: "PRODUCT_UPDATE",
    targetType: "Product",
    targetId: product._id.toString(),
    meta: { title: product.title, category: product.category },
  });

  // Trigger on-demand revalidation in the web app
  const revalPaths = new Set<string>([
    "/",
    `/category/${product.category}`,
    `/category/${previousCategory}`,
    `/product/${product.slug}`,
  ]);
  if (previousSlug !== product.slug) {
    revalPaths.add(`/product/${previousSlug}`);
  }
  void triggerRevalidation(Array.from(revalPaths));

  res.status(200).json({ product: product.toJSON() });
}

/**
 * Admin: Soft delete product (isActive = false) per Brief Section 7.
 */
export async function adminDeleteProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new NotFoundError("Product not found");
  }

  // Soft delete
  product.isActive = false;
  await product.save();

  await createAuditLog({
    actor: req.user?.id || "admin",
    action: "PRODUCT_SOFT_DELETE",
    targetType: "Product",
    targetId: product._id.toString(),
    meta: { title: product.title, slug: product.slug },
  });

  // Trigger on-demand revalidation in the web app
  void triggerRevalidation([
    "/",
    `/category/${product.category}`,
    `/product/${product.slug}`,
  ]);

  res.status(200).json({
    success: true,
    message: "Product soft deleted successfully",
    product: product.toJSON(),
  });
}

