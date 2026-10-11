"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUsd } from "@/lib/format";
import type { HistoryPoint } from "@/lib/types";

export default function PerformanceChart({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-400">
        Hyperliquid did not return enough account-value history to chart.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value: number) =>
              new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(value: number) => formatUsd(value, 0)}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            cursor={{ stroke: "rgba(16,185,129,0.35)" }}
            contentStyle={{
              background: "#12181f",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(label) =>
              new Date(Number(label)).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            formatter={(value) => [formatUsd(Number(value)), "Account value"]}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#equityFill)"
            dot={false}
            activeDot={{ r: 4, fill: "#10B981" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
