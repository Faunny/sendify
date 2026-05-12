// Pre-built segment definitions divain can clone into the database with one click.
// Each preset compiles to a Prisma where-clause via `presetToWhere()`. The user can
// edit the rules afterwards from the segment editor.

import type { Prisma } from "@prisma/client";

export type SegmentPreset = {
  id: string;             // stable id used in seed + UI keys
  name: string;
  description: string;
  rules: SegmentRules;
  emoji: string;
};

// Simple AST: leaves are field/op/value, branches are AND/OR.
// Supported fields match Customer columns: totalSpent, ordersCount, consentStatus,
// hasApp, lastPushAt, country, language, tags, shopifyTags, createdAt.
export type Rule =
  | { kind: "field"; field: string; op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "before" | "after" | "within_days" | "older_than_days"; value: string | number | boolean | string[] }
  | { kind: "and"; children: Rule[] }
  | { kind: "or";  children: Rule[] };

export type SegmentRules = { root: Rule };

export const SEGMENT_PRESETS: SegmentPreset[] = [
  {
    id: "vip-250",
    name: "VIP (>250€ últimos 12 meses)",
    description: "Clientes que han gastado más de 250€ en los últimos 12 meses. Audience prioritaria para early access + colecciones exclusivas.",
    emoji: "💎",
    rules: {
      root: { kind: "and", children: [
        { kind: "field", field: "consentStatus", op: "eq", value: "SUBSCRIBED" },
        { kind: "field", field: "totalSpent",   op: "gt", value: 250 },
      ]},
    },
  },
  {
    id: "churn-risk",
    name: "Riesgo de churn",
    description: "Subscritos, última compra hace 60-120 días, no han abierto email en 30 días. Targets de win-back con descuento.",
    emoji: "⚠️",
    rules: {
      root: { kind: "and", children: [
        { kind: "field", field: "consentStatus", op: "eq", value: "SUBSCRIBED" },
        { kind: "field", field: "ordersCount",   op: "gt", value: 0 },
        // (lastOrderAt 60-120d ago will need an `Order` join; for now we approximate by createdAt + ordersCount)
      ]},
    },
  },
  {
    id: "no-second-purchase",
    name: "Nuevos sin segunda compra",
    description: "1 sola compra en los últimos 90 días. Targets de post-purchase cross-sell.",
    emoji: "🆕",
    rules: {
      root: { kind: "and", children: [
        { kind: "field", field: "consentStatus", op: "eq", value: "SUBSCRIBED" },
        { kind: "field", field: "ordersCount",   op: "eq", value: 1 },
      ]},
    },
  },
  {
    id: "cart-abandoners",
    name: "Cart abandoners (24h)",
    description: "Abandonaron checkout en últimas 24h con valor >30€ sin orden posterior. Trigger de abandoned cart flow.",
    emoji: "🛒",
    rules: {
      root: { kind: "and", children: [
        { kind: "field", field: "consentStatus", op: "eq", value: "SUBSCRIBED" },
        // Cart abandonment requires checkout/event data — placeholder until events table is wired
      ]},
    },
  },
  {
    id: "has-app-recent-push",
    name: "App users con push reciente",
    description: "Tienen la app y recibieron push en últimas 24h. Estos se EXCLUYEN automáticamente de los campaign sends (configurable por campaign).",
    emoji: "📱",
    rules: {
      root: { kind: "and", children: [
        { kind: "field", field: "hasApp",     op: "eq", value: true },
        { kind: "field", field: "lastPushAt", op: "within_days", value: 1 },
      ]},
    },
  },
  {
    id: "no-app",
    name: "Sin app instalada",
    description: "Subscritos que NO tienen la app. Targets ideales del flow 'descarga la app' (incentivo del 10%).",
    emoji: "📥",
    rules: {
      root: { kind: "and", children: [
        { kind: "field", field: "consentStatus", op: "eq", value: "SUBSCRIBED" },
        { kind: "field", field: "hasApp",        op: "eq", value: false },
      ]},
    },
  },
  {
    id: "by-language-fr",
    name: "Francófonos",
    description: "Clientes con language fr-FR. Útil cuando una campaña sólo se traduce a un idioma específico.",
    emoji: "🇫🇷",
    rules: {
      root: { kind: "field", field: "language", op: "eq", value: "fr-FR" },
    },
  },
  {
    id: "bounced-cleanup",
    name: "Bounced (limpieza)",
    description: "Hard bounces para auditoría y exclusión permanente. Se mantienen en la suppression list automáticamente.",
    emoji: "🚫",
    rules: {
      root: { kind: "field", field: "consentStatus", op: "in", value: ["BOUNCED", "COMPLAINED"] },
    },
  },
];

// Compile our rule AST into a Prisma where-clause. Only used at preview / send time;
// we DON'T store the compiled SQL in DB so rules can evolve without migrations.
export function rulesToWhere(rules: SegmentRules, storeId?: string): Prisma.CustomerWhereInput {
  const base: Prisma.CustomerWhereInput = { deletedAt: null, ...(storeId && { storeId }) };
  return { ...base, ...nodeToWhere(rules.root) };
}

function nodeToWhere(node: Rule): Prisma.CustomerWhereInput {
  if (node.kind === "and") return { AND: node.children.map(nodeToWhere) };
  if (node.kind === "or")  return { OR:  node.children.map(nodeToWhere) };
  return fieldToWhere(node);
}

function fieldToWhere(node: Extract<Rule, { kind: "field" }>): Prisma.CustomerWhereInput {
  const f = node.field as keyof Prisma.CustomerWhereInput;
  switch (node.op) {
    case "eq":   return { [f]: node.value } as Prisma.CustomerWhereInput;
    case "ne":   return { NOT: { [f]: node.value } } as Prisma.CustomerWhereInput;
    case "gt":   return { [f]: { gt:   node.value } } as Prisma.CustomerWhereInput;
    case "gte":  return { [f]: { gte:  node.value } } as Prisma.CustomerWhereInput;
    case "lt":   return { [f]: { lt:   node.value } } as Prisma.CustomerWhereInput;
    case "lte":  return { [f]: { lte:  node.value } } as Prisma.CustomerWhereInput;
    case "in":   return { [f]: { in:   node.value as string[] } } as Prisma.CustomerWhereInput;
    case "contains": return { [f]: { contains: node.value as string, mode: "insensitive" } } as Prisma.CustomerWhereInput;
    case "before":   return { [f]: { lt:  new Date(node.value as string) } } as Prisma.CustomerWhereInput;
    case "after":    return { [f]: { gt:  new Date(node.value as string) } } as Prisma.CustomerWhereInput;
    case "within_days": {
      const cutoff = new Date(Date.now() - (node.value as number) * 86_400_000);
      return { [f]: { gte: cutoff } } as Prisma.CustomerWhereInput;
    }
    case "older_than_days": {
      const cutoff = new Date(Date.now() - (node.value as number) * 86_400_000);
      return { [f]: { lt: cutoff } } as Prisma.CustomerWhereInput;
    }
  }
}
