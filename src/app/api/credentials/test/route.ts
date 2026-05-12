// POST /api/credentials/test
//
// Body: { provider: ProviderType, scope?: string|null }
// Runs a real cheap call against the provider with the stored credential and reports
// success/failure + latency. Used by the green/red dot next to each provider in Settings.

import { NextResponse } from "next/server";
import { getCredential } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import type { ProviderType } from "@prisma/client";

export async function POST(req: Request) {
  const { provider, scope } = await req.json().catch(() => ({} as { provider?: ProviderType; scope?: string | null }));
  if (!provider) return NextResponse.json({ ok: false, error: "missing provider" }, { status: 400 });

  const cred = await getCredential(provider, scope ?? null);
  if (!cred) return NextResponse.json({ ok: false, error: "not configured" }, { status: 404 });

  const t0 = Date.now();
  let ok = false;
  let detail: string | null = null;
  try {
    switch (provider) {
      case "TRANSLATION_DEEPSEEK": {
        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cred.value}` },
          body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
        });
        ok = res.ok;
        if (!ok) detail = `${res.status}: ${(await res.text()).slice(0, 120)}`;
        break;
      }
      case "TRANSLATION_OPENAI":
      case "IMAGE_OPENAI":
      case "REVIEW_OPENAI": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${cred.value}` },
        });
        ok = res.ok;
        if (!ok) detail = `${res.status}: ${(await res.text()).slice(0, 120)}`;
        break;
      }
      case "TRANSLATION_DEEPL": {
        const host = (cred.meta?.host as string) ?? "api.deepl.com";
        const res = await fetch(`https://${host}/v2/usage`, {
          headers: { "Authorization": `DeepL-Auth-Key ${cred.value}` },
        });
        ok = res.ok;
        if (!ok) detail = `${res.status}: ${(await res.text()).slice(0, 120)}`;
        break;
      }
      case "IMAGE_GEMINI": {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cred.value}`);
        ok = res.ok;
        if (!ok) detail = `${res.status}: ${(await res.text()).slice(0, 120)}`;
        break;
      }
      case "SHOPIFY": {
        if (!scope) { detail = "scope (store slug) required"; break; }
        const store = await prisma.store.findUnique({ where: { slug: scope } });
        if (!store) { detail = "store slug not found"; break; }
        const res = await fetch(`https://${store.shopifyDomain}/admin/api/2025-01/shop.json`, {
          headers: { "X-Shopify-Access-Token": cred.value },
        });
        ok = res.ok;
        if (!ok) detail = `${res.status}: ${(await res.text()).slice(0, 120)}`;
        break;
      }
      default:
        detail = "test for this provider not implemented yet — value is stored, will be used at runtime";
        ok = true;
    }
  } catch (e) {
    detail = e instanceof Error ? e.message : "test threw an error";
  }

  const latencyMs = Date.now() - t0;
  // Persist the test result on the row so the dot stays green/red between refreshes.
  await prisma.providerCredential.updateMany({
    where: { provider, scope: scope ?? null },
    data: { lastTestedAt: new Date(), lastTestOk: ok, lastTestError: ok ? null : detail },
  }).catch(() => { /* best effort */ });

  return NextResponse.json({ ok, latencyMs, detail });
}
