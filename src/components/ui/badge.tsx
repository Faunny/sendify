import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border bg-transparent text-foreground",
        accent: "border-transparent bg-[color-mix(in_oklch,var(--accent)_18%,transparent)] text-[color:var(--accent)]",
        positive: "border-transparent bg-[color-mix(in_oklch,var(--positive)_18%,transparent)] text-[color:var(--positive)]",
        warning: "border-transparent bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-[color:var(--warning)]",
        danger: "border-transparent bg-[color-mix(in_oklch,var(--danger)_18%,transparent)] text-[color:var(--danger)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
