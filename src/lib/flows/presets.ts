// Pre-built flow templates (welcome series, abandoned cart, etc).
//
// Each preset is a small graph: ordered list of steps, where each step is
// either a delay (wait N hours) or a send (queue an email rendered from an
// MJML template). The engine in `flows/engine.ts` walks the graph step by
// step for each enrolled customer.
//
// Adding a new preset = adding a row here + (optionally) a new
// FlowTrigger enum value if it fires on a previously-unhandled webhook.

import type { FlowTrigger } from "@prisma/client";

export type FlowStepDelay = { type: "delay"; hours: number };
export type FlowStepSend  = {
  type: "send";
  // Spanish copy by default. The send-time render resolves {{...}} placeholders
  // and translates to the recipient's language using the existing pipeline.
  subject: string;
  preheader: string;
  // MJML body — can include {{customer.firstName}}, {{store.storefrontUrl}},
  // {{discountCode}}, {{abandonedCart.checkoutUrl}} etc, resolved at render time.
  mjml: string;
};
export type FlowStep = FlowStepDelay | FlowStepSend;

export type FlowGraph = { steps: FlowStep[] };

export type FlowPreset = {
  id: string;
  name: string;
  description: string;
  trigger: FlowTrigger;
  // Default cooldown — minimum time between re-enrollments for the same customer.
  // 0 means "always allow", any positive number means "skip if customer was
  // enrolled in this flow in the last N hours".
  reEnrollCooldownH: number;
  graph: FlowGraph;
  // Pretty icon name from lucide (rendered in the picker dialog).
  icon: "Heart" | "ShoppingCart" | "Sparkles" | "Clock" | "Bell" | "Gift";
  // Estimated time-to-completion — purely for the UI to show "1h–48h" etc.
  estDuration: string;
};

// ── Skeletons used by flow emails ────────────────────────────────────────────
// Hand-crafted MJML, intentionally lean. Editor will let users swap these out
// later — for now they ship with sensible defaults that match the brand bar
// styling used everywhere else in Sendify.

const baseHead = (palette: { bg: string; text: string; primary: string }) => `
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Outfit, Helvetica, Arial, sans-serif" />
      <mj-text color="${palette.text}" font-size="15px" line-height="1.6" />
      <mj-button background-color="${palette.primary}" color="${palette.bg}" font-weight="500" font-size="13px" letter-spacing="2px" inner-padding="14px 28px" border-radius="0" />
    </mj-attributes>
    <mj-style inline="inline">
      .sf-eyebrow { letter-spacing: 4px; text-transform: uppercase; font-size: 11px; color: ${palette.primary}; }
      .sf-headline { font-size: 36px; line-height: 1.1; font-weight: 300; letter-spacing: -0.5px; }
      .sf-sub { font-size: 14px; color: ${palette.text}; opacity: 0.7; }
    </mj-style>
  </mj-head>
`;

const brandFooter = `
  <mj-section background-color="#000000" padding="22px 0">
    <mj-column width="50%"><mj-text align="center" color="#FFFFFF" font-size="11px" letter-spacing="3px" text-transform="uppercase">divain. parfums</mj-text></mj-column>
    <mj-column width="50%"><mj-text align="center" color="#FFFFFF" font-size="11px" letter-spacing="3px" text-transform="uppercase">divain. care</mj-text></mj-column>
  </mj-section>
  <mj-section background-color="${"{{store.bgColor}}"}" padding="20px 20px 40px">
    <mj-column>
      <mj-text align="center" color="#888" font-size="10px" line-height="1.6">
        {{store.legalName}} · {{store.legalAddress}} · {{store.legalCity}}, {{store.legalCountry}}<br/>
        <a href="{{unsubscribeUrl}}" style="color:#888;text-decoration:underline;">Darme de baja</a>
        · <a href="{{store.privacyUrl}}" style="color:#888;text-decoration:underline;">Privacidad</a>
      </mj-text>
    </mj-column>
  </mj-section>
`;

function wrap(palette: { bg: string; text: string; primary: string }, body: string): string {
  return `<mjml>${baseHead(palette)}<mj-body background-color="${palette.bg}">${body}${brandFooter}</mj-body></mjml>`;
}

// ── Presets ──────────────────────────────────────────────────────────────────

