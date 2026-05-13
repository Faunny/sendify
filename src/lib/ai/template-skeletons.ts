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
  products?: Array<{ title: string; price: string; imageUrl: string; productUrl?: string }>;
  // Premium launch
  productName?: string;
  productImageUrl?: string;
  productCopy?: string;
  // Countdown / winback
  customerIncentive?: string;  // "-15%"
};

const BRAND_BAR = (textOnDark = "#FFFFFF") => `
  <mj-section background-color="#000000" padding="22px 0">
    <mj-column width="25%"><mj-text align="center" color="${textOnDark}" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="3px" text-transform="uppercase" font-weight="500">divain. PARFUMS</mj-text></mj-column>
    <mj-column width="25%"><mj-text align="center" color="${textOnDark}" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="3px" text-transform="uppercase" font-weight="500">divain. CARE</mj-text></mj-column>
    <mj-column width="25%"><mj-text align="center" color="${textOnDark}" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="3px" text-transform="uppercase" font-weight="500">divain. HOME</mj-text></mj-column>
    <mj-column width="25%"><mj-text align="center" color="${textOnDark}" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="3px" text-transform="uppercase" font-weight="500">divain. RITUAL</mj-text></mj-column>
  </mj-section>
`;

const PREHEADER = (text: string, bg: string) => `
  <mj-raw><div style="display:none;font-size:1px;color:${bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(text)}</div></mj-raw>
`;

const WORDMARK = (color: string) => `
  <mj-section padding="28px 24px 0">
    <mj-column>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="24px" font-weight="700" color="${color}" letter-spacing="-0.5px">divain.</mj-text>
    </mj-column>
  </mj-section>
`;

const PILL_BUTTON = (label: string, bg: string, color: string, href: string) => `
  <mj-button background-color="${bg}" color="${color}" border-radius="40px" font-family="Inter, Helvetica, Arial, sans-serif" font-size="11px" letter-spacing="1.5px" font-weight="500" inner-padding="14px 36px" text-transform="uppercase" href="${href}">${escapeHtml(label)}</mj-button>
`;

const HEAD = `
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Inter, Helvetica, Arial, sans-serif" />
    </mj-attributes>
    <mj-style inline="inline">
      .sf-hero-text { text-shadow: 0 2px 12px rgba(0,0,0,0.35); }
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
  // When Gemini didn't produce a hero we degrade gracefully to a solid charcoal
  // hero section that still showcases the headline — much better than a broken
  // image icon or empty white space.
  const heroSection = s.heroUrl
    ? `<mj-section background-url="${s.heroUrl}" background-size="cover" background-repeat="no-repeat" padding="180px 30px 180px">
        <mj-column>
          <mj-text align="center" color="#FFFFFF" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="54px" font-weight="600" line-height="1.05" css-class="sf-hero-text">${headlineHtml}</mj-text>
          {{subhead}}
        </mj-column>
      </mj-section>`
    : `<mj-section background-color="${s.primaryColor}" padding="140px 30px 140px">
        <mj-column>
          <mj-text align="center" color="${s.bgColor}" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="48px" font-weight="600" line-height="1.05">${headlineHtml}</mj-text>
          {{subhead}}
        </mj-column>
      </mj-section>`;
  const subheadColor = s.heroUrl ? "#FFFFFF" : s.bgColor;

  // Real-product showcase row. When we DO have catalog data, show 3 actual
  // products from the store with their photos and prices. When we don't yet,
  // emit a small hint block so the email isn't just "headline + CTA".
  const products = (s.products ?? []).slice(0, 3);
  const productSection = products.length > 0 ? `
    <mj-section padding="40px 16px 10px" background-color="${s.bgColor}">
      <mj-column>
        <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="12px" letter-spacing="3px" text-transform="uppercase" color="${s.textColor}" opacity="0.7">Selección destacada</mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="10px 12px 40px" background-color="${s.bgColor}">
      ${products.map((p) => `
        <mj-column width="33.33%" padding="8px">
          ${p.imageUrl ? `<mj-image src="${p.imageUrl}" alt="${escapeHtml(p.title)}" border-radius="4px" />` : `<mj-image src="https://via.placeholder.com/240x300?text=${encodeURIComponent(p.title)}" alt="${escapeHtml(p.title)}" border-radius="4px" />`}
          <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="13px" color="${s.textColor}" font-weight="500" padding-top="10px">${escapeHtml(p.title)}</mj-text>
          ${p.price ? `<mj-text align="center" font-size="12px" color="${s.textColor}" opacity="0.65" padding-top="2px">${escapeHtml(p.price)}</mj-text>` : ""}
        </mj-column>
      `).join("")}
    </mj-section>
  ` : "";

  // Editorial closer section — 2-column layout with copy + supporting visual.
  // Always renders so the email has structural depth beyond hero + CTA.
  const closerSection = `
    <mj-section padding="40px 24px 50px" background-color="#F5F1EA">
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

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: WORDMARK(s.textColor),
    heroSection,
    subhead: s.subhead ? `<mj-text align="center" color="${subheadColor}" font-size="13px" letter-spacing="4px" text-transform="uppercase" font-family="Outfit, Helvetica, Arial, sans-serif" padding-top="18px">${escapeHtml(s.subhead)}</mj-text>` : "",
    body: s.body ? `<mj-text align="center" font-size="15px" line-height="1.65" color="${s.textColor}" padding="0 30px 24px">${escapeHtml(s.body)}</mj-text>` : "",
    cta: PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#"),
    productSection,
    closerSection,
    brandBar: BRAND_BAR(),
    bgColor: s.bgColor,
  };

  const filledHero = heroSection.replace("{{subhead}}", slots.subhead);
  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
