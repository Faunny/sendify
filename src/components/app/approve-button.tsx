"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

// Approves a campaign by hitting POST /api/campaigns/[id]/approve. Shows inline status
// (loading → ok / error) so the reviewer gets immediate feedback. On success it triggers
// a router.refresh() so the page re-reads the campaign (now in SENDING state) and the
// SendingMonitor takes over.

export function ApproveButton({
  campaignId,
  targetLanguages,
  label = "Approve & schedule",
}: {
  campaignId: string;
  targetLanguages: string[];
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLanguages }),
        });
        const json = await res.json();
        if (!json.ok && res.status !== 202) throw new Error(json.error ?? "approve failed");
        setDone(true);
        // 202 = approved + rendered but queue offline (dev mode). UI still flips.
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "approve failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <Button size="sm" onClick={onClick} disabled={pending || done}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
        {pending ? "Approving…" : done ? "Approved" : label}
      </Button>
      {error && <span className="mt-1 text-[11px] text-[color:var(--danger)]">{error}</span>}
    </div>
  );
}
