// Pre-built flow templates — the Klaviyo-equivalent menu so the owner can stand
// up an entire automation stack with zero clicks beyond "pick a preset, hit
// activate."
//
// Each preset compiles down to:
//   • a trigger (FlowTrigger enum) — the event that enrolls a customer
//   • an optional entry filter — runs at enrollment-time, skips customers that
//     don't match (e.g. VIP welcome only enrolls if totalSpent >= 500)
//   • a linear graph of steps (delay / send / condition)
//
// Adding a preset = adding a row here. No engine changes needed unless you
// invent a new step type or new trigger.

import type { FlowTrigger } from "@prisma/client";

// ── Step types ──────────────────────────────────────────────────────────────

// Every step type carries an optional `enabled` flag (defaults to true) so the
// owner can pause individual emails inside an otherwise-active flow without
// blowing the whole sequence away. Disabled sends skip cleanly (advance to next
// step with no SES call); disabled delays still wait (you'd never want to fast-
// forward a wait timer by accident).

export type FlowStepDelay = { type: "delay"; hours: number; enabled?: boolean };
export type FlowStepSend = {
  type: "send";
  subject: string;
  preheader: string;
  mjml: string;
  enabled?: boolean;
};
// Mid-flow split: evaluate a condition against the customer; on false, exit early.
// Keeps the graph linear — true means "keep going to next step", false means
// "cancel the rest of this enrollment". 90% of Klaviyo splits in practice are
// just "is the customer still a non-buyer / non-opener", which fits this shape.
export type FlowStepCondition = {
  type: "condition";
  field: "customer.ordersCount" | "customer.totalSpent" | "customer.consentStatus" | "customer.hasApp";
  op: "eq" | "neq" | "gte" | "lte" | "gt" | "lt";
  value: number | string | boolean;
  // Human-readable label for the UI flow visualization.
  label: string;
  enabled?: boolean;
};
export type FlowStep = FlowStepDelay | FlowStepSend | FlowStepCondition;

export type FlowGraph = { steps: FlowStep[] };

// ── Entry filter (Klaviyo "filters") ─────────────────────────────────────────
// Evaluated at enrollment time. If the customer doesn't match, no enrollment is
// created (silently — the cooldown still records the attempt to avoid retries).

export type EntryFilter = {
  ordersCountGte?: number;        // customer must have at least N orders
  ordersCountLte?: number;        // customer must have at most N orders
  totalSpentGte?: number;         // customer must have spent at least €X
  consentRequired?: boolean;      // customer must be SUBSCRIBED
  hasAppEq?: boolean;             // customer must (not) have the app
};

// ── Preset shape ─────────────────────────────────────────────────────────────

export type FlowPresetCategory = "Acquisition" | "Cart" | "Retention" | "Win-back" | "Lifecycle";

export type FlowPreset = {
  id: string;
  name: string;
  description: string;
  category: FlowPresetCategory;
  trigger: FlowTrigger;
  reEnrollCooldownH: number;
  graph: FlowGraph;
  entryFilter?: EntryFilter;
  icon: "Heart" | "ShoppingCart" | "Sparkles" | "Clock" | "Bell" | "Gift" | "Eye" | "Star" | "RotateCcw" | "TrendingDown" | "PartyPopper" | "ShoppingBag" | "Mail" | "Award" | "Repeat" | "MoonStar";
  estDuration: string;
};

// ── MJML building blocks ─────────────────────────────────────────────────────
// Hand-crafted blocks so emails share consistent type/spacing while still
// looking visually distinct across presets.

