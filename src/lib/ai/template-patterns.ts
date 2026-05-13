// Layout pattern library — distilled from real divain Klaviyo emails. The AI
// generator picks ONE pattern based on the brief and improvises on top. The
// patterns are TYPED so the LLM has structural constraints + creative freedom.
//
// The point: stop the model from spitting out one generic "logo + hero + grid
// + footer" template every single time. Different occasions deserve different
// shapes. Mother's Day shouldn't look like Black Friday shouldn't look like a
// welcome email.

export type LayoutPattern = {
  id: string;
  name: string;
  whenToUse: string;            // brief decision hint for the LLM
  emotionalTone: string;
  visualSignature: string;      // one-line description of what makes it pop
  structureHint: string;        // section-by-section guidance
  ctaLabel: string;             // canonical CTA label for the pattern
  exampleSubject: string;
};

export const LAYOUT_LIBRARY: LayoutPattern[] = [
  {
    id: "lifestyle-hero",
    name: "Lifestyle Hero",
    whenToUse: "Editorial campaigns · women's day · launches · brand storytelling · Mother's Day.",
    emotionalTone: "Cálido, refinado, evocador",
    visualSignature: "Foto FULL-BLEED de mujer en naturaleza (playa, bosque, dunas) como fondo. Texto blanco sobre la foto. Whitespace generoso. Una sola CTA pill negra debajo de la foto.",
    structureHint: `
1. Preheader oculto + brand wordmark (top-left small, NOT centered)
2. <mj-section background-url="...hero.jpg" background-size="cover" padding="160px 24px"> con <mj-text> blanco que dice el OFFER en grande + 1 línea editorial debajo
3. Pequeño separador de aire (mj-spacer 50px)
4. <mj-section> editorial single-column: párrafo de 50-70 palabras + CTA pill negro
5. Brand bar 4-pilares en negro al final
`.trim(),
    ctaLabel: "DESCUBRIR",
    exampleSubject: "Para ellas, lo que merecen",
  },
  {
    id: "big-number-hero",
    name: "Big Number Hero",
    whenToUse: "Hard-sell promos · Black Friday · rebajas · '11,99€' style · Cyber Monday · Buen Fin",
    emotionalTone: "Urgente, directo, sin distracciones",
    visualSignature: "Background sólido (blanco, crema, o pastel suave). El número (precio o %) es ENORME, 92-110px, Outfit 700. Subhead pequeño debajo. Foto producto opcional pero pequeña. CTA pill negro.",
    structureHint: `
1. Preheader + wordmark
2. Hero: <mj-text font-size="98px" font-weight="700" align="center"> con el número solo (ej. "55%" o "11,99€")
3. Subhead 18px uppercase letter-spacing 5px: "DE DESCUENTO" / "TODOS LOS PERFUMES A"
4. Spacer 30px
5. Producto destacado pequeño (200px imagen) o foto lifestyle abajo
6. CTA pill negro grande, full-width o centrado
7. Mini disclaimer 11px gris en pie
`.trim(),
    ctaLabel: "APROVECHAR YA",
    exampleSubject: "55% en todos los perfumes",
  },
  {
    id: "product-grid-editorial",
    name: "Product Grid Editorial",
    whenToUse: "Guías de regalos · curaciones · novedades de pilar · 'top 5 perfumes mujer'",
    emotionalTone: "Curado, sofisticado, sin precios gritados",
    visualSignature: "Header editorial + grid 2 o 3 columnas con producto-foto + nombre + precio pequeño. La foto del producto es la protagonista. Mucho whitespace entre filas.",
    structureHint: `
1. Preheader + wordmark
2. Headline editorial centrado en Outfit 600 32-36px + subhead 14px
3. Grid 2x2 o 3x1 de productos — cada celda: foto cuadrada + nombre 13px + precio 12px gris + mini CTA "Ver"
4. Sección "lee la historia" con CTA pill negro
5. Brand bar al final
`.trim(),
    ctaLabel: "VER COLECCIÓN",
    exampleSubject: "Los 5 perfumes que más recomendamos en mayo",
  },
  {
    id: "app-promo-gradient",
    name: "App Promo Gradient",
    whenToUse: "Descarga app · pushes exclusivos · solo si la promo apunta a app",
    emotionalTone: "Moderno, juvenil, fresco",
    visualSignature: "Gradient bg suave (rosa-crema, melocotón, pastel). Mockup del iPhone como ilustración central. 2 CTAs lado a lado: App Store + Google Play (botones outlined pill, NO el gradient).",
    structureHint: `
1. Preheader + wordmark blanco
2. <mj-section background-color="#FFBDCF" o gradient> con headline blanco 28px "Descarga la app" + 1 línea subhead
3. Imagen iPhone mockup centered, max 280px ancho
4. Sub-bullets editoriales: "Ofertas exclusivas · Push del −10% · Beneficios solo app"
5. Dos botones outlined white: "App Store" + "Google Play" lado a lado
`.trim(),
    ctaLabel: "DESCARGAR APP",
    exampleSubject: "Descarga la app y ahorra un 10% extra",
  },
  {
    id: "brand-anthology",
    name: "Brand Pillar Anthology",
    whenToUse: "Newsletters generales · welcome series · 'descubre divain' · campañas sin oferta concreta",
    emotionalTone: "Editorial, embajadora-de-marca",
    visualSignature: "Hero pequeño con tagline. Después 4 bloques (uno por pilar PARFUMS/CARE/HOME/RITUAL), cada uno con su foto cuadrada + 30 palabras + CTA mini.",
    structureHint: `
1. Wordmark + preheader
2. Hero corto: 1 tagline + 1 imagen mediana lifestyle
3. 4 secciones consecutivas, una por pilar:
   - <mj-section background-color="#000000"> con texto blanco minúsculas "divain. PARFUMS" letter-spacing 4px + texto descriptivo blanco 13px + CTA outlined blanco
   - Luego mj-image de un producto representativo
4. Cierre con CTA principal pill negro: "Explorar la marca"
`.trim(),
    ctaLabel: "EXPLORAR",
    exampleSubject: "Bienvenida a divain.",
  },
  {
    id: "countdown-urgency",
    name: "Countdown Urgency",
    whenToUse: "Última oportunidad · 24h · medianoche · 'envío antes de Navidad'",
    emotionalTone: "Urgente, sin lujo, todo va al CTA",
    visualSignature: "Background NEGRO o muy oscuro. Texto blanco. Headline urgente. NO foto lifestyle. Big CTA dorado/contrastante… (mejor blanco outlined si la marca no quiere gold).",
    structureHint: `
1. Preheader + wordmark blanco
2. <mj-section background-color="#000000" padding="80px 24px">
   - Texto blanco 40px: "ÚLTIMAS 24H"
   - Subhead 18px uppercase: "Cierre a medianoche"
   - Hero corto 1 línea: lo que se acaba (ej. "−40% en perfumes hombre")
3. CTA pill blanco outlined en negro: "COMPRAR YA"
4. Cierre con copy de urgencia: "Acaba a las 23:59 (hora de tu país)"
`.trim(),
    ctaLabel: "COMPRAR YA",
    exampleSubject: "24h. Después se acaba.",
  },
  {
    id: "premium-launch",
    name: "Premium Launch",
    whenToUse: "Lanzamiento set RITUAL · edición limitada · sin precio en hero · pieza de colección",
    emotionalTone: "Luxury minimal · contemplativo",
    visualSignature: "Foto producto sobre fondo crema o piedra. SIN precio. SIN descuento. Solo el producto, su nombre, una frase poética, y un CTA pequeño.",
    structureHint: `
1. Wordmark pequeño top
2. Hero: <mj-image> de la pieza sobre fondo neutral, padding generoso 80px
3. Texto debajo: nombre del producto en Outfit 28px serif-feel + 1 línea evocativa 14px (ej. "Edición limitada · 200 unidades")
4. CTA pequeño outlined "DESCUBRIR LA PIEZA"
5. SIN brand bar (rompe el silencio). Termina con whitespace.
`.trim(),
    ctaLabel: "DESCUBRIR LA PIEZA",
    exampleSubject: "RITUAL · Edición de verano",
  },
  {
    id: "winback-empathic",
    name: "Winback Empathic",
    whenToUse: "Clientes inactivos · 60-120 días sin compra · re-engagement",
    emotionalTone: "Cálido, personal, no agresivo",
    visualSignature: "Background crema #F5F5F5 o blanco roto. Foto warm en tono nostálgico. Copy en primera persona. Descuento mostrado de forma sutil.",
    structureHint: `
1. Wordmark + preheader
2. Headline en Outfit 28px: "Te echamos de menos" o "¿Sigues por aquí?"
3. Hero foto warm 400x300px
4. Párrafo 60-80 palabras tono personal en 1ª persona del plural
5. Mención sutil del incentivo "Tu próxima compra con un -15%"
6. CTA pill negro: "VOLVER A DIVAIN"
7. PD line de cierre: "Si prefieres no recibir más, puedes darte de baja aquí abajo."
`.trim(),
    ctaLabel: "VOLVER A DIVAIN",
    exampleSubject: "Te echamos de menos",
  },
];