const WELCOME_EMAIL_1 = wrap(
  { bg: "{{store.bgColor}}", text: "{{store.textColor}}", primary: "{{store.primaryColor}}" },
  `
  <mj-section padding="80px 20px 40px">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">BIENVENIDO A LA FAMILIA</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">Hola {{customer.firstName}},<br/>te damos la bienvenida.</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="16px">Nos alegra mucho que te unas. Para empezar, queremos hacerte un regalo: <strong>{{discountCode}}</strong> · 10% en tu primera compra.</mj-text>
      <mj-button href="{{store.storefrontUrl}}?utm_source=sendify&utm_medium=email&utm_campaign=welcome-1" padding-top="32px">DESCUBRIR LA COLECCIÓN</mj-button>
    </mj-column>
  </mj-section>
`,
);

const WELCOME_EMAIL_2 = wrap(
  { bg: "{{store.bgColor}}", text: "{{store.textColor}}", primary: "{{store.primaryColor}}" },
  `
  <mj-section padding="80px 20px 40px">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">NUESTRA HISTORIA</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">Perfumes premium,<br/>sin el precio premium.</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="16px">Más de 300 fragancias inspiradas en los iconos del lujo, formuladas en España con ingredientes de origen francés. Mismo aroma, mismo carácter, una fracción del coste.</mj-text>
      <mj-button href="{{store.storefrontUrl}}/pages/about?utm_source=sendify&utm_medium=email&utm_campaign=welcome-2" padding-top="32px">CONOCER DIVAIN</mj-button>
    </mj-column>
  </mj-section>
`,
);

const ABANDONED_CART_1H = wrap(
  { bg: "{{store.bgColor}}", text: "{{store.textColor}}", primary: "{{store.primaryColor}}" },
  `
  <mj-section padding="80px 20px 40px">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">¿OLVIDASTE ALGO?</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">{{customer.firstName}}, tu carrito<br/>te está esperando.</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="16px">No queremos que te quedes sin lo que ya elegiste. Vuelve cuando quieras — tus productos siguen reservados.</mj-text>
      <mj-button href="{{abandonedCart.checkoutUrl}}" padding-top="32px">RETOMAR MI COMPRA</mj-button>
    </mj-column>
  </mj-section>
`,
);

const ABANDONED_CART_24H = wrap(
  { bg: "{{store.bgColor}}", text: "{{store.textColor}}", primary: "{{store.primaryColor}}" },
  `
  <mj-section padding="80px 20px 40px">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">ÚLTIMA OPORTUNIDAD</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">10% para que vuelvas.</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="16px">Sabemos que a veces hay dudas. Te dejamos un <strong>{{discountCode}}</strong> · 10% de descuento, válido 48 horas, para que termines tu compra sin pensarlo.</mj-text>
      <mj-button href="{{abandonedCart.checkoutUrl}}" padding-top="32px">USAR MI 10%</mj-button>
    </mj-column>
  </mj-section>
`,
);

const POST_PURCHASE_THANK_YOU = wrap(
  { bg: "{{store.bgColor}}", text: "{{store.textColor}}", primary: "{{store.primaryColor}}" },
  `
  <mj-section padding="80px 20px 40px">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">GRACIAS</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">{{customer.firstName}}, ya está<br/>en camino.</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="16px">Tu pedido sale del almacén en las próximas horas. Mientras tanto, queríamos darte las gracias por confiar en nosotros — significa mucho.</mj-text>
    </mj-column>
  </mj-section>
`,
);

const POST_PURCHASE_REVIEW = wrap(
  { bg: "{{store.bgColor}}", text: "{{store.textColor}}", primary: "{{store.primaryColor}}" },
  `
  <mj-section padding="80px 20px 40px">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">UNA PREGUNTA RÁPIDA</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">¿Cómo te va<br/>con tu perfume?</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="16px">Tu opinión nos ayuda a mejorar y orienta a otra gente que está dudando. Si tienes un minuto, nos encantaría leerte.</mj-text>
      <mj-button href="{{store.storefrontUrl}}/pages/review?utm_source=sendify&utm_medium=email&utm_campaign=post-purchase-review" padding-top="32px">DEJAR RESEÑA</mj-button>
    </mj-column>
  </mj-section>
`,
);

const WIN_BACK = wrap(
  { bg: "{{store.bgColor}}", text: "{{store.textColor}}", primary: "{{store.primaryColor}}" },
  `
  <mj-section padding="80px 20px 40px">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">TE ECHAMOS DE MENOS</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">{{customer.firstName}}, ha pasado<br/>tiempo.</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="16px">No queremos perderte. Te dejamos un <strong>{{discountCode}}</strong> · 15% en lo que quieras, sin mínimo, para que vuelvas a descubrir lo último.</mj-text>
      <mj-button href="{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=winback" padding-top="32px">VOLVER AL CATÁLOGO</mj-button>
    </mj-column>
  </mj-section>
`,
);

