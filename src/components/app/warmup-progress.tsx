import { Flame, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { curvePoints, dailySendCap, warmupCompletionDate, warmupStage, WARMUP_DAYS, type WarmupSender } from "@/lib/warmup";
import { formatNumber } from "@/lib/utils";

// Inline visual of where a sender is in its 14-day warm-up curve.
// Used in Settings → Senders. Each bar is one day; the active day pulses.

export function WarmupProgress({ sender }: { sender: WarmupSender }) {
  const stage = warmupStage(sender);
  const cap = dailySendCap(sender);
  const completion = warmupCompletionDate(sender);
  const points = curvePoints(sender.warmupTargetPerDay, sender.dailyCap);
  const maxY = Math.max(...points.map((p) => p.limit));

  if (stage === "warmed") {
    return (
      <div className="rounded-md border border-border bg-card/40 p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <Check className="h-3 w-3 text-[color:var(--positive)]" />
          <span className="font-medium">Fully warmed</span>
          <span className="text-muted-foreground">· today's limit {formatNumber(cap)}</span>
        </div>
        <Badge variant="positive">100%</Badge>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[color:var(--accent)]/30 bg-[color-mix(in_oklch,var(--accent)_5%,transparent)] p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[11px]">
          <Flame className="h-3 w-3 text-[color:var(--accent)]" />
          <span className="font-medium">Warming up</span>
          <span className="text-muted-foreground">
            · day {stage} / {WARMUP_DAYS} · today's limit <span className="text-foreground tabular-nums">{formatNumber(cap)}</span>
          </span>
        </div>
        <Badge variant="accent">{Math.round((Number(stage) / WARMUP_DAYS) * 100)}%</Badge>
      </div>

      {/* mini bar chart: 14 bars, one per day, height proportional to that day's limit */}
      <div className="flex items-end gap-[2px] h-10">
        {points.map((p) => {
          const heightPct = (p.limit / maxY) * 100;
          const isCurrent = p.day === stage;
          const isPast = p.day < (typeof stage === "number" ? stage : WARMUP_DAYS);
          return (
            <div key={p.day} className="flex-1 relative group">
              <div
                className={`w-full rounded-sm transition-all ${
                  isCurrent
                    ? "bg-[color:var(--accent)] animate-pulse"
                    : isPast
                    ? "bg-[color:var(--accent)]/70"
                    : "bg-[color:var(--accent)]/20"
                }`}
                style={{ height: `${heightPct}%`, minHeight: "2px" }}
                title={`Day ${p.day}: ${formatNumber(p.limit)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Day 1</span>
        <span>
          {completion && `Fully warmed ${completion.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`}
        </span>
        <span>Day {WARMUP_DAYS}</span>
      </div>
    </div>
  );
}