${filledHero}
<mj-section padding="50px 24px 30px">
  <mj-column>
    {{body}}
    {{cta}}
  </mj-column>
</mj-section>
{{productSection}}
{{closerSection}}
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── big-number-hero ───────────────────────────────────────────────────────
// White bg with HUGE number (price or %), small offer label, big black CTA.
// Used for Black Friday, "11,99€" promos, hard-sell moments.

function bigNumberHero(s: SkeletonSlots): string {
  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: WORDMARK(s.textColor),
    offerNumber: escapeHtml(s.offerNumber ?? s.headline),
    offerLabel: escapeHtml(s.offerLabel ?? s.subhead ?? "de descuento"),
    body: escapeHtml(s.body ?? "Solo este fin de semana. Hasta agotar existencias."),
    cta: PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#"),
    heroUrl: s.heroUrl || "",
    heroSection: s.heroUrl
      ? `<mj-section padding="20px 24px"><mj-column><mj-image src="${s.heroUrl}" alt="" border-radius="6px" /></mj-column></mj-section>`
      : "",
    brandBar: BRAND_BAR(),
    bgColor: s.bgColor,
    primaryColor: s.primaryColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
<mj-section padding="70px 24px 12px">
  <mj-column>
    <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="118px" font-weight="700" line-height="1" color="{{primaryColor}}">{{offerNumber}}</mj-text>
    <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="15px" letter-spacing="6px" text-transform="uppercase" color="{{textColor}}" padding-top="22px" font-weight="500">{{offerLabel}}</mj-text>
    <mj-text align="center" font-size="13px" color="{{textColor}}" padding-top="10px">{{body}}</mj-text>
  </mj-column>
</mj-section>
<mj-section padding="24px 24px 70px"><mj-column>{{cta}}</mj-column></mj-section>
{{heroSection}}
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
  const cols = products.map((p) => `
    <mj-column width="33.33%" padding="8px">
      ${p.imageUrl ? `<mj-image src="${p.imageUrl}" alt="${escapeHtml(p.title)}" border-radius="4px" />` : ""}
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="14px" color="${s.textColor}" font-weight="500" padding-top="12px">${escapeHtml(p.title)}</mj-text>
      ${p.price ? `<mj-text align="center" font-size="13px" color="${s.textColor}" opacity="0.6" padding-top="2px">${escapeHtml(p.price)}</mj-text>` : ""}
    </mj-column>
  `).join("");

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: WORDMARK(s.textColor),
    headline: escapeHtml(s.headline),
    subhead: s.subhead ? `<mj-text align="center" font-size="14px" letter-spacing="3px" text-transform="uppercase" color="${s.textColor}" opacity="0.65" padding-top="10px">${escapeHtml(s.subhead)}</mj-text>` : "",
    bigHero: s.heroUrl ? `<mj-section padding="20px 24px"><mj-column><mj-image src="${s.heroUrl}" alt="" border-radius="6px" /></mj-column></mj-section>` : "",
    cols,
    cta: PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#"),
    brandBar: BRAND_BAR(),
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
<mj-section padding="50px 24px 10px">
  <mj-column>
    <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="32px" font-weight="600" color="{{textColor}}" line-height="1.15">{{headline}}</mj-text>
    {{subhead}}
  </mj-column>
</mj-section>
{{bigHero}}
<mj-section padding="30px 16px 30px">{{cols}}</mj-section>
<mj-section padding="0 24px 60px"><mj-column>{{cta}}</mj-column></mj-section>
{{brandBar}}
</mj-body></mjml>`, slots);
}

// ── premium-launch ─────────────────────────────────────────────────────────
// Single product hero · poetic copy · no price · minimal frame. RITUAL drops.

function premiumLaunch(s: SkeletonSlots): string {
  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: WORDMARK(s.textColor),
    headline: escapeHtml(s.headline),
    productImage: (s.productImageUrl ?? s.heroUrl)
      ? `<mj-image src="${s.productImageUrl ?? s.heroUrl}" alt="${escapeHtml(s.productName ?? "")}" padding="0" />`
      : "",
    productName: escapeHtml(s.productName ?? s.headline),
    productCopy: escapeHtml(s.productCopy ?? s.body ?? "Edición limitada · 200 unidades"),
    cta: PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#"),
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
<mj-section padding="80px 32px 30px"><mj-column>{{productImage}}</mj-column></mj-section>
<mj-section padding="10px 32px"><mj-column>
  <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="26px" font-weight="500" letter-spacing="0.5px" color="{{textColor}}">{{productName}}</mj-text>
  <mj-text align="center" font-size="13px" letter-spacing="3px" text-transform="uppercase" color="{{textColor}}" opacity="0.6" padding-top="12px">{{productCopy}}</mj-text>
</mj-column></mj-section>
<mj-section padding="40px 32px 110px"><mj-column>{{cta}}</mj-column></mj-section>
</mj-body></mjml>`, slots);
}