const headerStyle = `
  <mj-attributes>
    <mj-all font-family="Outfit, Helvetica, Arial, sans-serif" />
    <mj-text color="{{store.textColor}}" font-size="15px" line-height="1.6" />
    <mj-button background-color="{{store.primaryColor}}" color="{{store.bgColor}}" font-weight="500" font-size="13px" letter-spacing="2.5px" inner-padding="14px 32px" border-radius="0" />
  </mj-attributes>
  <mj-style inline="inline">
    .sf-eyebrow { letter-spacing: 4px; text-transform: uppercase; font-size: 11px; color: {{store.primaryColor}}; font-weight: 500; }
    .sf-headline { font-size: 38px; line-height: 1.08; font-weight: 300; letter-spacing: -0.5px; }
    .sf-headline-lg { font-size: 56px; line-height: 1; font-weight: 300; letter-spacing: -1px; }
    .sf-headline-sm { font-size: 28px; line-height: 1.1; font-weight: 400; letter-spacing: -0.25px; }
    .sf-sub { font-size: 14.5px; color: {{store.textColor}}; opacity: 0.72; line-height: 1.55; }
    .sf-tiny { font-size: 11px; color: {{store.textColor}}; opacity: 0.55; letter-spacing: 1px; text-transform: uppercase; }
    .sf-divider { border-top: 1px solid {{store.textColor}}; opacity: 0.12; }
    .sf-offer-num { font-size: 110px; line-height: 1; font-weight: 300; letter-spacing: -3px; color: {{store.primaryColor}}; }
    @media only screen and (max-width: 480px) {
      /* Type shrinks so it reads without horizontal scrolling. */
      .sf-headline      { font-size: 28px !important; line-height: 1.1 !important; }
      .sf-headline-lg   { font-size: 36px !important; }
      .sf-headline-sm   { font-size: 22px !important; }
      .sf-offer-num     { font-size: 64px !important; letter-spacing: -2px !important; }
      .sf-sub           { font-size: 14px !important; line-height: 1.55 !important; }
      .sf-eyebrow       { font-size: 10.5px !important; letter-spacing: 3px !important; }
      /* Every section's td gets compact horizontal padding on mobile. The
         attribute selector hits any inline padding-* style emitted by MJML
         and only changes the sides — vertical padding stays intact. */
      .sf-mobile-pad td { padding-left: 16px !important; padding-right: 16px !important; }
      /* Edge-to-edge images on small screens. */
      .sf-img-bleed td  { padding: 0 !important; }
      .sf-img-bleed img { width: 100% !important; height: auto !important; }
      /* Outlook-iOS 600px wrappers — collapse to viewport width. */
      div[style*="600px"] { width: 100% !important; max-width: 100% !important; }
      .mj-outlook-group-fix { width: 100% !important; }
    }
  </mj-style>
`;

const FOOTER = `
  <mj-section background-color="#000000" padding="22px 0">
    <mj-column width="50%"><mj-text align="center" color="#FFFFFF" font-size="11px" letter-spacing="3px" text-transform="uppercase">divain. parfums</mj-text></mj-column>
    <mj-column width="50%"><mj-text align="center" color="#FFFFFF" font-size="11px" letter-spacing="3px" text-transform="uppercase">divain. care</mj-text></mj-column>
  </mj-section>
  <mj-section background-color="{{store.bgColor}}" padding="22px 20px 44px" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" color="#888" font-size="10.5px" line-height="1.7">
        {{store.legalName}} · {{store.legalAddress}} · {{store.legalCity}}, {{store.legalCountry}}<br/>
        <a href="{{unsubscribeUrl}}" style="color:#888;text-decoration:underline;">Darme de baja</a>
        &nbsp;·&nbsp;
        <a href="{{store.privacyUrl}}" style="color:#888;text-decoration:underline;">Privacidad</a>
        &nbsp;·&nbsp;
        <a href="{{store.storefrontUrl}}" style="color:#888;text-decoration:underline;">{{store.storefrontUrl}}</a>
      </mj-text>
    </mj-column>
  </mj-section>
`;

// Top-of-email header. {{store.logoBlock}} is resolved at send-time by the
// flow engine: if the store has a brandLogoUrl it injects an <mj-image>;
// otherwise it falls back to the "divain." wordmark in text. Either way the
// header links to the storefront so a header click goes to the homepage.
const HEADER = `
  <mj-section background-color="{{store.bgColor}}" padding="28px 24px 6px" css-class="sf-mobile-pad">
    <mj-column>
      {{store.logoBlock}}
    </mj-column>
  </mj-section>
`;

function tpl(body: string): string {
  return `<mjml><mj-head>${headerStyle}</mj-head><mj-body background-color="{{store.bgColor}}">${HEADER}${body}${FOOTER}</mj-body></mjml>`;
}

// ── Reusable section helpers ─────────────────────────────────────────────────

const heroCentered = (eyebrow: string, headline: string, sub: string, ctaLabel: string, ctaUrl: string) => `
  <mj-section padding="48px 20px 24px" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">${eyebrow}</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">${headline}</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="14px" padding-left="20px" padding-right="20px">${sub}</mj-text>
      <mj-button href="${ctaUrl}" padding-top="26px">${ctaLabel}</mj-button>
    </mj-column>
  </mj-section>
`;

const heroOffer = (eyebrow: string, offer: string, sub: string, ctaLabel: string, ctaUrl: string) => `
  <mj-section padding="44px 20px 20px" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">${eyebrow}</mj-text>
      <mj-text align="center" css-class="sf-offer-num" padding-top="14px">${offer}</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="10px" padding-left="20px" padding-right="20px">${sub}</mj-text>
      <mj-button href="${ctaUrl}" padding-top="22px">${ctaLabel}</mj-button>
    </mj-column>
  </mj-section>
`;

