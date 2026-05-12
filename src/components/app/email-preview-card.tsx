// Reusable Divain-styled email preview card.
//
// Renders a compact inbox-like preview of a campaign email — used in /approvals so the
// reviewer SEES what they're about to approve, not just metadata. Same visual language
// as the real outgoing emails: divain. wordmark, big-number hero, gold pill CTA, brand
// pillars bar, gold footer with legal entity.
//
// Accepts a shape that's a strict subset of both Prisma's Campaign and the old mock
// type — same render works whether the data comes from the DB or local mock.

import { DivainWordmark } from "@/components/app/logo";
import { BRAND_PILLARS } from "@/lib/mock";

export type PreviewCampaign = {
  subject: string;
  name?: string;
  estimatedRecipients?: number;
};

export type PreviewStore = {
  defaultLanguage: string;
  countryCode: string;
  legal: {
    legalName: string;
    vatNumber: string;
    address: string;
    postalCode: string;
    city: string;
  };
};

export type PreviewSender = {
  fromName: string;
  fromEmail: string;
};

export type PreviewProduct = {
  id?: string;
  imageUrl?: string | null;
};

export type EmailPreviewProps = {
  campaign: PreviewCampaign;
  store: PreviewStore;
  sender: PreviewSender;
  language?: string;        // BCP-47 — defaults to store.defaultLanguage
  market?: string;          // ISO-3166-1 — defaults to store.countryCode
  products?: PreviewProduct[];
  width?: number;
};

const HERO_BY_LANG: Record<string, { offer: string; sub: string; tagline: string; cta: string; body: string; footer: string }> = {
  "es-ES": { offer: "11,99€",  sub: "TODOS LOS PERFUMES A",     tagline: "Selección Día de la Madre",      cta: "COMPRAR AHORA",       body: "Una selección curada para regalar este Día de la Madre. 100ml. Larga duración.",            footer: "¿No quieres recibir más emails? Darse de baja." },
  "es-MX": { offer: "$249",     sub: "TODOS LOS PERFUMES A",     tagline: "Día de las Madres",              cta: "COMPRAR AHORA",       body: "Una selección curada para regalar este Día de las Madres. 100ml. Larga duración.",          footer: "¿No deseas recibir más correos? Darse de baja." },
  "en-GB": { offer: "£11.99",  sub: "ALL PERFUMES AT",          tagline: "Mother's Day edit",               cta: "SHOP NOW",            body: "A curated edit for Mother's Day. 100ml. Long-lasting.",                                      footer: "Don't want these emails? Unsubscribe." },
  "en-US": { offer: "$14.99",  sub: "ALL PERFUMES AT",          tagline: "Mother's Day edit",               cta: "SHOP NOW",            body: "A curated edit for Mother's Day. 3.4 fl oz. Long-lasting.",                                   footer: "Don't want these emails? Unsubscribe." },
  "fr-FR": { offer: "11,99€",  sub: "TOUS LES PARFUMS À",       tagline: "Sélection Fête des Mères",       cta: "ACHETER MAINTENANT",  body: "Une sélection pensée pour la Fête des Mères. 100ml. Longue tenue.",                          footer: "Vous ne souhaitez plus recevoir d'e-mails ? Se désabonner." },
  "de-DE": { offer: "11,99€",  sub: "ALLE PARFÜMS FÜR",         tagline: "Muttertag · ausgewählte",        cta: "JETZT KAUFEN",        body: "Eine handverlesene Auswahl zum Muttertag. 100ml. Lang anhaltend.",                            footer: "Keine E-Mails mehr erhalten? Abmelden." },
  "it-IT": { offer: "11,99€",  sub: "TUTTI I PROFUMI A",        tagline: "Festa della Mamma",              cta: "ACQUISTA ORA",        body: "Una selezione pensata per la Festa della Mamma. 100ml. Lunga durata.",                        footer: "Non vuoi più ricevere e-mail? Annulla l'iscrizione." },
  "pt-PT": { offer: "11,99€",  sub: "TODOS OS PERFUMES A",      tagline: "Dia da Mãe",                      cta: "COMPRAR AGORA",       body: "Uma seleção pensada para o Dia da Mãe. 100ml. Longa duração.",                                 footer: "Não queres receber mais e-mails? Cancelar subscrição." },
};

