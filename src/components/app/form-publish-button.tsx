"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormPublishButton({ formId, currentStatus }: { formId: string; currentStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const next = currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      const res = await fetch(`/api/forms/${formId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" onClick={toggle} disabled={busy} variant={currentStatus === "PUBLISHED" ? "outline" : "default"}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
        currentStatus === "PUBLISHED" ? <EyeOff className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
      {currentStatus === "PUBLISHED" ? "Despublicar" : "Publicar"}
    </Button>
  );
}
