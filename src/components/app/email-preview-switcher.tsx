"use client";

import { useState } from "react";
import { Globe, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailPreviewCard, type PreviewCampaign, type PreviewStore, type PreviewSender } from "@/components/app/email-preview-card";
import { LANGUAGES } from "@/lib/languages";

// Renders an EmailPreviewCard with a tab strip on top to flip between languages and a
// desktop/mobile toggle. Used in /campaigns/[id] and could replace the static preview
// in /approvals later.

export function EmailPreviewSwitcher({
  campaign,
  store,
  sender,
  availableLanguages,
}: {
  campaign: PreviewCampaign;
  store: PreviewStore;
  sender: PreviewSender;
  availableLanguages: string[];   // BCP-47 codes that have variants in DB
}) {
  const [activeLang, setActiveLang] = useState(availableLanguages[0] ?? store.defaultLanguage);
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {availableLanguages.slice(0, 12).map((code) => {
            const lang = LANGUAGES.find((l) => l.code === code);
            const isActive = code === activeLang;
            return (
              <button
                key={code}
                onClick={() => setActiveLang(code)}
                title={lang?.label ?? code}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] transition-colors ${
                  isActive
                    ? "bg-[color:var(--accent)] text-[color:var(--accent-fg)] font-medium"
                    : "bg-card border border-border hover:bg-secondary/60 text-foreground"
                }`}
              >
                <span className="text-sm leading-none">{lang?.flag ?? "🏳️"}</span>
                <span className="hidden sm:inline">{lang?.code ?? code}</span>
              </button>
            );
          })}
          {availableLanguages.length > 12 && (
            <span className="text-[11px] text-muted-foreground ml-2">
              +{availableLanguages.length - 12} más
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("mobile")}>
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("desktop")}>
            <Monitor className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <EmailPreviewCard
          campaign={campaign}
          store={store}
          sender={sender}
          language={activeLang}
          width={device === "desktop" ? 600 : 380}
        />
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
        <Globe className="h-3 w-3" />
        Previsualización en <strong className="text-foreground">{LANGUAGES.find((l) => l.code === activeLang)?.label ?? activeLang}</strong>
        · usando datos del store {store.legal.legalName}
      </div>
    </div>
  );
}