export function EmailPreviewCard({ campaign, store, sender, language, products = [], width = 380 }: EmailPreviewProps) {
  const lang = language ?? store.defaultLanguage;
  const copy = HERO_BY_LANG[lang] ?? HERO_BY_LANG["es-ES"];

  // Heuristic: campaigns with a number in the subject get the yellow price-led look;
  // everything else gets the warm rose/sunset gradient.
  const isPriceLed = /\d/.test(campaign.subject);
  const heroBg = isPriceLed ? "#F0C95C" : "linear-gradient(180deg, #FFD3B6 0%, #C98E8B 60%, #8B5E4F 100%)";
  const ctaBg = isPriceLed ? "#000000" : "#D99425";

  return (
    <div className="rounded-md border border-border overflow-hidden shadow-2xl bg-white" style={{ width, maxWidth: "100%" }}>
      {/* Inbox chrome */}
      <div className="px-3 py-2 bg-[#F5F5F7] border-b border-border flex items-center gap-2">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[color:var(--danger)]/40" />
          <span className="h-2 w-2 rounded-full bg-[color:var(--warning)]/40" />
          <span className="h-2 w-2 rounded-full bg-[color:var(--positive)]/40" />
        </div>
        <span className="text-[9px] text-black/40 ml-1">Inbox</span>
      </div>

      {/* From + subject */}
      <div className="px-4 py-2.5 border-b border-[#eee] flex items-start gap-2.5 bg-white">
        <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--gold-700)] grid place-items-center text-[9px] text-[var(--accent-fg)] font-bold">DP</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-black/60 truncate">{sender.fromName} &lt;{sender.fromEmail}&gt;</div>
          <div className="text-[11px] font-medium text-black mt-0.5 truncate">{campaign.subject}</div>
        </div>
      </div>

      {/* divain. wordmark */}
      <div className="px-4 py-3.5 grid place-items-center bg-white">
        <DivainWordmark size={18} color="#000000" dotColor="#000000" />
      </div>

      {/* Big number hero */}
      <div className="px-4 pt-5 pb-7 text-center relative overflow-hidden" style={{ background: heroBg, color: "#FFFFFF" }}>
        <div className="text-[11px] font-medium uppercase tracking-[3px] mb-1.5" style={{ fontFamily: "Outfit, sans-serif" }}>
          {copy.sub}
        </div>
        <div className="text-[44px] leading-none font-bold mb-2.5" style={{ fontFamily: "Outfit, sans-serif", letterSpacing: "-0.02em" }}>
          {copy.offer}
        </div>
        <div className="text-[12px] mb-4 opacity-90" style={{ fontFamily: "Outfit, sans-serif" }}>
          {copy.tagline}
        </div>
        <span className="inline-block px-6 py-2 text-[10px] uppercase tracking-[1px] font-medium" style={{ background: ctaBg, color: "#FFFFFF", borderRadius: 40, fontFamily: "Inter, sans-serif" }}>
          {copy.cta}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 bg-white text-center">
        <p className="text-[11px] leading-relaxed" style={{ color: "#1a1a1a", fontFamily: "Inter, sans-serif" }}>{copy.body}</p>
      </div>

      {/* Product grid (only if real products are provided — no stock placeholders) */}
      {products.length > 0 && (
        <div className="px-3 pb-3 bg-white grid grid-cols-3 gap-1.5">
          {products.slice(0, 3).map((p, i) => (
            <div key={p.id ?? i} className="aspect-square rounded-sm grid place-items-center text-[8px] text-black/30 uppercase tracking-wider"
              style={{ background: p.imageUrl ? `url(${p.imageUrl}) center/cover no-repeat, #F5F5F5` : "#F5F5F5" }}>
              {!p.imageUrl && "no photo"}
            </div>
          ))}
        </div>
      )}

      {/* Brand pillars bar */}
      <div className="grid grid-cols-4 bg-black" style={{ gap: "1px" }}>
        {BRAND_PILLARS.map((p) => (
          <div key={p.slug} className="py-2 text-center bg-black">
            <span className="inline-flex items-baseline text-[9px] text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
              <span style={{ fontWeight: 700 }}>divain</span>
              <span style={{ color: "#D99425" }}>.</span>
              <span style={{ fontWeight: 600, marginLeft: 2 }}>{p.label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Gold footer with legal entity */}
      <div className="px-4 py-5 text-center" style={{ background: "#D99425", color: "#FFFFFF" }}>
        <div className="mb-2.5">
          <DivainWordmark size={28} color="#FFFFFF" dotColor="#FFFFFF" />
        </div>
        <div className="text-[8px] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
          <strong>{store.legal.legalName}</strong> · {store.legal.vatNumber}
        </div>
        <div className="text-[8px] opacity-90 leading-relaxed" style={{ fontFamily: "Outfit, sans-serif" }}>
          {store.legal.address}, {store.legal.postalCode} {store.legal.city}
        </div>
        <div className="text-[9px] mt-2 leading-snug" style={{ fontFamily: "Outfit, sans-serif" }}>
          {copy.footer.split("?").map((part, i) => i === 0 ? <span key={i}>{part}?</span> : <span key={i}><br/><a className="underline font-semibold">{part.trim()}</a></span>)}
        </div>
      </div>
    </div>
  );
}
