// Pre-built MJML skeletons, one per layout pattern. Hand-crafted so the visual
// quality is guaranteed regardless of which LLM writes the copy. The LLM is
// no longer responsible for emitting MJML — it only fills slots. This removes
// design variability and gives us professional output even from cheap models.
//
// Slots use {{slot_name}} mustache syntax. Missing slots default to "" so a
// partial fill still renders cleanly.

export type SkeletonSlots = {
  // Required across all patterns
  preheader: string;
  headline: string;
  ctaLabel: string;
  ctaUrl?: string;
  heroUrl: string;             // Gemini-generated banner URL
  // Palette resolved from store brand kit
  bgColor: string;
  textColor: string;
  primaryColor: string;
  // Optional copy
  subhead?: string;
  body?: string;
  offerNumber?: string;        // "55%", "11,99€" — used by big-number-hero
  offerLabel?: string;         // "DE DESCUENTO", "TODOS LOS PERFUMES A"
  // Brand anthology
  pillarBlurbs?: Array<{ title: string; copy: string; ctaLabel: string; ctaUrl?: string; imageUrl?: string }>;
  // Product grid
  products?: Array<{ title: string; price: string; imageUrl: string; productUrl?: string | null }>;
  // Premium launch
  productName?: string;
  productImageUrl?: string;
  productPageUrl?: string;     // storefront URL for the featured product
  productCopy?: string;
  // Countdown / winback
  customerIncentive?: string;  // "-15%"
  // Legal footer (driven by Store.legalName/legalAddress/etc). When present,
  // renderSkeleton injects a compliance block under the brand bar so every
  // generated template includes the unsubscribe link + razón social.
  storeName?: string;
  storefrontUrl?: string;
  legalName?: string;
  legalAddress?: string;
  legalCity?: string;
  legalCountry?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;     // defaults to a generic /unsubscribe stub when missing
  // Brand logo URLs — when present, the WORDMARK helper renders an image
  // instead of the "divain." text. brandLogoDarkUrl is used inside dark hero
  // sections so the logo doesn't disappear.
  brandLogoUrl?: string;
  brandLogoDarkUrl?: string;
  // ── Klaviyo-grade content blocks (NEW) ─────────────────────────────────
  // Product spotlight — one featured product with rich copy. Renders as a
  // full-width card with the actual Shopify image, name, price and a longer
  // story paragraph. Sits below the hero so the email leads with the model
  // photo and then drills into the actual bottle.
  spotlight?: {
    title: string;          // product name, e.g. "DIVAIN-832"
    notes: string;          // "Notas de jazmín, vainilla, ámbar"
    story: string;          // 2-3 sentence story
    price?: string;         // "11,99€"
    imageUrl: string;       // Shopify CDN URL
    productUrl?: string;
    ctaLabel?: string;      // defaults to "DESCUBRIRLO"
  };
  // Editorial / story block — 2-3 paragraphs about the brand pillar, ritual,
  // or "why we made this". Pure copy, no image. Adds depth without bloat.
  editorialBlock?: {
    eyebrow: string;        // "LA HISTORIA"
    headline: string;       // "El perfume como ritual"
    paragraphs: string[];   // 1-3 short paragraphs
  };
  // ── LLM-DRIVEN OPTIONAL CONTENT BLOCKS (NEW) ───────────────────────────
  // None of these fall back to hardcoded fake content. If the LLM doesn't
  // populate them, the block stays hidden. This is what makes the templates
  // scalable across stores: the LLM writes brand-voice copy per generation,
  // we never ship invented testimonials or invented product notes.
  //
  // Trust band — pulled from Store config (real shipping / returns policy).
  // Up to 3 items. Block hidden if zero items configured.
  trustItems?: Array<{ label: string; sub?: string }>;
  // Brand promise — single-line positioning statement. Replaces the
  // hallucinated customer-review block until we have a real Review table.
  // Optional eyebrow + 1-2 sentence promise + optional small caption.
  brandPromise?: {
    eyebrow?: string;       // "Nuestra promesa" / "Lo que prometemos"
    body: string;           // 1-2 sentence positioning (e.g. "El mismo acorde, sin la marca encima.")
    caption?: string;       // "Desde 2007 · Alicante"
  };
  // Numbered reasons — store / brand reasons (3 cards). LLM writes them
  // per generation so different stores can have different reasons.
  reasons?: Array<{ title: string; copy: string }>;
  // Perfume notes pyramid — only renders for premium-launch when LLM
  // extracts notes from the product description. Up to 3 items per tier.
  fragranceNotes?: {
    top: string[];          // ["Bergamota", "Pimienta rosa"]
    heart: string[];        // ["Jazmín", "Iris"]
    base: string[];         // ["Vainilla", "Ámbar"]
  };
  // Process / "behind the scenes" block — LLM-written 2-paragraph story
  // for premium-launch. No hardcoded fallback.
  processBlock?: {
    eyebrow?: string;       // "Detrás de la fragancia"
    headline: string;       // 8-12 words editorial line
    paragraphs: string[];   // 1-2 paragraphs
  };
  // Founder / team note — used by winback-empathic. LLM writes it.
  founderNote?: {
    eyebrow?: string;       // "Una nota del equipo"
    headline: string;       // "Gracias por probarnos un día."
    body: string;           // 1-2 sentence personal message
  };
  // App benefits — used by app-promo-gradient. Up to 3 numbered items.
  appBenefits?: Array<{ title: string; copy: string }>;
  // Urgency reasons — used by countdown-urgency. Up to 3 numbered items.
  urgencyReasons?: Array<{ title: string; copy: string }>;
  // Promo code — used by big-number-hero / countdown-urgency. Optional.
  promoCode?: { code: string; label?: string };
};

// Brand-pillar bar. Four columns, black background, links to the four pillar
// collections on the storefront. CRITICAL: the "divain." wordmark is ALWAYS
// lowercase (brand rule) — only the pillar name (PARFUMS / CARE / HOME /
// RITUAL) is uppercase. To preserve the case mix inside a single mj-text we
// leave the wrapper without text-transform and uppercase the pillar inline
// via a span. We use the storefrontUrl as the base for each link, with a
// sensible collection handle per pillar.
const BRAND_BAR = (textOnDark = "#FFFFFF", storefrontUrl = "https://divainparfums.com") => {
  const base = storefrontUrl.replace(/\/$/, "");
  // Each pillar links to the storefront homepage with a utm_content marker
  // (safer than hard-coding /collections/X handles that may not exist on
  // every store). Once we know the real collection handles per store we can
  // route precisely; for now the click lands on the brand site reliably.
  const pillars = ["PARFUMS", "CARE", "HOME", "RITUAL"] as const;
  const col = (name: string) => `
    <mj-column width="25%">
      <mj-text align="center" color="${textOnDark}" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="3px" font-weight="500">
        <a href="${base}/?utm_source=sendify&amp;utm_medium=email&amp;utm_content=brandbar-${name.toLowerCase()}" style="color:${textOnDark};text-decoration:none;">
          <span style="text-transform:none;">divain.</span> <span style="text-transform:uppercase;">${name}</span>
        </a>
      </mj-text>
    </mj-column>`;
  return `
  <mj-section background-color="#000000" padding="22px 0" css-class="sf-mobile-pad">
    ${pillars.map(col).join("")}
  </mj-section>
`;
};

