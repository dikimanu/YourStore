"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { SalesByDayItem } from "@yourstore/shared";

interface SalesChartProps {
  data: SalesByDayItem[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const revenue = payload[0]?.value ?? 0;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg shadow-md text-sm">
        <p className="font-semibold text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-blue-600 dark:text-blue-400 font-medium">
          Revenue: ₹{revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
}

export default function SalesChart({ data }: SalesChartProps) {
  const formattedData = data.map((d) => ({
    ...d,
    formattedDate: d.date.slice(5), // MM-DD
  }));

  return (
    <div
      role="region"
      aria-label="Sales and Revenue Over Time Chart"
      className="w-full h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formattedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-gray-500 dark:text-gray-400"
          />
          <YAxis
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-gray-500 dark:text-gray-400"
            tickFormatter={(val: number) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#2563eb"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#salesGradient)"
            name="Revenue"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
