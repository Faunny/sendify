// Shopify Plus adapter — one client per store, configured from the DB row.
// Webhooks land at /api/shopify/webhook and are routed by topic.

import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

let api: ReturnType<typeof shopifyApi> | null = null;
export function getShopify() {
  if (!api) {
    api = shopifyApi({
      apiKey: process.env.SHOPIFY_API_KEY ?? "",
      apiSecretKey: process.env.SHOPIFY_API_SECRET ?? "",
      apiVersion: ApiVersion.January25,
      isEmbeddedApp: false,
      scopes: [
        "read_customers",
        "read_orders",
        "read_products",
        "read_checkouts",
        "read_marketing_events",
      ],
      hostName: (process.env.SHOPIFY_APP_URL ?? "").replace(/^https?:\/\//, ""),
    });
  }
  return api;
}

// Query Shopify customer with the metafields we care about: app_installed, last_push_at.
// These metafields are written by your mobile app or backend whenever push state changes.
export const QUERY_CUSTOMER_APP_STATE = /* GraphQL */ `
  query CustomerAppState($id: ID!) {
    customer(id: $id) {
      id
      email
      locale
      app: metafield(namespace: "app", key: "installed") { value }
      lastPush: metafield(namespace: "app", key: "last_push_at") { value }
    }
  }
`;

export type AppState = { installed: boolean; lastPushAt: Date | null };

export function parseAppState(metafields: {
  app?: { value: string } | null;
  lastPush?: { value: string } | null;
}): AppState {
  return {
    installed: metafields.app?.value === "true",
    lastPushAt: metafields.lastPush?.value ? new Date(metafields.lastPush.value) : null,
  };
}