const BIRTHDAY = wrap(
  { bg: "{{store.bgColor}}", text: "{{store.textColor}}", primary: "{{store.primaryColor}}" },
  `
  <mj-section padding="80px 20px 40px">
    <mj-column>
      <mj-text align="center" css-class="sf-eyebrow">FELIZ CUMPLEAÑOS</mj-text>
      <mj-text align="center" css-class="sf-headline" padding-top="12px">Para ti,<br/>{{customer.firstName}}.</mj-text>
      <mj-text align="center" css-class="sf-sub" padding-top="16px">Es tu día y queríamos celebrarlo contigo. <strong>{{discountCode}}</strong> · 20% en tu próximo pedido, válido 7 días.</mj-text>
      <mj-button href="{{store.storefrontUrl}}/?utm_source=sendify&utm_medium=email&utm_campaign=birthday" padding-top="32px">ELEGIR MI REGALO</mj-button>
    </mj-column>
  </mj-section>
`,
);

export const FLOW_PRESETS: FlowPreset[] = [
  {
    id: "welcome-series",
    name: "Welcome series",
    description: "Da la bienvenida con un descuento de bienvenida + un email de marca a los 3 días.",
    trigger: "WELCOME",
    reEnrollCooldownH: 24 * 365,
    icon: "Heart",
    estDuration: "0h → 72h",
    graph: {
      steps: [
        { type: "send", subject: "Bienvenido a Divain — un regalo para empezar", preheader: "10% en tu primera compra como agradecimiento.", mjml: WELCOME_EMAIL_1 },
        { type: "delay", hours: 72 },
        { type: "send", subject: "La historia detrás de Divain", preheader: "Perfumes premium, sin el precio premium.", mjml: WELCOME_EMAIL_2 },
      ],
    },
  },
  {
    id: "abandoned-cart",
    name: "Carrito abandonado",
    description: "Recupera carritos en 2 toques: recordatorio a la hora + descuento a las 24 h si sigue sin comprar.",
    trigger: "ABANDONED_CART",
    reEnrollCooldownH: 168,
    icon: "ShoppingCart",
    estDuration: "1h → 24h",
    graph: {
      steps: [
        { type: "delay", hours: 1 },
        { type: "send", subject: "{{customer.firstName}}, tu carrito sigue ahí", preheader: "Lo tienes guardado — vuelve cuando quieras.", mjml: ABANDONED_CART_1H },
        { type: "delay", hours: 23 },
        { type: "send", subject: "Un 10% para que vuelvas", preheader: "Tu carrito + un descuento exclusivo de 48 h.", mjml: ABANDONED_CART_24H },
      ],
    },
  },
  {
    id: "post-purchase",
    name: "Post-compra",
    description: "Gracias inmediato + petición de reseña a los 14 días para alimentar el social proof.",
    trigger: "POST_PURCHASE",
    reEnrollCooldownH: 0,
    icon: "Sparkles",
    estDuration: "0h → 14d",
    graph: {
      steps: [
        { type: "send", subject: "Gracias, {{customer.firstName}}", preheader: "Tu pedido sale en breve.", mjml: POST_PURCHASE_THANK_YOU },
        { type: "delay", hours: 14 * 24 },
        { type: "send", subject: "¿Qué tal con tu perfume?", preheader: "30 segundos para contarnos.", mjml: POST_PURCHASE_REVIEW },
      ],
    },
  },
  {
    id: "win-back-90d",
    name: "Win-back 90 días",
    description: "Reactivación con incentivo del 15% para clientes que no compran desde hace 90 días.",
    trigger: "WIN_BACK",
    reEnrollCooldownH: 24 * 180,
    icon: "Clock",
    estDuration: "instant",
    graph: {
      steps: [
        { type: "send", subject: "{{customer.firstName}}, te echamos de menos", preheader: "Un 15% para volver a vernos.", mjml: WIN_BACK },
      ],
    },
  },
  {
    id: "birthday",
    name: "Cumpleaños",
    description: "Regalo del 20% disparado por la fecha de nacimiento del cliente.",
    trigger: "BIRTHDAY",
    reEnrollCooldownH: 24 * 364,
    icon: "Gift",
    estDuration: "instant",
    graph: {
      steps: [
        { type: "send", subject: "Feliz cumpleaños, {{customer.firstName}}", preheader: "Un 20% es tu regalo.", mjml: BIRTHDAY },
      ],
    },
  },
];

export function findPreset(id: string): FlowPreset | undefined {
  return FLOW_PRESETS.find((p) => p.id === id);
}
