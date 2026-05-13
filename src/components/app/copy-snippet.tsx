"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopySnippet({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked in iframes — select text as fallback
      const ta = document.createElement("textarea");
      ta.value = code; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); ta.remove();
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="rounded-md border border-border bg-[color:var(--bg)] relative group">
      <pre className={`text-[12px] font-mono p-3 overflow-x-auto leading-relaxed whitespace-pre`}>
        {lang && <span className="text-[11px] text-muted-foreground select-none">{lang}\n</span>}
        {code}
      </pre>
      <Button
        type="button"
        size="sm"
        variant={copied ? "default" : "outline"}
        className="absolute top-2 right-2 h-6 px-2 text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copy}
      >
        {copied ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
      </Button>
    </div>
  );
}
