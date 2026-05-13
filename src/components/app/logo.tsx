import { cn } from "@/lib/utils";

// Platform brand mark. Sendify lives inside Divain — the operator owns Divain
// Parfums and built this tool for herself — so the visible identity is the
// divain. wordmark, with a tiny "sendify" tag underneath to remind which app
// you're in. The standalone DivainWordmark below is used inside inbox-style
// previews where we render real emails.

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div className="flex flex-col leading-none">
        <DivainWordmark size={20} className="-mb-0.5" />
        {!compact && (
          <span className="text-[8.5px] uppercase tracking-[3px] text-muted-foreground/80 mt-1.5">
            email · sendify
          </span>
        )}
      </div>
    </div>
  );
}

// The real divain. brand wordmark — lowercase, terminal dot in primary color.
// `dotColor` defaults to current text color so it inherits naturally.
export function DivainWordmark({
  size = 24,
  color = "currentColor",
  dotColor,
  className,
}: {
  size?: number;
  color?: string;
  dotColor?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-baseline leading-none select-none", className)}
      style={{
        fontFamily: "'Outfit', 'futura-pt', Helvetica, Arial, sans-serif",
        fontWeight: 700,
        fontSize: size,
        color,
        letterSpacing: "-0.02em",
      }}
    >
      divain<span style={{ color: dotColor ?? color }}>.</span>
    </span>
  );
}
