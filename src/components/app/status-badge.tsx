import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "default" | "muted" | "outline" | "accent" | "positive" | "warning" | "danger" }> = {
  DRAFT:             { label: "Draft",             variant: "muted" },
  PENDING_APPROVAL:  { label: "Pending approval",  variant: "warning" },
  APPROVED:          { label: "Approved",          variant: "accent" },
  SCHEDULED:         { label: "Scheduled",         variant: "accent" },
  SENDING:           { label: "Sending",           variant: "accent" },
  SENT:              { label: "Sent",              variant: "positive" },
  PAUSED:            { label: "Paused",            variant: "muted" },
  CANCELLED:         { label: "Cancelled",         variant: "muted" },
  FAILED:            { label: "Failed",            variant: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