const heroDark = (eyebrow: string, headline: string, sub: string, ctaLabel: string, ctaUrl: string) => `
  <mj-section background-color="#0E0E0E" padding="64px 20px 52px" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" color="#FFFFFF" font-size="11px" letter-spacing="4px" text-transform="uppercase" font-weight="500" opacity="0.7">${eyebrow}</mj-text>
      <mj-text align="center" color="#FFFFFF" font-size="36px" line-height="1.1" font-weight="300" letter-spacing="-0.5px" padding-top="12px" css-class="sf-headline">${headline}</mj-text>
      <mj-text align="center" color="#CCCCCC" font-size="14.5px" line-height="1.55" padding-top="14px" padding-left="20px" padding-right="20px" css-class="sf-sub">${sub}</mj-text>
      <mj-button background-color="#FFFFFF" color="#0E0E0E" href="${ctaUrl}" padding-top="22px" inner-padding="14px 36px" font-weight="500" font-size="13px" letter-spacing="2.5px" border-radius="0">${ctaLabel}</mj-button>
    </mj-column>
  </mj-section>
`;

const closer = (text: string) => `
  <mj-section padding="0 20px 36px" css-class="sf-mobile-pad">
    <mj-column>
      <mj-text align="center" css-class="sf-tiny" padding-top="14px">${text}</mj-text>
    </mj-column>
  </mj-section>
`;

const incentiveLine = (code: string, copy: string) => `
  <mj-section padding="0 20px 22px" css-class="sf-mobile-pad">
    <mj-column>
      <mj-divider css-class="sf-divider" padding="0" />
      <mj-text align="center" css-class="sf-tiny" padding-top="16px">${copy}</mj-text>
      <mj-text align="center" font-size="22px" letter-spacing="6px" font-weight="500" padding-top="4px" color="{{store.primaryColor}}">${code}</mj-text>
      <mj-divider css-class="sf-divider" padding-top="16px" />
    </mj-column>
  </mj-section>
`;

// ── 16 Klaviyo-equivalent presets ────────────────────────────────────────────

