import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Reusable empty-state used wherever a list/table has zero rows.
// Renders an icon, a clear "what's missing" headline, a short explanation of how the data
// gets in, and one or two CTAs that take the user to the right place to unblock it.

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = "card",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryAction?: { label: string; href?: string; onClick?: () => void; external?: boolean };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  variant?: "card" | "inline";
}) {
  const body = (
    <div className="flex flex-col items-center text-center px-6 py-10">
      {icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-[16px] font-medium tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 text-[14px] text-muted-foreground max-w-md leading-relaxed">{description}</p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex items-center gap-2 flex-wrap justify-center">
          {primaryAction && (
            primaryAction.href ? (
              <Button size="sm" asChild>
                <Link href={primaryAction.href} target={primaryAction.external ? "_blank" : undefined}>{primaryAction.label}</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={primaryAction.onClick}>{primaryAction.label}</Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>
            )
          )}
        </div>
      )}
    </div>
  );

  if (variant === "inline") return body;
  return <Card className={cn("overflow-hidden")}>{body}</Card>;
}
