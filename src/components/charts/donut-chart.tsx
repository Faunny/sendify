"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export function CostDonut({ data }: { data: { name: string; value: number }[] }) {
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12, padding: "8px 10px" }}
            formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
          />
          <Pie data={data} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={1} stroke="none">
            {data.map((d, i) => (
              <Cell key={d.name} fill={palette[i % palette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">May spend</div>
          <div className="text-xl font-medium tracking-tight">${total.toFixed(0)}</div>
        </div>
      </div>
    </div>
  );
}
