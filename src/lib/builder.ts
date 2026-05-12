// Email builder — block types + MJML serializer.
//
// The builder lives in `src/app/(app)/builder/page.tsx`. It edits a `Document`
// (an ordered list of `Block`s) and exports MJML via `documentToMjml`. The same
// MJML output is what gets stored on `Template.mjml` and `CampaignVariant.mjml`.

export type Block =
  | { id: string; type: "hero";          props: { imageUrl: string; heading: string; subheading?: string; bgColor?: string; textColor?: string } }
  | { id: string; type: "text";          props: { text: string; align?: "left" | "center" | "right"; size?: number } }
  | { id: string; type: "image";         props: { imageUrl: string; href?: string; align?: "left" | "center" | "right"; widthPct?: number } }
  | { id: string; type: "button";        props: { label: string; href: string; bgColor?: string; textColor?: string; align?: "left" | "center" | "right"; style?: "gold" | "black" | "outlined" } }
  | { id: string; type: "product-card";  props: { productId: string; cta?: string; showPrice?: boolean; market?: string } }
  | { id: string; type: "product-grid";  props: { productIds: string[]; columns?: 2 | 3; market?: string } }
  | { id: string; type: "spacer";        props: { height?: number } }
  | { id: string; type: "divider";       props: { color?: string } }
  | { id: string; type: "columns";       props: { left: { text: string }; right: { text: string } } }
  // Big-number hero (matches Divain "55% / 11,99€" promo emails).
  | { id: string; type: "big-number";    props: { number: string; subtitle: string; tagline?: string; bgImageUrl?: string; bgColor?: string; textColor?: string; ctaLabel?: string; ctaHref?: string; ctaStyle?: "gold" | "black" | "outlined" } }
  // Brand bar: 2 or 4 columns showing divain. PARFUMS / CARE / HOME / RITUAL.
  | { id: string; type: "brand-pillars"; props: { pillarSlugs: string[]; bgColor?: string; textColor?: string } }
  // App download promo card (matches the "TÉLÉCHARGER MAINTENANT" / "DESCARGAR AHORA" pattern).
  | { id: string; type: "app-promo";     props: { imageUrl: string; heading: string; body: string; ctaLabel: string; ctaHref: string } }
  | { id: string; type: "footer";        props: { storeId: string } };

export type BlockType = Block["type"];

export type Document = {
  blocks: Block[];
  // canvas-level styling (applied to mj-body)
  bgColor: string;
  contentBgColor: string;
  fontFamily: string;
  fontHeading: string;
  widthPx: number;
};

export const DEFAULT_DOCUMENT: Document = {
  blocks: [],
  bgColor: "#FFFFFF",
  contentBgColor: "#FFFFFF",
  fontFamily: "Inter, Helvetica, Arial, sans-serif",
  fontHeading: "Outfit, 'futura-pt', Helvetica, Arial, sans-serif",
  widthPx: 600,
};

// Button style presets matching Divain's real CTA system.
export const BUTTON_STYLES: Record<"gold" | "black" | "outlined", { bgColor: string; textColor: string; border?: string }> = {
  gold:     { bgColor: "#D99425", textColor: "#FFFFFF" },
  black:    { bgColor: "#000000", textColor: "#FFFFFF" },
  outlined: { bgColor: "#FFFFFF", textColor: "#000000", border: "1px solid #000000" },
};