// Legal compliance footer — required in every promotional email under
// EU/UK/US e-commerce rules. Pulls razón social, address, privacy URL and
// unsubscribe link from the store. Sits under the BRAND_BAR.
//
// Style: small light-grey type on the store bg. Reads as a quiet legal slip
// that doesn't fight the design. Falls back gracefully when the store hasn't
// filled all the fields yet (just shows the unsubscribe + privacy line).
const LEGAL_FOOTER = (s: SkeletonSlots) => {
  const unsub   = s.unsubscribeUrl ?? `${(s.storefrontUrl ?? "").replace(/\/$/, "")}/account`;
  const privacy = s.privacyUrl ?? `${(s.storefrontUrl ?? "").replace(/\/$/, "")}/policies/privacy-policy`;
  const legalLine = [s.legalName, s.legalAddress, [s.legalCity, s.legalCountry].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
  return `
  <mj-section background-color="${s.bgColor}" padding="22px 24px 44px" css-class="sf-mobile-pad">
    <mj-column>
      ${legalLine ? `<mj-text align="center" color="#888" font-family="Inter, Helvetica, Arial, sans-serif" font-size="10.5px" line-height="1.7">${escapeHtml(legalLine)}</mj-text>` : ""}
      <mj-text align="center" color="#888" font-family="Inter, Helvetica, Arial, sans-serif" font-size="10.5px" line-height="1.7" padding-top="${legalLine ? "6px" : "0"}">
        <a href="${unsub}" style="color:#888;text-decoration:underline;">Darme de baja</a>
        &nbsp;·&nbsp;
        <a href="${privacy}" style="color:#888;text-decoration:underline;">Privacidad</a>
        ${s.storefrontUrl ? `&nbsp;·&nbsp;<a href="${s.storefrontUrl}" style="color:#888;text-decoration:underline;">${escapeHtml(s.storefrontUrl.replace(/^https?:\/\//, ""))}</a>` : ""}
      </mj-text>
    </mj-column>
  </mj-section>
`;
};

const PREHEADER = (text: string, bg: string) => `
  <mj-raw><div style="display:none;font-size:1px;color:${bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(text)}</div></mj-raw>
`;

// Top-of-email brand mark. Uses the store's uploaded logo image when set
// (Store.brandLogoUrl), falls back to the divain. wordmark in text otherwise.
// Linked to the storefront so clicks from the header land on the homepage.
const WORDMARK = (color: string, logoUrl?: string, href?: string) => {
  const link = href ?? "#";
  if (logoUrl) {
    return `
      <mj-section padding="28px 24px 8px" css-class="sf-mobile-pad">
        <mj-column>
          <mj-image src="${logoUrl}" alt="" width="120px" align="center" href="${link}" padding="0" />
        </mj-column>
      </mj-section>
    `;
  }
  return `
    <mj-section padding="28px 24px 0" css-class="sf-mobile-pad">
      <mj-column>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="24px" font-weight="700" color="${color}" letter-spacing="-0.5px">
          <a href="${link}" style="color:${color};text-decoration:none;">divain.</a>
        </mj-text>
      </mj-column>
    </mj-section>
  `;
};

// Inline brand wordmark for OVERLAY use inside a hero photo. Renders as a
// small white "divain." text (or compact logo image) with subtle text-shadow
// so it reads on any background. No standalone section — meant to live inside
// an existing hero <mj-column> ABOVE the headline.
//
// When the user gave the explicit feedback "quiero el logo dentro de la foto
// tambn porfa y sin marco" they meant: drop the separate cream-coloured
// header section above the hero photo and burn the brand mark directly into
// the photographed area. This helper does that.
const HERO_BRAND_OVERLAY = (logoDarkUrl?: string, href?: string) => {
  const link = href ?? "#";
  if (logoDarkUrl) {
    return `
      <mj-image src="${logoDarkUrl}" alt="" width="96px" align="center" href="${link}" padding="0 0 22px 0" />
    `;
  }
  return `
    <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="18px" font-weight="700" color="#FFFFFF" letter-spacing="-0.3px" padding="0 0 22px 0" css-class="sf-hero-text">
      <a href="${link}" style="color:#FFFFFF;text-decoration:none;">divain.</a>
    </mj-text>
  `;
};

// CTA pill. Tighter Klaviyo-style: 13px type, 2px tracking, 16/40 padding
// so the tap target is generous on mobile but it doesn't read as a giant
// gradient blob. Wrapped in css-class="sf-cta" so the @media rule can force
// it full-width on phones.
const PILL_BUTTON = (label: string, bg: string, color: string, href: string) => `
  <mj-button background-color="${bg}" color="${color}" border-radius="40px" font-family="Inter, Helvetica, Arial, sans-serif" font-size="13px" letter-spacing="2px" font-weight="500" inner-padding="16px 40px" text-transform="uppercase" href="${href}" css-class="sf-cta">${escapeHtml(label)}</mj-button>
`;

// Klaviyo-style product spotlight. Renders as a single-product card with the
// real Shopify image (full-width on mobile), name, price, story copy and a
// CTA. Inserted between the hero and the brand bar in most skeletons so the
// email leads with the editorial photo, then drills into the actual bottle.
const PRODUCT_SPOTLIGHT = (s: SkeletonSlots) => {
  if (!s.spotlight) return "";
  const sp = s.spotlight;
  return `
  <mj-section padding="48px 0 16px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${s.textColor}" font-weight="500">Producto destacado</mj-text>
    </mj-column>
  </mj-section>
  <mj-section padding="0 24px 12px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
    <mj-column>
      <mj-image src="${sp.imageUrl}" alt="${escapeHtml(sp.title)}" padding="0" href="${sp.productUrl ?? s.ctaUrl ?? "#"}" css-class="sf-img-bleed" />
    </mj-column>
  </mj-section>
  <mj-section padding="20px 24px 8px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="22px" font-weight="500" letter-spacing="-0.25px" color="${s.textColor}">${escapeHtml(sp.title)}</mj-text>
      ${sp.notes ? `<mj-text align="center" font-size="12px" letter-spacing="3px" text-transform="uppercase" color="${s.textColor}" padding-top="6px"><span style="opacity:0.6;">${escapeHtml(sp.notes)}</span></mj-text>` : ""}
      ${sp.price ? `<mj-text align="center" font-size="15px" font-weight="500" color="${s.primaryColor}" padding-top="12px">${escapeHtml(sp.price)}</mj-text>` : ""}
    </mj-column>
  </mj-section>
  <mj-section padding="6px 24px 8px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" font-size="14px" line-height="1.65" color="${s.textColor}" css-class="sf-body" padding="0 24px">${escapeHtml(sp.story)}</mj-text>
    </mj-column>
  </mj-section>
  <mj-section padding="18px 24px 48px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
    <mj-column>
      ${PILL_BUTTON(sp.ctaLabel ?? "DESCUBRIRLO", s.primaryColor, s.bgColor, sp.productUrl ?? s.ctaUrl ?? "#")}
    </mj-column>
  </mj-section>
`;
};

// Editorial / story block. 2-3 paragraphs that give the email depth without
// pushing another product. Klaviyo emails for premium brands almost always
// have one of these between the hero and the product grid. Optional.
const EDITORIAL_BLOCK = (s: SkeletonSlots) => {
  if (!s.editorialBlock) return "";
  const eb = s.editorialBlock;
  return `
  <mj-section padding="36px 24px 12px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${s.textColor}" font-weight="500"><span style="opacity:0.65;">${escapeHtml(eb.eyebrow)}</span></mj-text>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="26px" font-weight="400" line-height="1.2" letter-spacing="-0.25px" color="${s.textColor}" padding-top="10px">${escapeHtml(eb.headline)}</mj-text>
    </mj-column>
  </mj-section>
  ${eb.paragraphs.map((p) => `
  <mj-section padding="8px 32px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" font-size="15px" line-height="1.75" color="${s.textColor}" css-class="sf-body"><span style="opacity:0.88;">${escapeHtml(p)}</span></mj-text>
    </mj-column>
  </mj-section>`).join("")}
  <mj-section padding="24px 0 8px" background-color="${s.bgColor}">
    <mj-column>
      <mj-divider border-color="${s.textColor}" border-width="1px" css-class="sf-divider" padding="0 36%" />
    </mj-column>
  </mj-section>
`;
};

// ── Reusable content blocks ────────────────────────────────────────────────
// The point of these helpers is variety: each pattern can pull in 2-3 of
// them in a different order, so emails stop feeling like the same hero +
// CTA + brand-bar skeleton over and over.

// Trust band — only renders when the Store has policy data configured.
// No hardcoded "Envío gratis a partir de 30€" anymore (that wasn't
// guaranteed to be true for every store + region). Falls back to "" so
// the block silently disappears when there's no data.
const TRUST_BAR = (textColor: string, bgColor: string, items: SkeletonSlots["trustItems"]) => {
  if (!items || items.length === 0) return "";
  const cells = items.slice(0, 3);
  const colWidth = `${(100 / cells.length).toFixed(2)}%`;
  return `
  <mj-section background-color="${bgColor}" padding="32px 16px 24px" border-top="1px solid rgba(0,0,0,0.08)" css-class="sf-mobile-pad">
    ${cells.map((it) => `
    <mj-column width="${colWidth}">
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="2.5px" text-transform="uppercase" color="${textColor}" font-weight="500" line-height="1.5"><span style="opacity:0.85;">${escapeHtml(it.label)}</span>${it.sub ? `<br/><span style="font-size:10.5px;opacity:0.55;letter-spacing:1.5px;">${escapeHtml(it.sub)}</span>` : ""}</mj-text>
    </mj-column>`).join("")}
  </mj-section>
`;
};

// Brand promise — replaces the previous REVIEW_QUOTE block. We no longer
// emit fake testimonials with hallucinated customer names (legal risk +
// dishonest). Instead this is a brand-voice positioning statement the LLM
// writes per generation. If LLM doesn't populate, block is hidden.
const BRAND_PROMISE = (textColor: string, bgColor: string, promise: SkeletonSlots["brandPromise"]) => {
  if (!promise || !promise.body) return "";
  return `
  <mj-section background-color="${bgColor}" padding="48px 32px 16px" css-class="sf-mobile-pad">
    <mj-column>
      ${promise.eyebrow ? `<mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${textColor}" font-weight="500" padding-bottom="14px"><span style="opacity:0.65;">${escapeHtml(promise.eyebrow)}</span></mj-text>` : ""}
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="24px" font-weight="400" line-height="1.35" color="${textColor}" letter-spacing="-0.2px" css-class="sf-h2">${escapeHtml(promise.body)}</mj-text>
      ${promise.caption ? `<mj-text align="center" font-size="11px" letter-spacing="3px" text-transform="uppercase" color="${textColor}" padding-top="14px"><span style="opacity:0.55;">${escapeHtml(promise.caption)}</span></mj-text>` : ""}
    </mj-column>
  </mj-section>
`;
};

// Three numbered reasons. LLM writes them per generation so different
// stores / different campaigns get different reasons. No hardcoded fallback
// — block hides when the LLM didn't populate.
const NUMBERED_REASONS = (textColor: string, bgColor: string, reasons: SkeletonSlots["reasons"], eyebrow?: string, headline?: string) => {
  if (!reasons || reasons.length === 0) return "";
  const cells = reasons.slice(0, 3);
  return `
  <mj-section background-color="${bgColor}" padding="42px 16px 10px" css-class="sf-mobile-pad">
    <mj-column>
      ${eyebrow ? `<mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${textColor}" font-weight="500"><span style="opacity:0.65;">${escapeHtml(eyebrow)}</span></mj-text>` : ""}
      ${headline ? `<mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="26px" font-weight="500" line-height="1.2" letter-spacing="-0.3px" color="${textColor}" padding-top="10px">${escapeHtml(headline)}</mj-text>` : ""}
    </mj-column>
  </mj-section>
  <mj-section background-color="${bgColor}" padding="18px 8px 36px" css-class="sf-mobile-pad">
    ${cells.map((r, i) => `
      <mj-column width="33.33%" padding="12px">
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="36px" font-weight="200" color="${textColor}" line-height="1" letter-spacing="-1px"><span style="opacity:0.5;">${String(i + 1).padStart(2, "0")}</span></mj-text>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="15px" font-weight="500" color="${textColor}" padding-top="10px">${escapeHtml(r.title)}</mj-text>
        <mj-text align="center" font-size="13px" line-height="1.55" color="${textColor}" padding-top="6px"><span style="opacity:0.7;">${escapeHtml(r.copy)}</span></mj-text>
      </mj-column>
    `).join("")}
  </mj-section>
`;
};

// 6-product mini grid. 3x2 grid of small product thumbs with name + price.
// Sits alongside the main hero / spotlight in product-led patterns to give
// the recipient more to browse without dominating the email.
const MINI_GRID_6 = (
  products: Array<{ title: string; price: string; imageUrl: string; productUrl?: string | null }>,
  textColor: string,
  bgColor: string,
  eyebrow = "Lo más vendido esta semana",
) => {
  if (products.length === 0) return "";
  const cells = products.slice(0, 6);
  const row = (slice: typeof cells) => `
    <mj-section background-color="${bgColor}" padding="6px 10px" css-class="sf-mobile-pad">
      ${slice.map((p) => {
        const href = p.productUrl ?? "#";
        return `
        <mj-column width="33.33%" padding="6px">
          ${p.imageUrl ? `<mj-image src="${p.imageUrl}" alt="${escapeHtml(p.title)}" border-radius="2px" href="${href}" />` : ""}
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="12px" color="${textColor}" font-weight="500" padding-top="8px" line-height="1.3"><a href="${href}" style="color:${textColor};text-decoration:none;">${escapeHtml(p.title)}</a></mj-text>
          ${p.price ? `<mj-text align="center" font-size="11px" color="${textColor}" padding-top="2px"><span style="opacity:0.6;">${escapeHtml(p.price)}</span></mj-text>` : ""}
        </mj-column>
      `;
      }).join("")}
    </mj-section>
  `;
  return `
    <mj-section background-color="${bgColor}" padding="44px 24px 8px" css-class="sf-mobile-pad">
      <mj-column>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${textColor}" font-weight="500"><span style="opacity:0.65;">${escapeHtml(eyebrow)}</span></mj-text>
      </mj-column>
    </mj-section>
    ${row(cells.slice(0, 3))}
    ${cells.length > 3 ? row(cells.slice(3, 6)) : ""}
  `;
};

// Notes pyramid for perfume spotlights — top / heart / base notes. Only
// renders when the LLM extracted real notes from the product description
// (it knows the SKU because it picked the headline product). No hardcoded
// fallback — block hides if notes weren't returned.
const NOTES_PYRAMID = (textColor: string, bgColor: string, notes: SkeletonSlots["fragranceNotes"]) => {
  if (!notes || ((notes.top?.length ?? 0) + (notes.heart?.length ?? 0) + (notes.base?.length ?? 0)) === 0) return "";
  const tier = (label: string, items: string[] | undefined) => `
    <mj-column width="33.33%">
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="10.5px" letter-spacing="3px" text-transform="uppercase" color="${textColor}"><span style="opacity:0.55;">${escapeHtml(label)}</span></mj-text>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="15px" font-weight="500" color="${textColor}" padding-top="6px" line-height="1.4">${(items ?? []).map(escapeHtml).join("<br/>") || "—"}</mj-text>
    </mj-column>
  `;
  return `
  <mj-section background-color="${bgColor}" padding="32px 24px 12px" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${textColor}" font-weight="500"><span style="opacity:0.65;">La fragancia</span></mj-text>
    </mj-column>
  </mj-section>
  <mj-section background-color="${bgColor}" padding="8px 24px 18px" css-class="sf-mobile-pad">
    ${tier("Salida", notes.top)}
    ${tier("Corazón", notes.heart)}
    ${tier("Fondo", notes.base)}
  </mj-section>
`;
};

// Process / "detrás de" block — LLM-driven. Renders only when populated.
const PROCESS_BLOCK = (textColor: string, accentBg: string, block: SkeletonSlots["processBlock"]) => {
  if (!block || !block.paragraphs || block.paragraphs.length === 0) return "";
  return `
    <mj-section background-color="${accentBg}" padding="50px 32px 20px" css-class="sf-mobile-pad">
      <mj-column>
        ${block.eyebrow ? `<mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${textColor}" font-weight="500"><span style="opacity:0.65;">${escapeHtml(block.eyebrow)}</span></mj-text>` : ""}
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="24px" font-weight="500" line-height="1.25" letter-spacing="-0.2px" color="${textColor}" padding-top="12px">${escapeHtml(block.headline)}</mj-text>
      </mj-column>
    </mj-section>
    ${block.paragraphs.slice(0, 2).map((p, i) => `
      <mj-section background-color="${accentBg}" padding="${i === 0 ? "6px" : "0"} 36px ${i === block.paragraphs.length - 1 ? "46px" : "14px"}" css-class="sf-mobile-pad">
        <mj-column>
          <mj-text align="center" font-size="15px" line-height="1.7" color="${textColor}" css-class="sf-body"><span style="opacity:0.88;">${escapeHtml(p)}</span></mj-text>
        </mj-column>
      </mj-section>`).join("")}
  `;
};

// Founder / team note. LLM-driven.
const FOUNDER_NOTE = (textColor: string, bgColor: string, note: SkeletonSlots["founderNote"]) => {
  if (!note || !note.headline || !note.body) return "";
  return `
    <mj-section background-color="${bgColor}" padding="48px 36px 14px" css-class="sf-mobile-pad">
      <mj-column>
        ${note.eyebrow ? `<mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${textColor}" font-weight="500"><span style="opacity:0.65;">${escapeHtml(note.eyebrow)}</span></mj-text>` : ""}
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="22px" font-weight="500" line-height="1.3" letter-spacing="-0.2px" color="${textColor}" padding-top="14px">${escapeHtml(note.headline)}</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${bgColor}" padding="2px 36px 44px" css-class="sf-mobile-pad">
      <mj-column>
        <mj-text align="center" font-size="15px" line-height="1.7" color="${textColor}" css-class="sf-body"><span style="opacity:0.85;">${escapeHtml(note.body)}</span></mj-text>
      </mj-column>
    </mj-section>
  `;
};

// Numbered 3-card row. Reusable for both app-promo-gradient's "benefits" and
// countdown-urgency's "urgency reasons" — same visual, different copy.
const NUMBERED_ROW_3 = (textColor: string, bgColor: string, items: Array<{ title: string; copy: string }> | undefined, eyebrow?: string, headline?: string) => {
  if (!items || items.length === 0) return "";
  const cells = items.slice(0, 3);
  return `
    ${eyebrow || headline ? `
      <mj-section background-color="${bgColor}" padding="44px 16px 24px" css-class="sf-mobile-pad">
        <mj-column>
          ${eyebrow ? `<mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${textColor}" font-weight="500"><span style="opacity:0.65;">${escapeHtml(eyebrow)}</span></mj-text>` : ""}
          ${headline ? `<mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="26px" font-weight="500" line-height="1.2" letter-spacing="-0.3px" color="${textColor}" padding-top="10px">${escapeHtml(headline)}</mj-text>` : ""}
        </mj-column>
      </mj-section>
    ` : ""}
    <mj-section background-color="${bgColor}" padding="0 8px 38px" css-class="sf-mobile-pad">
      ${cells.map((it, i) => `
        <mj-column width="33.33%" padding="12px">
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="32px" font-weight="200" color="${textColor}" line-height="1"><span style="opacity:0.5;">${String(i + 1).padStart(2, "0")}</span></mj-text>
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="15px" font-weight="500" color="${textColor}" padding-top="10px">${escapeHtml(it.title)}</mj-text>
          <mj-text align="center" font-size="13px" line-height="1.55" color="${textColor}" padding-top="6px"><span style="opacity:0.7;">${escapeHtml(it.copy)}</span></mj-text>
        </mj-column>
      `).join("")}
    </mj-section>
  `;
};

// Section divider — used between blocks so the email reads as distinct
// chapters rather than one long scroll.
const SECTION_DIVIDER = (color: string, bgColor: string) => `
  <mj-section background-color="${bgColor}" padding="8px 0">
    <mj-column>
      <mj-divider border-color="${color}" border-width="1px" css-class="sf-divider" padding="0 42%" />
    </mj-column>
  </mj-section>
`;

// Promo / code banner. Only renders when the LLM supplied a real promo code.
// We no longer invent codes like "DIVAIN55" — that would create fake codes
// recipients can't actually use at checkout.
const PROMO_BAND = (primaryColor: string, bgColor: string, promo: SkeletonSlots["promoCode"]) => {
  if (!promo || !promo.code) return "";
  return `
  <mj-section background-color="${primaryColor}" padding="22px 24px" css-class="sf-mobile-pad">
    <mj-column>
      ${promo.label ? `<mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${bgColor}"><span style="opacity:0.75;">${escapeHtml(promo.label)}</span></mj-text>` : ""}
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="22px" font-weight="700" letter-spacing="6px" color="${bgColor}" padding-top="6px">${escapeHtml(promo.code)}</mj-text>
    </mj-column>
  </mj-section>
`;
};

const HEAD = `
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Inter, Helvetica, Arial, sans-serif" />
      <mj-class name="sf-pad" padding="0 16px" />
    </mj-attributes>
    <mj-style inline="inline">
      .sf-hero-text { text-shadow: 0 2px 12px rgba(0,0,0,0.45); }
    </mj-style>
    <mj-style>
      /* Mobile reset — Gmail iOS / Apple Mail / Outlook iOS render emails at
         600px native and scale to fit, but tap-zoom + paddings stacking up
         crush the layout. This media query trims every section's horizontal
         padding, shrinks oversized type, and ensures hero images stay full-
         bleed so the email reads cleanly without pinch-zoom. */
      @media only screen and (max-width: 480px) {
        /* Universal: every mj-section td gets compact mobile padding. */
        div[style*="600px"] { width: 100% !important; max-width: 100% !important; }
        .mj-outlook-group-fix { width: 100% !important; }
        /* Hero sections with background-url should keep full-bleed sides. */
        .sf-hero-section td { padding: 80px 18px !important; }
        .sf-hero-headline div { font-size: 32px !important; line-height: 1.1 !important; }
        .sf-hero-headline { font-size: 32px !important; }
        .sf-hero-subhead, .sf-hero-subhead div { font-size: 11px !important; letter-spacing: 3px !important; }
        /* Promo + big-number variants. */
        .sf-big-number, .sf-big-number div { font-size: 64px !important; line-height: 1 !important; }
        /* Default content section: short vertical padding, slim 16px sides. */
        .sf-section-pad td { padding: 22px 16px !important; }
        .sf-section-pad-tight td { padding: 14px 16px !important; }
        .sf-section-pad-loose td { padding: 32px 16px !important; }
        /* Sides-only override that preserves whatever vertical padding the
           section already declares — used for content sections that just want
           to slim their sides on mobile. */
        .sf-mobile-pad td { padding-left: 16px !important; padding-right: 16px !important; }
        /* Body copy stays comfortable on small screens. */
        .sf-body, .sf-body div { font-size: 14.5px !important; line-height: 1.55 !important; padding: 0 8px !important; }
        /* Headlines smaller on phone — anything 26-32px on desktop -> 22-26 */
        .sf-h2, .sf-h2 div { font-size: 24px !important; line-height: 1.15 !important; }
        .sf-h1, .sf-h1 div { font-size: 28px !important; line-height: 1.12 !important; }
        /* Edge-to-edge images on mobile. */
        .sf-img-bleed td { padding: 0 !important; }
        .sf-img-bleed img { width: 100% !important; height: auto !important; }
        /* Buttons fill width on mobile so tap target is big. */
        /* CTA pill on mobile: bigger tap target but auto width — full-width
           was turning into a massive cream rectangle on hero photos. */
        .sf-cta a { padding: 14px 28px !important; font-size: 12.5px !important; }
        /* Spotlight image on mobile: cap height so the bottle photo doesn't
           force a 600px scroll for a single product card. */
        .sf-img-bleed img { max-height: 360px !important; object-fit: contain !important; }
      }
    </mj-style>
  </mj-head>
`;

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c] ?? c);
}

function render(template: string, slots: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, k) => slots[k] ?? "");
}

// ── lifestyle-hero ────────────────────────────────────────────────────────
// Full-bleed photo background, white text overlay, big editorial subject,
// single black CTA, brand bar at the foot. Used for Mother's Day, Women's Day,
// brand storytelling.

function lifestyleHero(s: SkeletonSlots): string {
  const headlineHtml = escapeHtml(s.headline).replace(/\n/g, "<br/>");
  // Real divain Klaviyo aesthetic: BACKGROUND PHOTO with text overlaid on top.
  // The headline + subhead sit ON the photo (white type, text-shadow for
  // legibility against any background). Matches the divain campaign style
  // where the offer reads against the model photo.
  const heroSection = s.heroUrl
    ? `<mj-section background-url="${s.heroUrl}" background-size="cover" background-position="center center" background-repeat="no-repeat" padding="60px 30px 130px" css-class="sf-hero-section">
        <mj-column>
          ${HERO_BRAND_OVERLAY(s.brandLogoDarkUrl, s.storefrontUrl)}
          ${s.subhead ? `<mj-text align="center" color="#FFFFFF" font-size="13px" letter-spacing="5px" text-transform="uppercase" font-family="Outfit, Helvetica, Arial, sans-serif" css-class="sf-hero-text sf-hero-subhead" padding-bottom="12px">${escapeHtml(s.subhead)}</mj-text>` : ""}
          <mj-text align="center" color="#FFFFFF" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="54px" font-weight="600" line-height="1.05" css-class="sf-hero-text sf-hero-headline">${headlineHtml}</mj-text>
          <mj-spacer height="20px" />
          ${PILL_BUTTON(s.ctaLabel, s.bgColor, s.primaryColor, s.ctaUrl ?? "#")}
        </mj-column>
      </mj-section>`
    : `<mj-section background-color="${s.bgColor}" padding="80px 30px 32px" css-class="sf-hero-section">
        <mj-column>
          ${s.subhead ? `<mj-text align="center" color="${s.textColor}" font-size="12px" letter-spacing="5px" text-transform="uppercase" font-family="Outfit, Helvetica, Arial, sans-serif" css-class="sf-hero-subhead" padding-bottom="14px"><span style="opacity:0.65;">${escapeHtml(s.subhead)}</span></mj-text>` : ""}
          <mj-text align="center" color="${s.textColor}" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="52px" font-weight="500" line-height="1.05" letter-spacing="-0.5px" css-class="sf-hero-headline">${headlineHtml}</mj-text>
        </mj-column>
      </mj-section>
      ${(s.products ?? [])[0]?.imageUrl ? `<mj-section background-color="${s.bgColor}" padding="0"><mj-column padding="0"><mj-image src="${(s.products ?? [])[0]!.imageUrl}" alt="" padding="0" border-radius="0" href="${(s.products ?? [])[0]!.productUrl ?? s.ctaUrl ?? "#"}" /></mj-column></mj-section>` : ""}
      <mj-section background-color="${s.bgColor}" padding="32px 30px 60px" css-class="sf-mobile-pad">
        <mj-column>
          ${PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#")}
        </mj-column>
      </mj-section>`;

  // Real-product showcase row. When we DO have catalog data, show 3 actual
  // products from the store with their photos and prices. When we don't yet,
  // emit a small hint block so the email isn't just "headline + CTA".
  const products = (s.products ?? []).slice(0, 3);
  const productSection = products.length > 0 ? `
    <mj-section padding="40px 16px 10px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
      <mj-column>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="12px" letter-spacing="3px" text-transform="uppercase" color="${s.textColor}"><span style="opacity:0.7;">Selección destacada</span></mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="10px 12px 40px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
      ${products.map((p) => {
        const href = p.productUrl ?? "#";
        const img = p.imageUrl
          ? `<mj-image src="${p.imageUrl}" alt="${escapeHtml(p.title)}" border-radius="4px" href="${href}" />`
          : `<mj-image src="https://via.placeholder.com/240x300?text=${encodeURIComponent(p.title)}" alt="${escapeHtml(p.title)}" border-radius="4px" href="${href}" />`;
        return `
        <mj-column width="33.33%" padding="8px">
          ${img}
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="13px" color="${s.textColor}" font-weight="500" padding-top="10px"><a href="${href}" style="color:${s.textColor};text-decoration:none;">${escapeHtml(p.title)}</a></mj-text>
          ${p.price ? `<mj-text align="center" font-size="12px" color="${s.textColor}" padding-top="2px"><span style="opacity:0.65;">${escapeHtml(p.price)}</span></mj-text>` : ""}
        </mj-column>
      `;
      }).join("")}
    </mj-section>
  ` : "";

  // Editorial closer section — 2-column layout with copy + supporting visual.
  // Always renders so the email has structural depth beyond hero + CTA.
  const closerSection = `
    <mj-section padding="40px 24px 50px" background-color="#F5F1EA" css-class="sf-mobile-pad">
      <mj-column width="60%">
        <mj-text font-family="Outfit, Helvetica, Arial, sans-serif" font-size="20px" font-weight="500" color="${s.textColor}" line-height="1.35">Cada fragancia, una historia.</mj-text>
        <mj-text font-size="14px" line-height="1.65" color="${s.textColor}" padding-top="12px">Llevamos años perfeccionando las equivalencias. Detrás de cada nota hay un proceso que respeta el original y lo hace accesible. Descubre la colección y elige la que mejor te cuente.</mj-text>
        <mj-spacer height="8px" />
        ${PILL_BUTTON("LEER MÁS", s.primaryColor, s.bgColor, "#")}
      </mj-column>
      <mj-column width="40%" vertical-align="middle">
        ${s.heroUrl ? `<mj-image src="${s.heroUrl}" alt="" border-radius="4px" />` : `<mj-spacer height="120px" />`}
      </mj-column>
    </mj-section>
  `;

  // Caption block sits BELOW the hero photo with the body paragraph (the
  // headline + subhead are now overlaid on the hero photo, so we just need
  // the supporting editorial copy here).
  const captionBlock = s.body ? `
    <mj-section padding="32px 20px 12px" background-color="${s.bgColor}" css-class="sf-mobile-pad">
      <mj-column>
        <mj-text align="center" font-size="15px" line-height="1.6" color="${s.textColor}" css-class="sf-body"><span style="opacity:0.88;">${escapeHtml(s.body)}</span></mj-text>
      </mj-column>
    </mj-section>
  ` : "";

  // When the hero is a real photo, skip the standalone WORDMARK section above
  // — the brand mark is already overlaid INSIDE the hero column (no marco).
  // Without a photo we still need a header so the email starts somewhere.
  const headerSection = s.heroUrl ? "" : WORDMARK(s.textColor, s.brandLogoUrl, s.storefrontUrl);

  // Full structure: header → hero → caption → 3-col products → editorial
  // closer → brand promise (LLM-driven) → 6-product mini-grid → trust bar
  // → brand bar. Promise / trust hide silently if no data.
  const promise = BRAND_PROMISE(s.textColor, "#F5F1EA", s.brandPromise);
  const miniGrid = MINI_GRID_6((s.products ?? []).slice(3, 9), s.textColor, s.bgColor, "También para ti");
  const trustBar = TRUST_BAR(s.textColor, s.bgColor, s.trustItems);

  return `<mjml>${HEAD}<mj-body background-color="${s.bgColor}">
${PREHEADER(s.preheader, s.bgColor)}
${headerSection}
${heroSection}
${captionBlock}
${productSection}
${closerSection}
${promise}
${miniGrid}
${trustBar}
${BRAND_BAR("#FFFFFF", s.storefrontUrl)}
</mj-body></mjml>`;
}

// ── big-number-hero ───────────────────────────────────────────────────────
// White bg with HUGE number (price or %), small offer label, big black CTA.
// Used for Black Friday, "11,99€" promos, hard-sell moments.

function bigNumberHero(s: SkeletonSlots): string {
  const offer = escapeHtml(s.offerNumber ?? s.headline);
  const rawLabel = s.offerLabel ?? s.subhead ?? "de descuento";
  // Long labels like "TODOS LOS PERFUMES A 11,99€" wrap awkwardly with 6px
  // letter-spacing — the trailing "A" jumps to its own line. Tighten the
  // letter-spacing proportionally to the label length so it stays inline.
  const labelLen = rawLabel.length;
  const labelLetterSpacing = labelLen > 24 ? "2px" : labelLen > 18 ? "3px" : labelLen > 12 ? "4px" : "6px";
  const labelFontSize = labelLen > 24 ? "13px" : "15px";
  const label = escapeHtml(rawLabel);
  const body  = escapeHtml(s.body ?? "Solo este fin de semana. Hasta agotar existencias.");

  // Hero block. When a banner photo exists we use it as the section background
  // and lay the giant offer number on top — same energy as the lifestyle-hero
  // but with the price as the dominant element. Without a photo we fall back
  // to a flat cream section so the number still reads clean.
  const heroBlock = s.heroUrl
    ? `<mj-section background-url="${s.heroUrl}" background-size="cover" background-position="center center" background-repeat="no-repeat" padding="48px 24px 100px" css-class="sf-hero-section">
        <mj-column>
          ${HERO_BRAND_OVERLAY(s.brandLogoDarkUrl, s.storefrontUrl)}
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="118px" font-weight="700" line-height="1" color="#FFFFFF" css-class="sf-big-number sf-hero-text">${offer}</mj-text>
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="${labelFontSize}" letter-spacing="${labelLetterSpacing}" text-transform="uppercase" color="#FFFFFF" padding-top="18px" font-weight="500" css-class="sf-hero-text">${label}</mj-text>
          <mj-spacer height="20px" />
          ${PILL_BUTTON(s.ctaLabel, "#FFFFFF", s.primaryColor, s.ctaUrl ?? "#")}
        </mj-column>
      </mj-section>`
    : `<mj-section padding="80px 24px 20px" css-class="sf-mobile-pad">
        <mj-column>
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="118px" font-weight="700" line-height="1" color="${s.primaryColor}" css-class="sf-big-number">${offer}</mj-text>
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="${labelFontSize}" letter-spacing="${labelLetterSpacing}" text-transform="uppercase" color="${s.textColor}" padding-top="18px" font-weight="500">${label}</mj-text>
          <mj-spacer height="20px" />
          ${PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#")}
        </mj-column>
      </mj-section>`;

  // Structure: header → big-number hero → urgency body → promo band (only
  // when LLM gave us a real code) → 3-col product grid → 6-product mini-grid
  // → brand promise → trust bar → brand bar.
  const promoBand = PROMO_BAND(s.primaryColor, s.bgColor, s.promoCode);

  // 3-col product grid using the FIRST 3 catalog products. Same structure as
  // productGridEditorial uses but inlined so big-number-hero owns it.
  const featured = (s.products ?? []).slice(0, 3);
  const productGrid = featured.length > 0 ? `
    <mj-section background-color="${s.bgColor}" padding="50px 24px 10px" css-class="sf-mobile-pad">
      <mj-column>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${s.textColor}" font-weight="500"><span style="opacity:0.65;">En oferta esta semana</span></mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${s.bgColor}" padding="12px 12px 30px" css-class="sf-mobile-pad">
      ${featured.map((p) => {
        const href = p.productUrl ?? "#";
        return `
        <mj-column width="33.33%" padding="6px">
          ${p.imageUrl ? `<mj-image src="${p.imageUrl}" alt="${escapeHtml(p.title)}" border-radius="2px" href="${href}" />` : ""}
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="13px" color="${s.textColor}" font-weight="500" padding-top="10px"><a href="${href}" style="color:${s.textColor};text-decoration:none;">${escapeHtml(p.title)}</a></mj-text>
          ${p.price ? `<mj-text align="center" font-size="12px" color="${s.textColor}" padding-top="2px"><span style="opacity:0.65;">${escapeHtml(p.price)}</span></mj-text>` : ""}
        </mj-column>`;
      }).join("")}
    </mj-section>
  ` : "";

  const miniGrid = MINI_GRID_6((s.products ?? []).slice(3, 9), s.textColor, s.bgColor, "Y también");
  const trustBar = TRUST_BAR(s.textColor, s.bgColor, s.trustItems);
  const promise = BRAND_PROMISE(s.textColor, "#F5F1EA", s.brandPromise);

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: s.heroUrl ? "" : WORDMARK(s.textColor, s.brandLogoUrl, s.storefrontUrl),
    heroBlock,
    body,
    promoBand,
    productGrid,
    miniGrid,
    promise,
    trustBar,
    brandBar: BRAND_BAR("#FFFFFF", s.storefrontUrl),
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
{{heroBlock}}
<mj-section padding="28px 24px 18px" background-color="{{bgColor}}" css-class="sf-mobile-pad">
  <mj-column>
    <mj-text align="center" font-size="14px" line-height="1.55" color="{{textColor}}" css-class="sf-body">{{body}}</mj-text>
  </mj-column>
</mj-section>
{{promoBand}}
{{productGrid}}
{{promise}}
{{miniGrid}}
{{trustBar}}
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── product-grid-editorial ─────────────────────────────────────────────────
// Editorial header + 2 or 3 column grid of curated products + final CTA.
// Used for gift guides, curations, "top 5 perfumes" lists.

function productGridEditorial(s: SkeletonSlots): string {
  const products = (s.products && s.products.length > 0 ? s.products : [
    { title: "Producto destacado", price: "", imageUrl: s.heroUrl || "" },
    { title: "Producto destacado", price: "", imageUrl: s.heroUrl || "" },
    { title: "Producto destacado", price: "", imageUrl: s.heroUrl || "" },
  ]).slice(0, 3);
  const cols = products.map((p) => {
    const href = p.productUrl ?? "#";
    return `
    <mj-column width="33.33%" padding="8px">
      ${p.imageUrl ? `<mj-image src="${p.imageUrl}" alt="${escapeHtml(p.title)}" border-radius="4px" href="${href}" />` : ""}
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="14px" color="${s.textColor}" font-weight="500" padding-top="12px"><a href="${href}" style="color:${s.textColor};text-decoration:none;">${escapeHtml(p.title)}</a></mj-text>
      ${p.price ? `<mj-text align="center" font-size="13px" color="${s.textColor}" padding-top="2px"><span style="opacity:0.6;">${escapeHtml(p.price)}</span></mj-text>` : ""}
    </mj-column>
  `;
  }).join("");

  // Body intro paragraph between the headline and the first product grid —
  // gives the email an editorial voice instead of feeling like a catalogue.
  const introBody = s.body ? `
    <mj-section padding="6px 32px 22px" css-class="sf-mobile-pad" background-color="${s.bgColor}">
      <mj-column>
        <mj-text align="center" font-size="15px" line-height="1.65" color="${s.textColor}" css-class="sf-body"><span style="opacity:0.88;">${escapeHtml(s.body)}</span></mj-text>
      </mj-column>
    </mj-section>
  ` : "";

  // Second 3-col band using the NEXT 3 catalog products if present (we load
  // up to 8 hints so there's headroom). Different eyebrow so it doesn't read
  // as a duplicate.
  const moreProducts = (s.products ?? []).slice(3, 6);
  const moreCols = moreProducts.length > 0 ? `
    <mj-section padding="38px 24px 8px" css-class="sf-mobile-pad" background-color="${s.bgColor}">
      <mj-column>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${s.textColor}" font-weight="500"><span style="opacity:0.65;">Y también para regalar</span></mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="6px 12px 24px" css-class="sf-mobile-pad" background-color="${s.bgColor}">
      ${moreProducts.map((p) => {
        const href = p.productUrl ?? "#";
        return `
        <mj-column width="33.33%" padding="6px">
          ${p.imageUrl ? `<mj-image src="${p.imageUrl}" alt="${escapeHtml(p.title)}" border-radius="2px" href="${href}" />` : ""}
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="13px" color="${s.textColor}" font-weight="500" padding-top="10px"><a href="${href}" style="color:${s.textColor};text-decoration:none;">${escapeHtml(p.title)}</a></mj-text>
          ${p.price ? `<mj-text align="center" font-size="12px" color="${s.textColor}" padding-top="2px"><span style="opacity:0.65;">${escapeHtml(p.price)}</span></mj-text>` : ""}
        </mj-column>`;
      }).join("")}
    </mj-section>
  ` : "";

  const trustBar = TRUST_BAR(s.textColor, s.bgColor, s.trustItems);

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: WORDMARK(s.textColor, s.brandLogoUrl, s.storefrontUrl),
    headline: escapeHtml(s.headline),
    subhead: s.subhead ? `<mj-text align="center" font-size="14px" letter-spacing="3px" text-transform="uppercase" color="${s.textColor}" padding-top="10px"><span style="opacity:0.65;">${escapeHtml(s.subhead)}</span></mj-text>` : "",
    bigHero: s.heroUrl ? `<mj-section padding="20px 0 0" background-color="${s.bgColor}"><mj-column padding="0"><mj-image src="${s.heroUrl}" alt="" padding="0" border-radius="0" /></mj-column></mj-section>` : "",
    introBody,
    cols,
    moreCols,
    cta: PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#"),
    trustBar,
    brandBar: BRAND_BAR("#FFFFFF", s.storefrontUrl),
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
<mj-section padding="36px 24px 8px" css-class="sf-mobile-pad">
  <mj-column>
    <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="32px" font-weight="600" color="{{textColor}}" line-height="1.15">{{headline}}</mj-text>
    {{subhead}}
  </mj-column>
</mj-section>
{{introBody}}
{{bigHero}}
<mj-section padding="24px 16px" css-class="sf-mobile-pad">{{cols}}</mj-section>
{{moreCols}}
<mj-section padding="0 24px 36px" css-class="sf-mobile-pad"><mj-column>{{cta}}</mj-column></mj-section>
{{trustBar}}
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── premium-launch ─────────────────────────────────────────────────────────
// Single product hero · poetic copy · no price · minimal frame. RITUAL drops.

function premiumLaunch(s: SkeletonSlots): string {
  // Process block + notes pyramid are both LLM-driven now. If neither is
  // populated the email is product image + name + CTA + similar + trust +
  // brand bar — still complete, just tighter.
  const processBlock = PROCESS_BLOCK(s.textColor, "#F5F1EA", s.processBlock);
  const similar = MINI_GRID_6((s.products ?? []).slice(1, 7), s.textColor, s.bgColor, "También te puede interesar");

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: WORDMARK(s.textColor, s.brandLogoUrl, s.storefrontUrl),
    headline: escapeHtml(s.headline),
    productImage: (s.productImageUrl ?? s.heroUrl)
      ? `<mj-image src="${s.productImageUrl ?? s.heroUrl}" alt="${escapeHtml(s.productName ?? "")}" padding="0" href="${s.productPageUrl ?? s.ctaUrl ?? "#"}" />`
      : "",
    productName: escapeHtml(s.productName ?? s.headline),
    productCopy: escapeHtml(s.productCopy ?? s.body ?? ""),
    cta: PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#"),
    notes: NOTES_PYRAMID(s.textColor, s.bgColor, s.fragranceNotes),
    story: s.body ? `
      <mj-section background-color="${s.bgColor}" padding="20px 36px 8px" css-class="sf-mobile-pad">
        <mj-column>
          <mj-text align="center" font-size="15px" line-height="1.7" color="${s.textColor}" css-class="sf-body"><span style="opacity:0.88;">${escapeHtml(s.body)}</span></mj-text>
        </mj-column>
      </mj-section>
    ` : "",
    processBlock,
    similar,
    trustBar: TRUST_BAR(s.textColor, s.bgColor, s.trustItems),
    brandBar: BRAND_BAR("#FFFFFF", s.storefrontUrl),
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
<mj-section padding="56px 32px 22px" css-class="sf-mobile-pad"><mj-column>{{productImage}}</mj-column></mj-section>
<mj-section padding="8px 32px" css-class="sf-mobile-pad"><mj-column>
  <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="26px" font-weight="500" letter-spacing="0.5px" color="{{textColor}}">{{productName}}</mj-text>
  <mj-text align="center" font-size="13px" letter-spacing="3px" text-transform="uppercase" color="{{textColor}}" padding-top="10px"><span style="opacity:0.6;">{{productCopy}}</span></mj-text>
</mj-column></mj-section>
{{notes}}
{{story}}
<mj-section padding="28px 32px 30px" css-class="sf-mobile-pad"><mj-column>{{cta}}</mj-column></mj-section>
{{processBlock}}
{{similar}}
{{trustBar}}
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── countdown-urgency ─────────────────────────────────────────────────────
// Black background, all-white type, no photo, single big CTA.

function countdownUrgency(s: SkeletonSlots): string {
  // Urgency reasons — LLM writes them per generation. Block hides if empty.
  // Sits on a white section inside the black email so it pops.
  const urgencyPoints = NUMBERED_ROW_3("#0E0E0E", "#FFFFFF", s.urgencyReasons, "Antes de cerrar");

  // Feature one real product photo from the catalog (the first product hint).
  const product = (s.products ?? [])[0];
  const productCard = product ? `
    <mj-section background-color="#FFFFFF" padding="0">
      <mj-column padding="0">
        <mj-image src="${product.imageUrl}" alt="${escapeHtml(product.title)}" padding="0" border-radius="0" href="${product.productUrl ?? s.ctaUrl ?? "#"}" />
      </mj-column>
    </mj-section>
    <mj-section background-color="#FFFFFF" padding="22px 24px 6px" css-class="sf-mobile-pad">
      <mj-column>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="20px" font-weight="500" color="#0E0E0E">${escapeHtml(product.title)}</mj-text>
        ${product.price ? `<mj-text align="center" font-size="14px" color="#0E0E0E" padding-top="6px"><span style="opacity:0.7;">${escapeHtml(product.price)}</span></mj-text>` : ""}
      </mj-column>
    </mj-section>
    <mj-section background-color="#FFFFFF" padding="14px 24px 42px" css-class="sf-mobile-pad">
      <mj-column>
        ${PILL_BUTTON("COMPRAR AHORA", "#0E0E0E", "#FFFFFF", product.productUrl ?? s.ctaUrl ?? "#")}
      </mj-column>
    </mj-section>
  ` : "";

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, "#000000"),
    wordmark: `<mj-section background-color="#000000" padding="32px 24px 0" css-class="sf-mobile-pad"><mj-column>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="22px" font-weight="700" color="#FFFFFF">divain.</mj-text>
    </mj-column></mj-section>`,
    headline: escapeHtml(s.headline),
    subhead: escapeHtml(s.subhead ?? "Cierre a medianoche"),
    body: escapeHtml(s.body ?? ""),
    cta: PILL_BUTTON(s.ctaLabel, "#FFFFFF", "#000000", s.ctaUrl ?? "#"),
    urgencyPoints,
    productCard,
    brandBar: BRAND_BAR("#FFFFFF", s.storefrontUrl),
  };

  return render(`<mjml>${HEAD}<mj-body background-color="#000000">
{{preheader}}
{{wordmark}}
<mj-section background-color="#000000" padding="48px 24px 18px" css-class="sf-mobile-pad"><mj-column>
  <mj-text align="center" color="#FFFFFF" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="46px" font-weight="700" line-height="1.1" letter-spacing="-0.5px">{{headline}}</mj-text>
  <mj-text align="center" color="#FFFFFF" font-size="14px" letter-spacing="5px" text-transform="uppercase" padding-top="18px"><span style="opacity:0.7;">{{subhead}}</span></mj-text>
</mj-column></mj-section>
<mj-section background-color="#000000" padding="14px 24px 48px" css-class="sf-mobile-pad"><mj-column>
  <mj-text align="center" color="#FFFFFF" font-size="14px" padding-bottom="24px"><span style="opacity:0.8;">{{body}}</span></mj-text>
  {{cta}}
</mj-column></mj-section>
{{urgencyPoints}}
{{productCard}}
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── app-promo-gradient ─────────────────────────────────────────────────────
// Pastel pink gradient · iPhone mockup · two outlined CTAs (App Store + Play).

function appPromoGradient(s: SkeletonSlots): string {
  const heroUrl = s.heroUrl || "";
  // Benefits — LLM-driven. Block hides if not populated.
  const benefits = NUMBERED_ROW_3("#1A1A1A", "#FFFFFF", s.appBenefits, "Qué te llevas", "Más por tener la app");
  const promise = BRAND_PROMISE("#1A1A1A", "#FFFFFF", s.brandPromise);
  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, "#FFFFFF"),
    headline: escapeHtml(s.headline),
    subhead: escapeHtml(s.subhead ?? "Beneficios exclusivos y ofertas que no verás en la web"),
    appStoreBtn: PILL_BUTTON(s.ctaLabel || "DESCARGAR EN APP STORE", "#FFFFFF", "#000000", "#"),
    heroImage: heroUrl ? `<mj-image src="${heroUrl}" alt="" border-radius="8px" />` : "",
    benefits,
    promise,
    brandBar: BRAND_BAR("#FFFFFF", s.storefrontUrl),
  };

  return render(`<mjml>${HEAD}<mj-body background-color="#FFBDCF">
{{preheader}}
<mj-section background-color="#FFBDCF" padding="32px 24px 0" css-class="sf-mobile-pad"><mj-column>
  <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="22px" font-weight="700" color="#1A1A1A">divain.</mj-text>
</mj-column></mj-section>
<mj-section background-color="#FFBDCF" padding="28px 24px 14px" css-class="sf-mobile-pad"><mj-column>
  <mj-text align="center" color="#1A1A1A" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="40px" font-weight="600" line-height="1.1">{{headline}}</mj-text>
  <mj-text align="center" color="#1A1A1A" font-size="14px" letter-spacing="2px" text-transform="uppercase" padding-top="14px">{{subhead}}</mj-text>
</mj-column></mj-section>
<mj-section background-color="#FFBDCF" padding="14px 24px 22px" css-class="sf-mobile-pad"><mj-column>{{heroImage}}</mj-column></mj-section>
<mj-section background-color="#FFBDCF" padding="0 24px 44px" css-class="sf-mobile-pad"><mj-column>{{appStoreBtn}}</mj-column></mj-section>
{{benefits}}
{{promise}}
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── brand-anthology ────────────────────────────────────────────────────────
// 4 pillar blocks. Welcome series, brand storytelling, "discover divain".

function brandAnthology(s: SkeletonSlots): string {
  const pillars = (s.pillarBlurbs ?? [
    { title: "PARFUMS", copy: "Fragancias que cuentan quién eres.", ctaLabel: "DESCUBRIR" },
    { title: "CARE", copy: "Skincare como ritual diario.", ctaLabel: "DESCUBRIR" },
    { title: "HOME", copy: "El aroma que define el hogar.", ctaLabel: "DESCUBRIR" },
    { title: "RITUAL", copy: "Body care premium en edición limitada.", ctaLabel: "DESCUBRIR" },
  ]).slice(0, 4);
  const pillarSections = pillars.map((p, i) => {
    const bg = i % 2 === 0 ? s.bgColor : "#F5F5F5";
    return `
      <mj-section background-color="${bg}" padding="42px 24px" css-class="sf-mobile-pad">
        <mj-column>
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${s.textColor}" font-weight="500">divain. ${escapeHtml(p.title)}</mj-text>
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="22px" font-weight="500" color="${s.textColor}" line-height="1.3" padding-top="12px">${escapeHtml(p.copy)}</mj-text>
          ${p.imageUrl ? `<mj-image src="${p.imageUrl}" alt="" padding-top="18px" />` : ""}
          <mj-spacer height="14px" />
          ${PILL_BUTTON(p.ctaLabel, s.primaryColor, s.bgColor, p.ctaUrl ?? "#")}
        </mj-column>
      </mj-section>
    `;
  }).join("");

  // Welcome / brand-anthology gets the full Klaviyo "discover us" treatment:
  // headline → hero → editorial intro → 4 pillar sections → numbered reasons
  // → review → 6-product mini-grid → trust bar → brand bar.
  const intro = s.body ? `
    <mj-section padding="32px 32px 14px" css-class="sf-mobile-pad" background-color="${s.bgColor}">
      <mj-column>
        <mj-text align="center" font-size="15px" line-height="1.7" color="${s.textColor}" css-class="sf-body"><span style="opacity:0.88;">${escapeHtml(s.body)}</span></mj-text>
      </mj-column>
    </mj-section>
  ` : "";

  // Numbered reasons + brand promise: both LLM-driven, both hide if empty.
  const reasons = NUMBERED_REASONS(s.textColor, s.bgColor, s.reasons, "Por qué nosotros", "Tres razones, sin más");
  const promise = BRAND_PROMISE(s.textColor, "#F5F1EA", s.brandPromise);
  const miniGrid = MINI_GRID_6((s.products ?? []).slice(0, 6), s.textColor, s.bgColor, "Los más queridos");
  const trustBar = TRUST_BAR(s.textColor, s.bgColor, s.trustItems);

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: WORDMARK(s.textColor, s.brandLogoUrl, s.storefrontUrl),
    headline: escapeHtml(s.headline),
    heroImage: s.heroUrl ? `<mj-section padding="0 0 16px" background-color="${s.bgColor}"><mj-column padding="0"><mj-image src="${s.heroUrl}" alt="" padding="0" border-radius="0" /></mj-column></mj-section>` : "",
    intro,
    pillarSections,
    reasons,
    promise,
    miniGrid,
    trustBar,
    brandBar: BRAND_BAR("#FFFFFF", s.storefrontUrl),
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
<mj-section padding="40px 24px 14px" css-class="sf-mobile-pad">
  <mj-column>
    <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="30px" font-weight="600" color="{{textColor}}" line-height="1.2">{{headline}}</mj-text>
  </mj-column>
</mj-section>
{{intro}}
{{heroImage}}
{{pillarSections}}
{{reasons}}
{{promise}}
{{miniGrid}}
{{trustBar}}
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── winback-empathic ───────────────────────────────────────────────────────

function winbackEmpathic(s: SkeletonSlots): string {
  // Edge-to-edge winback hero — no side padding, the photo bleeds out to the
  // 600px email rails so we don't get cream bands on the sides.
  const heroImageBlock = s.heroUrl
    ? `<mj-section padding="0" background-color="#F5F1EA"><mj-column padding="0"><mj-image src="${s.heroUrl}" alt="" padding="0" border-radius="0" /></mj-column></mj-section>`
    : "";

  // Winback should feel personal AND give them concrete things to come back
  // to. New arrivals 3-col + a personal "what changed since you left" block.
  const newArrivals = (s.products ?? []).slice(0, 3);
  const newArrivalsSection = newArrivals.length > 0 ? `
    <mj-section background-color="#F5F1EA" padding="42px 24px 8px" css-class="sf-mobile-pad">
      <mj-column>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="4px" text-transform="uppercase" color="${s.textColor}" font-weight="500"><span style="opacity:0.65;">Lo nuevo desde que no nos veíamos</span></mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#F5F1EA" padding="8px 12px 30px" css-class="sf-mobile-pad">
      ${newArrivals.map((p) => {
        const href = p.productUrl ?? "#";
        return `
        <mj-column width="33.33%" padding="6px">
          ${p.imageUrl ? `<mj-image src="${p.imageUrl}" alt="${escapeHtml(p.title)}" border-radius="2px" href="${href}" />` : ""}
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="13px" color="${s.textColor}" font-weight="500" padding-top="10px"><a href="${href}" style="color:${s.textColor};text-decoration:none;">${escapeHtml(p.title)}</a></mj-text>
          ${p.price ? `<mj-text align="center" font-size="12px" color="${s.textColor}" padding-top="2px"><span style="opacity:0.65;">${escapeHtml(p.price)}</span></mj-text>` : ""}
        </mj-column>`;
      }).join("")}
    </mj-section>
  ` : "";

  // Founder note + brand promise: both LLM-driven, hide if empty.
  const founderNote = FOUNDER_NOTE(s.textColor, s.bgColor, s.founderNote);
  const promise = BRAND_PROMISE(s.textColor, "#FFFFFF", s.brandPromise);

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, "#F5F1EA"),
    wordmark: WORDMARK(s.textColor, s.brandLogoUrl, s.storefrontUrl),
    headline: escapeHtml(s.headline),
    body: escapeHtml(s.body ?? ""),
    heroImage: heroImageBlock,
    incentive: s.customerIncentive ? `<mj-text align="center" font-size="13px" letter-spacing="3px" text-transform="uppercase" color="${s.textColor}" padding-top="6px"><span style="opacity:0.65;">Te guardamos un ${escapeHtml(s.customerIncentive)}</span></mj-text>` : "",
    cta: PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#"),
    newArrivalsSection,
    founderNote,
    promise,
    trustBar: TRUST_BAR(s.textColor, "#F5F1EA", s.trustItems),
    brandBar: BRAND_BAR("#FFFFFF", s.storefrontUrl),
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="#F5F1EA">
{{preheader}}
{{wordmark}}
<mj-section padding="32px 24px 14px" css-class="sf-mobile-pad"><mj-column>
  <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="32px" font-weight="500" color="{{textColor}}" line-height="1.2">{{headline}}</mj-text>
  {{incentive}}
</mj-column></mj-section>
{{heroImage}}
<mj-section padding="22px 20px 8px" css-class="sf-mobile-pad"><mj-column>
  <mj-text align="center" font-size="15px" line-height="1.6" color="{{textColor}}">{{body}}</mj-text>
</mj-column></mj-section>
<mj-section padding="20px 24px 30px" css-class="sf-mobile-pad"><mj-column>{{cta}}</mj-column></mj-section>
{{newArrivalsSection}}
{{founderNote}}
{{promise}}
{{trustBar}}
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── Public API ─────────────────────────────────────────────────────────────

export const SKELETONS: Record<string, (s: SkeletonSlots) => string> = {
  "lifestyle-hero":           lifestyleHero,
  "big-number-hero":          bigNumberHero,
  "product-grid-editorial":   productGridEditorial,
  "premium-launch":           premiumLaunch,
  "countdown-urgency":        countdownUrgency,
  "app-promo-gradient":       appPromoGradient,
  "brand-anthology":          brandAnthology,
  "winback-empathic":         winbackEmpathic,
};

export function renderSkeleton(patternId: string, slots: SkeletonSlots): string {
  const fn = SKELETONS[patternId] ?? lifestyleHero;
  const raw = fn(slots);
  // Inject optional Klaviyo-grade content blocks before BRAND_BAR if the LLM
  // populated them. Order: hero (rendered by the skeleton) → editorial story
  // → product spotlight → existing close → brand bar → legal footer.
  //
  // Skip the spotlight on patterns that ALREADY feature a hero product card
  // or product grid — otherwise the email stacks 4-5 bottle photos. The new
  // structurally-dense patterns each have their own product sections so we
  // skip on most of them now; only patterns whose body is mostly text/photo
  // benefit from the spotlight injection.
  const alreadyHasProducts = new Set([
    "product-grid-editorial",
    "premium-launch",
    "big-number-hero",       // now has its own 3-col grid + 6-mini-grid
    "countdown-urgency",     // now has its own product card
    "winback-empathic",      // now has its own new-arrivals row
    "brand-anthology",       // now has its own 6-mini-grid
  ]).has(patternId);
  const spotlight = alreadyHasProducts ? "" : PRODUCT_SPOTLIGHT(slots);
  const editorial = EDITORIAL_BLOCK(slots);
  // Anchor: the BRAND_BAR's opening tag (black section, padding 22px 0) is
  // emitted by every skeleton just before </mj-body>. Insert the optional
  // blocks right before that anchor so they sit between the email body and
  // the brand bar.
  const enriched = (spotlight || editorial)
    ? raw.replace(/<mj-section background-color="#000000" padding="22px 0"/, `${editorial}${spotlight}<mj-section background-color="#000000" padding="22px 0"`)
    : raw;
  return enriched.replace(/<\/mj-body>/, `${LEGAL_FOOTER(slots)}</mj-body>`);
}
