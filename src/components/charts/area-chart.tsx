"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function SendsAreaChart({ data }: { data: { day: string; sent: number; delivered: number; opened: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gOpened" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n)} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 12, padding: "8px 10px" }}
          formatter={(v: number) => v.toLocaleString()}
        />
        <Area type="monotone" dataKey="sent" stroke="var(--chart-1)" strokeWidth={1.6} fill="url(#gSent)" />
        <Area type="monotone" dataKey="opened" stroke="var(--chart-3)" strokeWidth={1.6} fill="url(#gOpened)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
