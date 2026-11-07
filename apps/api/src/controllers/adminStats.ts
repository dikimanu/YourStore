import { Request, Response } from "express";
import { ORDER_STATUSES, OrderStatus, AdminStatsResponse } from "@yourstore/shared";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

const QUALIFYING_STATUSES: OrderStatus[] = [
  "Placed",
  "Processing",
  "Dispatched",
  "OutForDelivery",
  "Delivered",
];

export async function getAdminStats(req: Request, res: Response): Promise<void> {
  const days = (req.query as unknown as { days: 7 | 30 | 90 }).days ?? 30;

  // We want range over the past `days` days up to current moment.
  // Using Asia/Kolkata (UTC + 5 hours 30 minutes)
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 1. salesByDay aggregation
  // Filter: createdAt >= startDate, status in QUALIFYING_STATUSES
  const salesByDayAgg = await Order.aggregate<{
    _id: string;
    revenue: number;
    orders: number;
  }>([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $in: QUALIFYING_STATUSES },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Kolkata",
          },
        },
        revenue: { $sum: "$pricing.total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const salesMap = new Map<string, { revenue: number; orders: number }>();
  for (const item of salesByDayAgg) {
    salesMap.set(item._id, {
      revenue: Math.round(item.revenue * 100) / 100,
      orders: item.orders,
    });
  }

  // Generate zero-filled days for the range (days days including today in Asia/Kolkata)
  const kolkataDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const salesByDay: { date: string; revenue: number; orders: number }[] = [];
  // From (days - 1) days ago to today (0 days ago)
  for (let i = days - 1; i >= 0; i--) {
    const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = kolkataDateFormatter.format(targetDate);
    const existing = salesMap.get(dateStr);
    salesByDay.push({
      date: dateStr,
      revenue: existing ? existing.revenue : 0,
      orders: existing ? existing.orders : 0,
    });
  }

  // 2. orderCounts: count per status (all statuses, zero if none)
  const orderCountsAgg = await Order.aggregate<{
    _id: OrderStatus;
    count: number;
  }>([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const orderCountsMap = new Map<string, number>();
  for (const item of orderCountsAgg) {
    orderCountsMap.set(item._id, item.count);
  }

  const orderCounts = {} as Record<OrderStatus, number>;
  for (const status of ORDER_STATUSES) {
    orderCounts[status] = orderCountsMap.get(status) ?? 0;
  }

  // 3. totals: revenue, orders, averageOrderValue for the range
  const totalsAgg = await Order.aggregate<{
    _id: null;
    revenue: number;
    orders: number;
  }>([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $in: QUALIFYING_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$pricing.total" },
        orders: { $sum: 1 },
      },
    },
  ]);

  let totalRevenue = 0;
  let totalOrders = 0;
  if (totalsAgg.length > 0 && totalsAgg[0]) {
    totalRevenue = Math.round(totalsAgg[0].revenue * 100) / 100;
    totalOrders = totalsAgg[0].orders;
  }
  const averageOrderValue =
    totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

  const totals = {
    revenue: totalRevenue,
    orders: totalOrders,
    averageOrderValue,
  };

  // 4. topProducts: top 5 by units sold in the range (productId, title, units, revenue), from order item snapshots
  const topProductsAgg = await Order.aggregate<{
    _id: string;
    title: string;
    units: number;
    revenue: number;
  }>([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $in: QUALIFYING_STATUSES },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: { $toString: "$items.productId" },
        title: { $first: "$items.title" },
        units: { $sum: "$items.qty" },
        revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.qty"] } },
      },
    },
    { $sort: { units: -1, revenue: -1 } },
    { $limit: 5 },
  ]);

  const topProducts = topProductsAgg.map((item) => ({
    productId: item._id,
    title: item.title,
    units: item.units,
    revenue: Math.round(item.revenue * 100) / 100,
  }));

  // 5. lowStock: active purchasable products with stock <= 5 (for variant products, any variant with stock <= 5), max 20, lean, sorted by lowest stock.
  // Return productId, title, slug, sku (if variant) and stock.
  interface LeanProduct {
    _id: unknown;
    title: string;
    slug: string;
    stock?: number;
    variants?: { sku: string; stock: number }[];
  }

  const lowStockCandidates = await Product.find({
    isActive: true,
    listingType: "purchasable",
    $or: [
      { variants: { $size: 0 }, stock: { $lte: 5 } },
      { "variants.stock": { $lte: 5 } },
    ],
  })
    .select("_id title slug stock variants")
    .lean<LeanProduct[]>();

  interface FlatLowStockItem {
    productId: string;
    title: string;
    slug: string;
    sku?: string;
    stock: number;
  }

  const flattenedLowStock: FlatLowStockItem[] = [];

  for (const product of lowStockCandidates) {
    const pid = String(product._id);
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (typeof variant.stock === "number" && variant.stock <= 5) {
          flattenedLowStock.push({
            productId: pid,
            title: product.title,
            slug: product.slug,
            sku: variant.sku,
            stock: variant.stock,
          });
        }
      }
    } else if (typeof product.stock === "number" && product.stock <= 5) {
      flattenedLowStock.push({
        productId: pid,
        title: product.title,
        slug: product.slug,
        stock: product.stock,
      });
    }
  }

  flattenedLowStock.sort((a, b) => a.stock - b.stock);
  const lowStock = flattenedLowStock.slice(0, 20);

  const responsePayload: AdminStatsResponse = {
    salesByDay,
    orderCounts,
    totals,
    topProducts,
    lowStock,
  };

  res.status(200).json(responsePayload);
}