export const BLOCK_DEFAULTS: Record<BlockType, () => Block> = {
  hero: () => ({ id: cuid(), type: "hero", props: { imageUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/65d78707-8304-4824-91b2-b23657f4b8dd.jpeg", heading: "Para ella, lo que de verdad le emociona", subheading: "Selección Día de la Madre", bgColor: "#FFFFFF", textColor: "#1A1A1A" } }),
  text: () => ({ id: cuid(), type: "text", props: { text: "Una selección de fragancias hechas para emocionar este Día de la Madre. Encuentra el regalo perfecto entre nuestras equivalencias premium.", align: "center", size: 15 } }),
  image: () => ({ id: cuid(), type: "image", props: { imageUrl: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=1200", align: "center", widthPct: 100 } }),
  button: () => ({ id: cuid(), type: "button", props: { label: "ACHETER MAINTENANT", href: "https://divainparfums.com/collections/sale", style: "gold", align: "center" } }),
  "product-card": () => ({ id: cuid(), type: "product-card", props: { productId: "pr_p1_st_1", cta: "Comprar", showPrice: true, market: "ES" } }),
  "product-grid": () => ({ id: cuid(), type: "product-grid", props: { productIds: ["pr_p1_st_1", "pr_p2_st_1", "pr_p3_st_1"], columns: 3, market: "ES" } }),
  "big-number": () => ({ id: cuid(), type: "big-number", props: { number: "55%", subtitle: "DE RÉDUCTION", tagline: "sur tous les parfums.", bgImageUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/65d78707-8304-4824-91b2-b23657f4b8dd.jpeg", bgColor: "#FFBDCF", textColor: "#FFFFFF", ctaLabel: "ACHETER MAINTENANT", ctaHref: "https://divainparfums.com/collections/sale", ctaStyle: "gold" } }),
  "brand-pillars": () => ({ id: cuid(), type: "brand-pillars", props: { pillarSlugs: ["parfums", "care", "home", "ritual"], bgColor: "#000000", textColor: "#FFFFFF" } }),
  "app-promo": () => ({ id: cuid(), type: "app-promo", props: { imageUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/REVNSD/images/3cb2b8b3-eafd-4121-ba02-afbaa01cf10e.jpeg", heading: "¿AÚN NO TIENES LA NUEVA APP?", body: "Beneficios exclusivos y ofertas que no verás en la web.", ctaLabel: "DESCARGAR AHORA", ctaHref: "https://onelink.to/43swmh" } }),
  spacer: () => ({ id: cuid(), type: "spacer", props: { height: 24 } }),
  divider: () => ({ id: cuid(), type: "divider", props: { color: "#E5E0D6" } }),
  columns: () => ({ id: cuid(), type: "columns", props: { left: { text: "Envío gratis a partir de 30€" }, right: { text: "Devoluciones sin coste" } } }),
  footer: () => ({ id: cuid(), type: "footer", props: { storeId: "st_1" } }),
};

export const BLOCK_LABELS: Record<BlockType, { label: string; icon: string }> = {
  hero:            { label: "Hero",                icon: "image" },
  "big-number":    { label: "Big number promo",    icon: "percent" },
  text:            { label: "Text",                icon: "type" },
  image:           { label: "Image",               icon: "image" },
  button:          { label: "Button",              icon: "mouse-pointer" },
  "product-card":  { label: "Product card",        icon: "shopping-bag" },
  "product-grid":  { label: "Product grid",        icon: "grid-3x3" },
  "brand-pillars": { label: "Brand pillars",       icon: "layout-grid" },
  "app-promo":     { label: "App download",        icon: "smartphone" },
  spacer:          { label: "Spacer",              icon: "minus" },
  divider:         { label: "Divider",             icon: "separator-horizontal" },
  columns:         { label: "2 columns",           icon: "columns-2" },
  footer:          { label: "Footer (legal)",      icon: "scroll-text" },
};

function cuid() {
  return "b_" + Math.random().toString(36).slice(2, 10);
}

// ── Serialize ─────────────────────────────────────────────────────────────────
//
// Resolves dynamic block content (product cards, footers) against the live
// catalog and store data at render time. The resulting MJML is stable and
// compatible with Outlook, Gmail and Apple Mail thanks to mj-* primitives.

import type { MockStore, MockProduct } from "./mock";
import { BRAND_PILLARS } from "./mock";

export function documentToMjml(
  doc: Document,
  ctx: { stores: MockStore[]; products: MockProduct[]; storeId: string; market: string }
): string {
  const store = ctx.stores.find((s) => s.id === ctx.storeId);
  const sections = doc.blocks.map((b) => blockToMjml(b, doc, ctx)).join("\n");

  return `
<mjml>
  <mj-head>
    <mj-title>Sendify</mj-title>
    <mj-preview></mj-preview>
    <mj-attributes>
      <mj-all font-family="${doc.fontFamily}" />
      <mj-text font-size="${15}px" line-height="1.6" color="${store?.brand.palette.text ?? "#1A1A1A"}" />
      <mj-button font-weight="500" border-radius="2px" inner-padding="14px 28px" />
    </mj-attributes>
    <mj-style>
      .h-display { font-family: ${doc.fontHeading}; font-weight: 500; letter-spacing: -0.01em; }
    </mj-style>
  </mj-head>
  <mj-body background-color="${doc.bgColor}" width="${doc.widthPx}px">
${sections}
  </mj-body>
</mjml>`.trim();
}

function blockToMjml(b: Block, doc: Document, ctx: { stores: MockStore[]; products: MockProduct[]; storeId: string; market: string }): string {
  switch (b.type) {
    case "hero":
      return `    <mj-section background-color="${b.props.bgColor ?? doc.contentBgColor}" padding="0">
      <mj-column>
        <mj-image src="${b.props.imageUrl}" alt="" padding="0" />
        <mj-text align="center" padding="28px 24px 8px" color="${b.props.textColor ?? "#1A1A1A"}" css-class="h-display" font-size="26px">
          ${escapeHtml(b.props.heading)}
        </mj-text>
        ${b.props.subheading ? `<mj-text align="center" padding="0 24px 24px" color="#555" font-size="13px">${escapeHtml(b.props.subheading)}</mj-text>` : ""}
      </mj-column>
    </mj-section>`;

    case "text":
      return `    <mj-section background-color="${doc.contentBgColor}" padding="8px 12px">
      <mj-column>
        <mj-text align="${b.props.align ?? "left"}" font-size="${b.props.size ?? 15}px" padding="8px 12px">${escapeHtml(b.props.text).replace(/\n/g, "<br/>")}</mj-text>
      </mj-column>
    </mj-section>`;

    case "image":
      return `    <mj-section background-color="${doc.contentBgColor}" padding="8px 0">
      <mj-column>
        <mj-image src="${b.props.imageUrl}" alt="" align="${b.props.align ?? "center"}" width="${(b.props.widthPct ?? 100) * doc.widthPx / 100}px" padding="0" ${b.props.href ? `href="${b.props.href}"` : ""} />
      </mj-column>
    </mj-section>`;

    case "button": {
      const style = b.props.style ?? "gold";
      const preset = BUTTON_STYLES[style];
      const bg = b.props.bgColor ?? preset.bgColor;
      const fg = b.props.textColor ?? preset.textColor;
      const border = preset.border ?? "none";
      return `    <mj-section background-color="${doc.contentBgColor}" padding="12px 18px 30px">
      <mj-column>
        <mj-button background-color="${bg}" color="${fg}" href="${b.props.href}" align="${b.props.align ?? "center"}" font-size="11px" letter-spacing="1px" text-transform="uppercase" font-weight="400" border-radius="40px" inner-padding="13px 35px" border="${border}">
          ${escapeHtml(b.props.label)}
        </mj-button>
      </mj-column>
    </mj-section>`;
    }

    case "big-number": {
      const style = b.props.ctaStyle ?? "gold";
      const preset = BUTTON_STYLES[style];
      const bgImage = b.props.bgImageUrl
        ? `background-url="${b.props.bgImageUrl}" background-size="cover" background-position="center bottom" background-repeat="no-repeat"`
        : "";
      return `    <mj-section background-color="${b.props.bgColor ?? "#FFBDCF"}" ${bgImage} padding="40px 24px 60px">
      <mj-column>
        <mj-text align="center" color="${b.props.textColor ?? "#FFFFFF"}" font-size="98px" font-weight="700" line-height="1" font-family="Outfit, 'futura-pt', Helvetica, Arial, sans-serif" padding="10px 0 0">
          ${escapeHtml(b.props.number)}
        </mj-text>
        <mj-text align="center" color="${b.props.textColor ?? "#FFFFFF"}" font-size="25px" font-weight="400" letter-spacing="5px" font-family="Outfit, Helvetica, Arial, sans-serif" padding="8px 0 0">
          ${escapeHtml(b.props.subtitle)}
        </mj-text>
        ${b.props.tagline ? `<mj-text align="center" color="${b.props.textColor ?? "#FFFFFF"}" font-size="22px" font-family="Outfit, Helvetica, Arial, sans-serif" padding="0 0 30px">${escapeHtml(b.props.tagline)}</mj-text>` : ""}
        ${b.props.ctaLabel ? `<mj-button background-color="${preset.bgColor}" color="${preset.textColor}" href="${b.props.ctaHref ?? "#"}" font-size="11px" letter-spacing="1px" text-transform="uppercase" font-weight="400" border-radius="40px" inner-padding="13px 35px" border="${preset.border ?? "none"}">${escapeHtml(b.props.ctaLabel)}</mj-button>` : ""}
      </mj-column>
    </mj-section>`;
    }

    case "brand-pillars": {
      const pillars = b.props.pillarSlugs
        .map((s) => BRAND_PILLARS.find((p) => p.slug === s))
        .filter(Boolean) as typeof BRAND_PILLARS;
      const cols = pillars.map((p) => `      <mj-column background-color="${b.props.bgColor ?? "#000000"}" padding="14px 8px">
        <mj-text align="center" color="${b.props.textColor ?? "#FFFFFF"}" font-size="14px" font-family="Outfit, Helvetica, Arial, sans-serif" font-weight="600">
          <span style="font-weight:700">divain</span><span style="color:#D99425">.</span> ${p.label}
        </mj-text>
      </mj-column>`).join("\n");
      return `    <mj-section background-color="${b.props.bgColor ?? "#000000"}" padding="0">
${cols}
    </mj-section>`;
    }

    case "app-promo":
      return `    <mj-section background-color="#FFFFFF" padding="0">
      <mj-column>
        <mj-image src="${b.props.imageUrl}" alt="" padding="0" />
        <mj-text align="center" color="#000" font-size="22px" font-family="Outfit, Helvetica, Arial, sans-serif" font-weight="400" padding="20px 12px 4px">${escapeHtml(b.props.heading)}</mj-text>
        <mj-text align="center" color="#000" font-size="15px" font-family="Inter, Helvetica, Arial, sans-serif" padding="0 24px 16px">${escapeHtml(b.props.body)}</mj-text>
        <mj-button background-color="#FFFFFF" color="#000000" border="1px solid #000000" href="${b.props.ctaHref}" font-size="10px" letter-spacing="1px" text-transform="uppercase" border-radius="21px" inner-padding="13px 38px">
          ${escapeHtml(b.props.ctaLabel)}
        </mj-button>
        <mj-spacer height="30px" />
      </mj-column>
    </mj-section>`;

    case "product-card": {
      const p = ctx.products.find((x) => x.id === b.props.productId);
      const price = p?.prices[b.props.market ?? ctx.market];
      return `    <mj-section background-color="${doc.contentBgColor}" padding="12px">
      <mj-column>
        ${p ? `
        <mj-image src="${p.imageUrl}" alt="" padding="0" />
        <mj-text align="center" css-class="h-display" font-size="18px" padding="12px 12px 4px">${escapeHtml(p.title.split(" — ")[0])}</mj-text>
        <mj-text align="center" color="#888" font-size="12px" padding="0 12px 8px">${escapeHtml(p.inspiredBy)}</mj-text>
        ${b.props.showPrice !== false && price ? `<mj-text align="center" font-size="16px" padding="0 12px 12px">${formatPrice(price.price, price.currency)}${price.compareAt ? ` <span style="color:#999;text-decoration:line-through;font-size:13px">${formatPrice(price.compareAt, price.currency)}</span>` : ""}</mj-text>` : ""}
        <mj-button background-color="#0E0E0E" color="#FFFFFF" font-size="11px" letter-spacing="1.5px" text-transform="uppercase">${escapeHtml(b.props.cta ?? "Comprar")}</mj-button>
        ` : `<mj-text>[product missing]</mj-text>`}
      </mj-column>
    </mj-section>`;
    }

    case "product-grid": {
      const cols = b.props.columns ?? 3;
      const items = b.props.productIds.slice(0, cols).map((pid) => {
        const p = ctx.products.find((x) => x.id === pid);
        const price = p?.prices[b.props.market ?? ctx.market];
        return `        <mj-column>
          ${p ? `<mj-image src="${p.imageUrl}" alt="" padding="0" />
          <mj-text align="center" font-size="13px" font-weight="500" padding="8px 4px 4px">${escapeHtml(p.title.split(" — ")[0])}</mj-text>
          ${price ? `<mj-text align="center" font-size="13px" padding="0 4px 4px">${formatPrice(price.price, price.currency)}</mj-text>` : ""}` : `<mj-text>[missing]</mj-text>`}
        </mj-column>`;
      }).join("\n");
      return `    <mj-section background-color="${doc.contentBgColor}" padding="12px 8px">
${items}
    </mj-section>`;
    }

    case "spacer":
      return `    <mj-section background-color="${doc.contentBgColor}" padding="0">
      <mj-column>
        <mj-spacer height="${b.props.height ?? 24}px" />
      </mj-column>
    </mj-section>`;

    case "divider":
      return `    <mj-section background-color="${doc.contentBgColor}" padding="0 24px">
      <mj-column>
        <mj-divider border-color="${b.props.color ?? "#E5E0D6"}" border-width="1px" />
      </mj-column>
    </mj-section>`;

    case "columns":
      return `    <mj-section background-color="${doc.contentBgColor}" padding="12px 8px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#555" padding="8px">${escapeHtml(b.props.left.text)}</mj-text>
      </mj-column>
      <mj-column>
        <mj-text align="center" font-size="12px" color="#555" padding="8px">${escapeHtml(b.props.right.text)}</mj-text>
      </mj-column>
    </mj-section>`;

    case "footer": {
      const store = ctx.stores.find((s) => s.id === b.props.storeId);
      if (!store) return `<!-- footer: store not found -->`;
      const l = store.legal;
      // Divain's real footer is a gold gradient block with the big "divain." wordmark,
      // social icons, an unsubscribe block in white text, and the legal entity in tiny copy.
      return `    <mj-section background-color="#D99425" padding="40px 24px 16px">
      <mj-column>
        <mj-text align="center" color="#FFFFFF" font-size="72px" font-weight="700" line-height="1" font-family="Outfit, Helvetica, Arial, sans-serif" letter-spacing="-0.02em" padding="10px 0 16px">
          divain<span style="color:#FFFFFF">.</span>
        </mj-text>
        <mj-text align="center" color="#FFFFFF" font-size="12px" font-family="Outfit, Helvetica, Arial, sans-serif" padding="0 0 4px">
          <a href="https://www.instagram.com/divain_es" style="color:#FFFFFF;text-decoration:none;margin:0 12px">Instagram</a>
          <a href="https://www.facebook.com/divainpparfums" style="color:#FFFFFF;text-decoration:none;margin:0 12px">Facebook</a>
          <a href="https://www.tiktok.com/@divain_es" style="color:#FFFFFF;text-decoration:none;margin:0 12px">TikTok</a>
        </mj-text>
        <mj-text align="center" color="#FFFFFF" font-size="11px" font-family="Outfit, Helvetica, Arial, sans-serif" padding="20px 0 0">
          <em>*Promoción sujeta a términos y condiciones: <a href="${l.termsUrl}" style="color:#FFFFFF;text-decoration:underline">Consulta en nuestra web</a>.</em>
        </mj-text>
        <mj-text align="center" color="#FFFFFF" font-size="11px" font-family="Outfit, Helvetica, Arial, sans-serif" padding="16px 0 0" line-height="1.5">
          © {{ year }} ${escapeHtml(l.legalName)} · ${escapeHtml(l.vatNumber)}<br/>
          ${escapeHtml(l.address)}, ${escapeHtml(l.postalCode)} ${escapeHtml(l.city)}, ${escapeHtml(l.country)}
        </mj-text>
        <mj-text align="center" color="#FFFFFF" font-size="12px" font-family="Outfit, Helvetica, Arial, sans-serif" padding="12px 0 0">
          ¿No quieres recibir más emails?<br/>
          <a href="{{unsubscribeUrl}}" style="color:#FFFFFF;text-decoration:underline;font-weight:600">Darse de baja</a>
        </mj-text>
      </mj-column>
    </mj-section>`;
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatPrice(amount: number, currency: string) {
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "USD" ? "$" : currency;
  return `${symbol}${amount.toFixed(2)}`;
}
