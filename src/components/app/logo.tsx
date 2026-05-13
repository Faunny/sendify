import { cn } from "@/lib/utils";

// Two logos live here:
// - Logo: the Sendify platform wordmark (used in sidebar, login, 404). Stays as-is.
// - DivainWordmark: a faithful `divain.` mark for email previews. Used inside the builder
//   canvas, the campaign detail preview, and anywhere we render an inbox-like preview of a
//   Divain email. Drives the brand consistency the user asked for in real campaigns.

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_6px_rgb(0_0_0/0.25)]"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5l9 7 9-7" />
          <path d="M3 5h18v14H3z" />
        </svg>
      </span>
      {!compact && (
        <span className="brand-wordmark text-[15px] text-foreground">
          sendify<span className="text-foreground">.</span>
        </span>
      )}
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