// ── countdown-urgency ─────────────────────────────────────────────────────
// Black background, all-white type, no photo, single big CTA.

function countdownUrgency(s: SkeletonSlots): string {
  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, "#000000"),
    wordmark: `<mj-section background-color="#000000" padding="32px 24px 0"><mj-column>
      <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="22px" font-weight="700" color="#FFFFFF">divain.</mj-text>
    </mj-column></mj-section>`,
    headline: escapeHtml(s.headline),
    subhead: escapeHtml(s.subhead ?? "Cierre a medianoche"),
    body: escapeHtml(s.body ?? ""),
    cta: PILL_BUTTON(s.ctaLabel, "#FFFFFF", "#000000", s.ctaUrl ?? "#"),
  };

  return render(`<mjml>${HEAD}<mj-body background-color="#000000">
{{preheader}}
{{wordmark}}
<mj-section background-color="#000000" padding="70px 24px 30px"><mj-column>
  <mj-text align="center" color="#FFFFFF" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="46px" font-weight="700" line-height="1.1" letter-spacing="-0.5px">{{headline}}</mj-text>
  <mj-text align="center" color="#FFFFFF" font-size="14px" letter-spacing="5px" text-transform="uppercase" padding-top="22px" opacity="0.7">{{subhead}}</mj-text>
</mj-column></mj-section>
<mj-section background-color="#000000" padding="20px 24px 80px"><mj-column>
  <mj-text align="center" color="#FFFFFF" font-size="14px" padding-bottom="32px" opacity="0.8">{{body}}</mj-text>
  {{cta}}
</mj-column></mj-section>
</mj-body></mjml>`, slots);
}

// ── app-promo-gradient ─────────────────────────────────────────────────────
// Pastel pink gradient · iPhone mockup · two outlined CTAs (App Store + Play).