// Few-shot examples — 2 real MJML snippets from the LAYOUT_LIBRARY that the
// model can mimic. Kept tight (≤500 tokens each) so we don't blow the context.
export const FEW_SHOT_EXAMPLES = `
EXAMPLE 1 — Pattern "lifestyle-hero" for "Día de la Madre · perfumes mujer · −15%"
-----
{
  "subject": "Para ellas, lo que merecen",
  "preheader": "Selección Día de la Madre con −15% en perfumes mujer. Hasta agotar existencias.",
  "mjml": "<mjml><mj-head><mj-attributes><mj-all font-family=\\"Inter, Helvetica, Arial, sans-serif\\" /></mj-attributes></mj-head><mj-body background-color=\\"#FFFFFF\\"><mj-raw><div style=\\"display:none;font-size:1px;color:#FFFFFF;line-height:1px;\\">Selección Día de la Madre con −15% en perfumes mujer. Hasta agotar existencias.</div></mj-raw><mj-section padding=\\"24px 24px 0\\"><mj-column><mj-text align=\\"left\\" font-family=\\"Outfit\\" font-size=\\"22px\\" font-weight=\\"700\\" color=\\"#1A1A1A\\">divain.</mj-text></mj-column></mj-section><mj-section background-url=\\"https://cdn.divain.space/banners/dia-madre-hero.jpg\\" background-size=\\"cover\\" background-repeat=\\"no-repeat\\" padding=\\"160px 24px\\"><mj-column><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-family=\\"Outfit\\" font-size=\\"56px\\" font-weight=\\"600\\" line-height=\\"1.1\\">Para ellas,<br/>lo que merecen</mj-text><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"14px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\" padding-top=\\"16px\\">15% off · selección día de la madre</mj-text></mj-column></mj-section><mj-section padding=\\"60px 32px\\"><mj-column><mj-text align=\\"center\\" font-size=\\"15px\\" line-height=\\"1.6\\" color=\\"#1A1A1A\\">Hemos elegido las fragancias que mejor cuentan quién es ella. Florales que abrazan, maderosos que reconfortan, cítricos que despiertan. Cada una, un gesto.</mj-text><mj-button background-color=\\"#000000\\" color=\\"#FFFFFF\\" border-radius=\\"40px\\" font-size=\\"11px\\" letter-spacing=\\"1.5px\\" font-weight=\\"500\\" inner-padding=\\"13px 35px\\" padding-top=\\"30px\\" text-transform=\\"uppercase\\" href=\\"#\\">DESCUBRIR LA SELECCIÓN</mj-button></mj-column></mj-section><mj-section background-color=\\"#000000\\" padding=\\"24px 0\\"><mj-column width=\\"25%\\"><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"10px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\">divain. PARFUMS</mj-text></mj-column><mj-column width=\\"25%\\"><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"10px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\">divain. CARE</mj-text></mj-column><mj-column width=\\"25%\\"><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"10px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\">divain. HOME</mj-text></mj-column><mj-column width=\\"25%\\"><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"10px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\">divain. RITUAL</mj-text></mj-column></mj-section></mj-body></mjml>"
}

EXAMPLE 2 — Pattern "big-number-hero" for "Rebajas · 55% en perfumes · Black Friday"
-----
{
  "subject": "55%. Sólo este fin de semana.",
  "preheader": "55% de descuento en toda la colección de perfumes hasta domingo 23:59.",
  "mjml": "<mjml><mj-head><mj-attributes><mj-all font-family=\\"Inter, Helvetica, Arial, sans-serif\\" /></mj-attributes></mj-head><mj-body background-color=\\"#FFFFFF\\"><mj-raw><div style=\\"display:none;font-size:1px;color:#FFFFFF;line-height:1px;\\">55% en toda la colección hasta domingo 23:59.</div></mj-raw><mj-section padding=\\"32px 24px 0\\"><mj-column><mj-text align=\\"center\\" font-family=\\"Outfit\\" font-size=\\"22px\\" font-weight=\\"700\\" color=\\"#1A1A1A\\">divain.</mj-text></mj-column></mj-section><mj-section padding=\\"60px 24px 20px\\"><mj-column><mj-text align=\\"center\\" font-family=\\"Outfit\\" font-size=\\"98px\\" font-weight=\\"700\\" line-height=\\"1\\" color=\\"#1A1A1A\\">55%</mj-text><mj-text align=\\"center\\" font-size=\\"14px\\" letter-spacing=\\"5px\\" text-transform=\\"uppercase\\" color=\\"#1A1A1A\\" padding-top=\\"16px\\">de descuento</mj-text><mj-text align=\\"center\\" font-size=\\"13px\\" color=\\"#666666\\" padding-top=\\"8px\\">en toda la colección · hasta domingo 23:59</mj-text></mj-column></mj-section><mj-section padding=\\"20px 24px 60px\\"><mj-column><mj-button background-color=\\"#000000\\" color=\\"#FFFFFF\\" border-radius=\\"40px\\" font-size=\\"11px\\" letter-spacing=\\"1.5px\\" font-weight=\\"500\\" inner-padding=\\"14px 40px\\" text-transform=\\"uppercase\\" href=\\"#\\">APROVECHAR YA</mj-button></mj-column></mj-section><mj-section background-color=\\"#000000\\" padding=\\"24px 0\\"><mj-column width=\\"25%\\"><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"10px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\">divain. PARFUMS</mj-text></mj-column><mj-column width=\\"25%\\"><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"10px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\">divain. CARE</mj-text></mj-column><mj-column width=\\"25%\\"><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"10px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\">divain. HOME</mj-text></mj-column><mj-column width=\\"25%\\"><mj-text align=\\"center\\" color=\\"#FFFFFF\\" font-size=\\"10px\\" letter-spacing=\\"3px\\" text-transform=\\"uppercase\\">divain. RITUAL</mj-text></mj-column></mj-section></mj-body></mjml>"
}
`;
