"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

export function LangBars({ data }: { data: { language: string; pct: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: -8, bottom: 0 }}>
        <XAxis type="number" domain={[0, 0.4]} hide />
        <YAxis dataKey="language" type="category" tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 12, padding: "8px 10px" }}
          formatter={(v: number) => `${(v * 100).toFixed(1)}%`}
        />
        <Bar dataKey="pct" radius={[3, 3, 3, 3]} barSize={10}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? "var(--chart-1)" : `color-mix(in oklch, var(--chart-1) ${Math.max(20, 90 - i * 10)}%, transparent)`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