function appPromoGradient(s: SkeletonSlots): string {
  const heroUrl = s.heroUrl || "";
  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, "#FFFFFF"),
    headline: escapeHtml(s.headline),
    subhead: escapeHtml(s.subhead ?? "Beneficios exclusivos y ofertas que no verás en la web"),
    appStoreBtn: PILL_BUTTON(s.ctaLabel || "DESCARGAR EN APP STORE", "#FFFFFF", "#000000", "#"),
    heroImage: heroUrl ? `<mj-image src="${heroUrl}" alt="" border-radius="8px" />` : "",
  };

  return render(`<mjml>${HEAD}<mj-body background-color="#FFBDCF">
{{preheader}}
<mj-section background-color="#FFBDCF" padding="32px 24px 0"><mj-column>
  <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="22px" font-weight="700" color="#1A1A1A">divain.</mj-text>
</mj-column></mj-section>
<mj-section background-color="#FFBDCF" padding="40px 24px 20px"><mj-column>
  <mj-text align="center" color="#1A1A1A" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="40px" font-weight="600" line-height="1.1">{{headline}}</mj-text>
  <mj-text align="center" color="#1A1A1A" font-size="14px" letter-spacing="2px" text-transform="uppercase" padding-top="18px">{{subhead}}</mj-text>
</mj-column></mj-section>
<mj-section background-color="#FFBDCF" padding="20px 24px 30px"><mj-column>{{heroImage}}</mj-column></mj-section>
<mj-section background-color="#FFBDCF" padding="0 24px 70px"><mj-column>{{appStoreBtn}}</mj-column></mj-section>
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
      <mj-section background-color="${bg}" padding="42px 24px">
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

  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, s.bgColor),
    wordmark: WORDMARK(s.textColor),
    headline: escapeHtml(s.headline),
    heroImage: s.heroUrl ? `<mj-section padding="0 24px 16px"><mj-column><mj-image src="${s.heroUrl}" alt="" border-radius="6px" /></mj-column></mj-section>` : "",
    pillarSections,
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="{{bgColor}}">
{{preheader}}
{{wordmark}}
<mj-section padding="40px 24px 14px">
  <mj-column>
    <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="30px" font-weight="600" color="{{textColor}}" line-height="1.2">{{headline}}</mj-text>
  </mj-column>
</mj-section>
{{heroImage}}
{{pillarSections}}
</mj-body></mjml>`, slots);
}

// ── winback-empathic ───────────────────────────────────────────────────────

function winbackEmpathic(s: SkeletonSlots): string {
  const slots: Record<string, string> = {
    preheader: PREHEADER(s.preheader, "#F5F1EA"),
    wordmark: WORDMARK(s.textColor),
    headline: escapeHtml(s.headline),
    body: escapeHtml(s.body ?? "Hemos seguido trabajando estos meses. Pensamos que quizá quieras volver a oler lo que hemos hecho. Si te apetece volver, tu próxima compra lleva un detalle nuestro."),
    heroImage: s.heroUrl ? `<mj-image src="${s.heroUrl}" alt="" padding="0 24px" /></mj-column></mj-section><mj-section padding="20px 24px"><mj-column>` : "",
    incentive: s.customerIncentive ? `<mj-text align="center" font-size="13px" letter-spacing="3px" text-transform="uppercase" color="${s.textColor}" padding-top="6px" opacity="0.65">Te guardamos un ${escapeHtml(s.customerIncentive)}</mj-text>` : "",
    cta: PILL_BUTTON(s.ctaLabel, s.primaryColor, s.bgColor, s.ctaUrl ?? "#"),
    bgColor: s.bgColor,
    textColor: s.textColor,
  };

  return render(`<mjml>${HEAD}<mj-body background-color="#F5F1EA">
{{preheader}}
{{wordmark}}
<mj-section padding="50px 24px 20px"><mj-column>
  <mj-text align="center" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="32px" font-weight="500" color="{{textColor}}" line-height="1.2">{{headline}}</mj-text>
  {{incentive}}
</mj-column></mj-section>
{{heroImage}}
<mj-section padding="20px 36px"><mj-column>
  <mj-text align="center" font-size="14px" line-height="1.7" color="{{textColor}}">{{body}}</mj-text>
</mj-column></mj-section>
<mj-section padding="30px 24px 70px"><mj-column>{{cta}}</mj-column></mj-section>
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
  return fn(slots);
}