export const FLOW_PRESETS: FlowPreset[] = [

  // ── 1. Welcome series 3-email ───────────────────────────────────────────────
  {
    id: "welcome-series-3",
    name: "Welcome series · 3 emails",
    description: "Bienvenida con descuento + historia de marca al 3er día + social proof al 7º día.",
    category: "Acquisition",
    trigger: "WELCOME",
    reEnrollCooldownH: 24 * 365,
    icon: "Heart",
    estDuration: "0h → 7d",
    graph: {
      steps: [
        { type: "send",
          subject: "Hola {{customer.firstName}} — bienvenido a Divain",
          preheader: "10% para empezar, porque acabas de unirte.",
          mjml: tpl(
            heroCentered(
              "BIENVENIDO A LA FAMILIA",
              "Hola {{customer.firstName}},<br/>nos alegra mucho.",
              "Como agradecimiento por unirte, te dejamos un <strong>10% en tu primera compra</strong>. Sin mínimo, sin truco. Usa el código de abajo en el carrito.",
              "DESCUBRIR LA COLECCIÓN",
              "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=welcome-1",
            ) +
            incentiveLine("{{discountCode}}", "TU CÓDIGO DE BIENVENIDA · 10% · 30 DÍAS"),
          ),
        },
        { type: "delay", hours: 72 },
        { type: "send",
          subject: "La historia detrás de Divain",
          preheader: "Perfumes premium, sin el precio premium.",
          mjml: tpl(
            heroDark(
              "NUESTRA HISTORIA",
              "Perfumes premium,<br/>sin el precio premium.",
              "Más de 300 fragancias inspiradas en los iconos del lujo, formuladas en España con ingredientes franceses. Mismo carácter, mismo concentrado, una fracción del coste.",
              "CONOCER DIVAIN",
              "{{store.storefrontUrl}}/pages/about?utm_source=sendify&utm_medium=email&utm_campaign=welcome-2",
            ),
          ),
        },
        { type: "delay", hours: 96 },
        { type: "send",
          subject: "Lo que dice la gente que ya nos compró",
          preheader: "+ de 80 000 reseñas verificadas.",
          mjml: tpl(
            heroCentered(
              "OPINIONES REALES",
              "&ldquo;Es exactamente igual al original.&rdquo;",
              "Más de 80 000 personas ya han probado Divain. <strong>4.7 / 5</strong> de media en reseñas verificadas. Si todavía dudas, deja que ellos te lo cuenten.",
              "VER OPINIONES",
              "{{store.storefrontUrl}}/pages/reviews?utm_source=sendify&utm_medium=email&utm_campaign=welcome-3",
            ),
          ),
        },
      ],
    },
  },

  // ── 2. Welcome single ──────────────────────────────────────────────────────
  {
    id: "welcome-simple",
    name: "Welcome single email",
    description: "Un solo email de bienvenida con un 15% directo. Para listas pequeñas o si quieres algo low-touch.",
    category: "Acquisition",
    trigger: "WELCOME",
    reEnrollCooldownH: 24 * 365,
    icon: "Mail",
    estDuration: "instant",
    graph: {
      steps: [
        { type: "send",
          subject: "{{customer.firstName}}, 15% para empezar",
          preheader: "Tu primer descuento como nueva persona Divain.",
          mjml: tpl(
            heroOffer(
              "BIENVENIDA",
              "15%",
              "Sin mínimo, sin truco. Aplicable a toda la colección.",
              "USAR MI 15%",
              "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=welcome-single",
            ) +
            incentiveLine("{{discountCode}}", "TU CÓDIGO · 15% · 30 DÍAS"),
          ),
        },
      ],
    },
  },

  // ── 3. Welcome staircase ────────────────────────────────────────────────────
  {
    id: "welcome-staircase",
    name: "Welcome staircase 10→25%",
    description: "4 emails escalando el descuento (10→15→20→25%). Reservado para listas con baja conversión.",
    category: "Acquisition",
    trigger: "WELCOME",
    reEnrollCooldownH: 24 * 365,
    icon: "TrendingDown",
    estDuration: "0h → 14d",
    graph: {
      steps: [
        { type: "send",
          subject: "Bienvenido — empieza con un 10%",
          preheader: "Tu primera oferta para conocer Divain.",
          mjml: tpl(heroOffer("BIENVENIDO", "10%", "Para que descubras Divain sin compromiso.", "USAR MI 10%", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=staircase-1") + incentiveLine("{{discountCode}}", "CÓDIGO · 10% · 7 DÍAS")),
        },
        { type: "delay", hours: 96 },
        { type: "condition", field: "customer.ordersCount", op: "eq", value: 0, label: "Sólo si todavía no ha comprado" },
        { type: "send",
          subject: "Subimos a 15% sólo por hoy",
          preheader: "Un empujoncito más por si te decides.",
          mjml: tpl(heroOffer("HOY", "15%", "Subimos la oferta sólo 24 h. Pasa a ver.", "VER LA COLECCIÓN", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=staircase-2") + incentiveLine("{{discountCode}}", "CÓDIGO · 15% · 24 H")),
        },
        { type: "delay", hours: 120 },
        { type: "condition", field: "customer.ordersCount", op: "eq", value: 0, label: "Sigue sin comprar" },
        { type: "send",
          subject: "20% — y bajamos la duda al mínimo",
          preheader: "El descuento más alto que hacemos a un nuevo cliente.",
          mjml: tpl(heroOffer("PENÚLTIMA OFERTA", "20%", "Sabemos que dudas. Te lo ponemos fácil con la oferta más alta que hacemos a nuevos clientes.", "ELEGIR PRODUCTO", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=staircase-3") + incentiveLine("{{discountCode}}", "CÓDIGO · 20% · 48 H")),
        },
        { type: "delay", hours: 120 },
        { type: "condition", field: "customer.ordersCount", op: "eq", value: 0, label: "Última oportunidad" },
        { type: "send",
          subject: "25% — última oferta y desaparece",
          preheader: "Después ya no podemos bajar más.",
          mjml: tpl(heroOffer("ÚLTIMA OPORTUNIDAD", "25%", "Es el mayor descuento que ofrecemos. Tras esto, vuelves a precio normal.", "USAR MI 25%", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=staircase-4") + incentiveLine("{{discountCode}}", "CÓDIGO · 25% · 72 H")),
        },
      ],
    },
  },

  // ── 4. Abandoned cart 3-email ──────────────────────────────────────────────
  {
    id: "abandoned-cart-3",
    name: "Carrito abandonado · 3 emails",
    description: "1h recordatorio amable + 24h con 10% + 72h última oportunidad con 15%.",
    category: "Cart",
    trigger: "ABANDONED_CART",
    reEnrollCooldownH: 168,
    icon: "ShoppingCart",
    estDuration: "1h → 72h",
    graph: {
      steps: [
        { type: "delay", hours: 1 },
        { type: "send",
          subject: "{{customer.firstName}}, tu carrito sigue ahí",
          preheader: "Lo guardamos por si quieres volver.",
          mjml: tpl(heroCentered("¿OLVIDASTE ALGO?", "Tu carrito te<br/>está esperando.", "No queremos que pierdas lo que ya elegiste. Tus productos siguen reservados — vuelve cuando quieras.", "RETOMAR MI COMPRA", "{{abandonedCart.checkoutUrl}}")),
        },
        { type: "delay", hours: 23 },
        { type: "send",
          subject: "Un 10% para que termines",
          preheader: "48 horas · cuenta atrás iniciada.",
          mjml: tpl(heroOffer("PARA TI", "10%", "Aplicado automáticamente al volver a tu carrito. Válido 48 h.", "TERMINAR CON 10%", "{{abandonedCart.checkoutUrl}}") + incentiveLine("{{discountCode}}", "CÓDIGO · 10% · 48 H")),
        },
        { type: "delay", hours: 48 },
        { type: "send",
          subject: "Última oportunidad · 15% y desaparece",
          preheader: "Después devolvemos tu reserva al stock.",
          mjml: tpl(heroDark("ÚLTIMA LLAMADA", "15% — pero hasta<br/>mañana.", "Después de mañana liberamos tu carrito y este descuento desaparece. Si lo quieres, ahora es el momento.", "USAR MI 15%", "{{abandonedCart.checkoutUrl}}") + incentiveLine("{{discountCode}}", "CÓDIGO · 15% · 24 H")),
        },
      ],
    },
  },

  // ── 5. Abandoned cart simple ───────────────────────────────────────────────
  {
    id: "abandoned-cart-simple",
    name: "Carrito abandonado · 1 email",
    description: "Un único recordatorio a la hora. Para no saturar a tu base.",
    category: "Cart",
    trigger: "ABANDONED_CART",
    reEnrollCooldownH: 168,
    icon: "ShoppingBag",
    estDuration: "1h",
    graph: {
      steps: [
        { type: "delay", hours: 1 },
        { type: "send",
          subject: "{{customer.firstName}}, ¿te ayudamos a terminar?",
          preheader: "Tu carrito sigue guardado por si vuelves.",
          mjml: tpl(heroCentered("TU CARRITO", "Lo dejamos aquí<br/>por si vuelves.", "Sabemos que a veces uno se distrae. Tu selección sigue reservada — termina cuando quieras.", "RETOMAR MI COMPRA", "{{abandonedCart.checkoutUrl}}")),
        },
      ],
    },
  },

  // ── 6. Browse abandonment ──────────────────────────────────────────────────
  {
    id: "browse-abandonment",
    name: "Producto visto sin compra",
    description: "Recordatorio 1h y, si sigue sin comprar, descuento 24h después. Trigger: pixel de tienda.",
    category: "Cart",
    trigger: "BROWSE_ABANDONMENT",
    reEnrollCooldownH: 72,
    icon: "Eye",
    estDuration: "1h → 24h",
    graph: {
      steps: [
        { type: "delay", hours: 1 },
        { type: "send",
          subject: "{{customer.firstName}}, te quedaste mirando algo…",
          preheader: "Te ayudamos a decidirte.",
          mjml: tpl(heroCentered("LO QUE VISTE", "Aún tienes tiempo<br/>de decidirte.", "Vimos que te interesaste por algo en nuestra tienda. Si tienes dudas, escríbenos — y si te decides, está aquí.", "VOLVER A VERLO", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=browse-1")),
        },
        { type: "delay", hours: 23 },
        { type: "condition", field: "customer.ordersCount", op: "eq", value: 0, label: "Sigue sin comprar" },
        { type: "send",
          subject: "10% por si te decides hoy",
          preheader: "Pequeño empujón para terminar la duda.",
          mjml: tpl(heroOffer("HOY", "10%", "Un descuento exclusivo válido sólo 24 h, aplicable a toda la colección.", "USAR MI 10%", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=browse-2") + incentiveLine("{{discountCode}}", "CÓDIGO · 10% · 24 H")),
        },
      ],
    },
  },

  // ── 7. Post-purchase thank-you + review ────────────────────────────────────
  {
    id: "post-purchase",
    name: "Post-compra · gracias + reseña",
    description: "Gracias inmediato + petición de reseña a los 14 días para alimentar social proof.",
    category: "Retention",
    trigger: "POST_PURCHASE",
    reEnrollCooldownH: 0,
    icon: "Sparkles",
    estDuration: "0h → 14d",
    graph: {
      steps: [
        { type: "send",
          subject: "Gracias, {{customer.firstName}}",
          preheader: "Tu pedido sale del almacén en breve.",
          mjml: tpl(heroCentered("GRACIAS", "Tu pedido ya<br/>está en camino.", "Salimos del almacén en las próximas horas. Mientras tanto, queríamos darte las gracias por confiar en nosotros — significa mucho.", "VER MI PEDIDO", "{{store.storefrontUrl}}/account/orders?utm_source=sendify&utm_medium=email&utm_campaign=postpurchase-1")),
        },
        { type: "delay", hours: 14 * 24 },
        { type: "send",
          subject: "¿Cómo te va con tu perfume?",
          preheader: "30 segundos para contarnos.",
          mjml: tpl(heroCentered("TU OPINIÓN CUENTA", "¿Cómo te va<br/>con tu perfume?", "Tu opinión orienta a otra gente que está dudando. Si tienes un minuto, nos encantaría leerte.", "DEJAR RESEÑA", "{{store.storefrontUrl}}/pages/review?utm_source=sendify&utm_medium=email&utm_campaign=postpurchase-2")),
        },
      ],
    },
  },

  // ── 8. First-time purchaser onboarding ─────────────────────────────────────
  {
    id: "first-purchase-onboarding",
    name: "Primer cliente · onboarding 3 emails",
    description: "Para clientes en su primer pedido: gracias + cómo usarlo + invitación VIP a los 21 d. Filtro: ordersCount = 1.",
    category: "Retention",
    trigger: "POST_PURCHASE",
    reEnrollCooldownH: 24 * 365,
    entryFilter: { ordersCountLte: 1 },
    icon: "PartyPopper",
    estDuration: "0h → 21d",
    graph: {
      steps: [
        { type: "send",
          subject: "Tu primer pedido en Divain — gracias",
          preheader: "Aquí empieza tu historia con nosotros.",
          mjml: tpl(heroCentered("TU PRIMER PEDIDO", "{{customer.firstName}}, gracias<br/>por unirte.", "Eres parte de la familia desde hoy. En las próximas semanas te iremos contando trucos para sacarle más a tu perfume.", "EXPLORAR LA COLECCIÓN", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=first-1")),
        },
        { type: "delay", hours: 7 * 24 },
        { type: "send",
          subject: "Trucos para que tu perfume dure el doble",
          preheader: "Lo que casi nadie sabe sobre aplicar perfume.",
          mjml: tpl(heroCentered("APRENDE A USARLO", "Lo que casi nadie<br/>te cuenta.", "Aplicar después de la ducha, en puntos de pulso, sin frotar. Tres trucos sencillos que doblan la duración de cualquier fragancia.", "LEER LA GUÍA", "{{store.storefrontUrl}}/blog/guia-perfume?utm_source=sendify&utm_medium=email&utm_campaign=first-2")),
        },
        { type: "delay", hours: 14 * 24 },
        { type: "send",
          subject: "Ya eres VIP — descúbrelo",
          preheader: "Por ser de la casa, te invitamos al programa VIP.",
          mjml: tpl(heroDark("BIENVENIDO AL CLUB", "Ya eres uno<br/>de nosotros.", "Por confiar en Divain desde el primer pedido, te abrimos el programa VIP: acceso anticipado, regalos sorpresa y un 10% permanente.", "ENTRAR EN VIP", "{{store.storefrontUrl}}/pages/vip?utm_source=sendify&utm_medium=email&utm_campaign=first-3")),
        },
      ],
    },
  },

  // ── 9. Cross-sell at 30d ───────────────────────────────────────────────────
  {
    id: "cross-sell-30d",
    name: "Cross-sell · 30 días después",
    description: "Recomienda fragancias complementarias 30 días después del pedido.",
    category: "Retention",
    trigger: "POST_PURCHASE",
    reEnrollCooldownH: 24 * 60,
    icon: "Repeat",
    estDuration: "30d",
    graph: {
      steps: [
        { type: "delay", hours: 30 * 24 },
        { type: "send",
          subject: "Combinamos tu perfume con otro",
          preheader: "Selección hecha a mano para ti.",
          mjml: tpl(heroCentered("PARA TU COLECCIÓN", "Si te gustó ese,<br/>esto también.", "Una selección de fragancias que combinan bien con lo que ya pediste — perfumes para tu armario, no para el cajón.", "VER RECOMENDACIONES", "{{store.storefrontUrl}}/collections/recomendados?utm_source=sendify&utm_medium=email&utm_campaign=cross-sell")),
        },
      ],
    },
  },

  // ── 10. Replenishment 60d ──────────────────────────────────────────────────
  {
    id: "replenishment-60d",
    name: "Repón tu perfume · 60d después",
    description: "Suave recordatorio + 10% para reponer 60 días después de la primera compra.",
    category: "Retention",
    trigger: "POST_PURCHASE",
    reEnrollCooldownH: 24 * 90,
    icon: "RotateCcw",
    estDuration: "60d",
    graph: {
      steps: [
        { type: "delay", hours: 60 * 24 },
        { type: "send",
          subject: "{{customer.firstName}}, ¿necesitas reponer?",
          preheader: "Te ahorramos 10% en tu siguiente bote.",
          mjml: tpl(heroOffer("REPONER", "10%", "Si ya te queda poco, ahora es el momento de pedir el siguiente. Te dejamos un 10% exclusivo para clientes habituales.", "PEDIR EL SIGUIENTE", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=replenish") + incentiveLine("{{discountCode}}", "CÓDIGO · 10% · 14 DÍAS")),
        },
      ],
    },
  },

  // ── 11. VIP welcome (totalSpent >= 500) ────────────────────────────────────
  {
    id: "vip-welcome",
    name: "VIP welcome · cliente premium",
    description: "Bienvenida al programa VIP cuando un cliente supera 500€ acumulados. Filtro de entrada.",
    category: "Retention",
    trigger: "POST_PURCHASE",
    reEnrollCooldownH: 24 * 365,
    entryFilter: { totalSpentGte: 500 },
    icon: "Award",
    estDuration: "instant",
    graph: {
      steps: [
        { type: "send",
          subject: "{{customer.firstName}}, bienvenido al club VIP",
          preheader: "Tu fidelidad merece algo más.",
          mjml: tpl(heroDark("CLUB VIP DIVAIN", "{{customer.firstName}}, ya eres<br/>VIP oficial.", "Por superar 500€ con nosotros, te abrimos las puertas: acceso anticipado a lanzamientos, regalos sorpresa cada trimestre y un 10% permanente en todo.", "VER MIS BENEFICIOS", "{{store.storefrontUrl}}/pages/vip?utm_source=sendify&utm_medium=email&utm_campaign=vip-welcome")),
        },
      ],
    },
  },

  // ── 12. Win-back 60d ───────────────────────────────────────────────────────
  {
    id: "winback-60d",
    name: "Win-back · 60 días inactivo",
    description: "Reactivación suave con 10% para clientes sin actividad 60 días.",
    category: "Win-back",
    trigger: "WIN_BACK",
    reEnrollCooldownH: 24 * 180,
    icon: "Clock",
    estDuration: "instant",
    graph: {
      steps: [
        { type: "send",
          subject: "{{customer.firstName}}, te echamos de menos",
          preheader: "10% para volver a vernos.",
          mjml: tpl(heroCentered("VUELVE A CASA", "Ha pasado un tiempo<br/>desde la última vez.", "Te dejamos un 10% para volver a ver lo último. Sin presión — cuando quieras, está aquí.", "VOLVER AL CATÁLOGO", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=winback-60") + incentiveLine("{{discountCode}}", "CÓDIGO · 10% · 14 DÍAS")),
        },
      ],
    },
  },

  // ── 13. Win-back staircase 120d ────────────────────────────────────────────
  {
    id: "winback-staircase",
    name: "Win-back staircase · 120 días",
    description: "3 emails staircase 10→20→30% para clientes muy fríos.",
    category: "Win-back",
    trigger: "WIN_BACK",
    reEnrollCooldownH: 24 * 365,
    icon: "TrendingDown",
    estDuration: "0h → 14d",
    graph: {
      steps: [
        { type: "send",
          subject: "Ha pasado tiempo · 10% por si vuelves",
          preheader: "Lo último que has lanzado merece tu mirada.",
          mjml: tpl(heroOffer("DESPUÉS DE TANTO", "10%", "Volver es fácil. Te dejamos un 10% para que conozcas lo nuevo.", "VOLVER", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=winback-stair-1") + incentiveLine("{{discountCode}}", "CÓDIGO · 10% · 7 DÍAS")),
        },
        { type: "delay", hours: 96 },
        { type: "condition", field: "customer.ordersCount", op: "eq", value: 0, label: "Sigue sin volver" },
        { type: "send",
          subject: "Subimos a 20% — el dato es claro",
          preheader: "Tu interés vale más que mantener el margen.",
          mjml: tpl(heroOffer("AHORA", "20%", "Sabemos que necesitas un empujón mayor. Te lo damos.", "USAR MI 20%", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=winback-stair-2") + incentiveLine("{{discountCode}}", "CÓDIGO · 20% · 5 DÍAS")),
        },
        { type: "delay", hours: 120 },
        { type: "condition", field: "customer.ordersCount", op: "eq", value: 0, label: "Última puerta abierta" },
        { type: "send",
          subject: "30% — lo más alto que hacemos",
          preheader: "Esta es la última que verás de nosotros si no vuelves.",
          mjml: tpl(heroDark("ÚLTIMA OPORTUNIDAD", "30%", "Es el techo de descuento que ofrecemos. Después dejamos de molestarte un buen tiempo.", "USAR MI 30%", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=winback-stair-3") + incentiveLine("{{discountCode}}", "CÓDIGO · 30% · 72 H")),
        },
      ],
    },
  },

  // ── 14. Sunset flow ────────────────────────────────────────────────────────
  {
    id: "sunset",
    name: "Sunset · marcar como dormido",
    description: "180 días sin actividad: 1 email final + auto-suppress si no engancha. Limpia la lista y protege la reputación.",
    category: "Win-back",
    trigger: "WIN_BACK",
    reEnrollCooldownH: 24 * 365,
    icon: "MoonStar",
    estDuration: "0h → 5d",
    graph: {
      steps: [
        { type: "send",
          subject: "¿Sigues con nosotros, {{customer.firstName}}?",
          preheader: "Si no respondes, te dejamos descansar.",
          mjml: tpl(heroCentered("UNA ÚLTIMA PREGUNTA", "¿Quieres seguir<br/>recibiendo Divain?", "Si todavía te interesa lo que hacemos, dale al botón para que sepamos que sigues ahí. Si no, no hace falta hacer nada — te dejamos descansar.", "SÍ, SIGO AQUÍ", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=sunset")),
        },
      ],
    },
  },

  // ── 15. Birthday ────────────────────────────────────────────────────────────
  {
    id: "birthday",
    name: "Cumpleaños · 20%",
    description: "Regalo del 20% para celebrar. Trigger manual (segmento de cumpleañeros).",
    category: "Lifecycle",
    trigger: "BIRTHDAY",
    reEnrollCooldownH: 24 * 364,
    icon: "Gift",
    estDuration: "instant",
    graph: {
      steps: [
        { type: "send",
          subject: "Feliz cumpleaños, {{customer.firstName}}",
          preheader: "Un regalo nuestro para tu día.",
          mjml: tpl(heroOffer("HOY ES TU DÍA", "20%", "Es tu día y queríamos celebrarlo contigo. Válido los próximos 7 días en todo el catálogo.", "ELEGIR MI REGALO", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=birthday") + incentiveLine("{{discountCode}}", "CÓDIGO CUMPLEAÑOS · 20% · 7 DÍAS")),
        },
      ],
    },
  },

  // ── 16. Back-in-stock ──────────────────────────────────────────────────────
  {
    id: "restock-alert",
    name: "Stock disponible · back-in-stock",
    description: "Cuando un producto vuelve a tener stock, avisa a quienes lo querían.",
    category: "Lifecycle",
    trigger: "RESTOCK",
    reEnrollCooldownH: 24,
    icon: "Bell",
    estDuration: "instant",
    graph: {
      steps: [
        { type: "send",
          subject: "Ya está disponible otra vez",
          preheader: "Lo que esperabas vuelve a tener stock.",
          mjml: tpl(heroCentered("DE VUELTA", "Lo tienes disponible<br/>otra vez.", "Vuelve a estar en stock. Pero no tarda — si te lo pides ahora, te llega esta semana.", "PEDIRLO", "{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=restock")),
        },
      ],
    },
  },
];

export function findPreset(id: string): FlowPreset | undefined {
  return FLOW_PRESETS.find((p) => p.id === id);
}

export const PRESETS_BY_CATEGORY: Record<FlowPresetCategory, FlowPreset[]> = {
  "Acquisition": FLOW_PRESETS.filter((p) => p.category === "Acquisition"),
  "Cart":        FLOW_PRESETS.filter((p) => p.category === "Cart"),
  "Retention":   FLOW_PRESETS.filter((p) => p.category === "Retention"),
  "Win-back":    FLOW_PRESETS.filter((p) => p.category === "Win-back"),
  "Lifecycle":   FLOW_PRESETS.filter((p) => p.category === "Lifecycle"),
};
