// Provider credentials store.
//
// All external API keys (Gemini, OpenAI, DeepSeek, Shopify per-store, AWS SES…) live
// in the DB encrypted with AES-256-GCM. AUTH_SECRET is the master key. Settings UI is
// the only writer; lib adapters read via `getCredential()` which caches per-process.
//
// Swap providers at runtime: edit a row in Settings, the cache invalidates on update,
// next request picks up the new value. No redeploy needed.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import type { ProviderType } from "@prisma/client";

// ── Encryption ─────────────────────────────────────────────────────────────

function masterKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET missing — required to derive credentials encryption key");
  return createHash("sha256").update(secret).digest();
}

export function encryptValue(plain: string): { valueEnc: string; valueIv: string; valueTag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    valueEnc: enc.toString("base64"),
    valueIv: iv.toString("base64"),
    valueTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptValue(record: { valueEnc: string; valueIv: string; valueTag: string }): string {
  const iv = Buffer.from(record.valueIv, "base64");
  const tag = Buffer.from(record.valueTag, "base64");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([
    decipher.update(Buffer.from(record.valueEnc, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

// ── Cache ──────────────────────────────────────────────────────────────────
// Cached per-process. TTL 30s — long enough to amortize hits in a single render,
// short enough that a key rotation takes effect quickly without a redeploy.

type Entry = { value: string; meta: Record<string, unknown> | null; loadedAt: number };
const cache = new Map<string, Entry>();
const TTL_MS = 30_000;

function cacheKey(provider: ProviderType, scope: string | null) {
  return `${provider}::${scope ?? ""}`;
}

// Reset the cached value for a (provider, scope) after a Settings save.
export function invalidateCredential(provider: ProviderType, scope: string | null = null) {
  cache.delete(cacheKey(provider, scope));
}

// Fetch decrypted credential. Returns null if not configured.
// Uses findFirst (not findUnique with composite) to play nicely with nullable scope.
export async function getCredential(
  provider: ProviderType,
  scope: string | null = null,
): Promise<{ value: string; meta: Record<string, unknown> | null } | null> {
  const key = cacheKey(provider, scope);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < TTL_MS) {
    return { value: cached.value, meta: cached.meta };
  }
  const row = await prisma.providerCredential.findFirst({
    where: { provider, scope, active: true },
  }).catch(() => null);
  if (!row) return null;

  const value = decryptValue(row);
  const meta = (row.meta as Record<string, unknown> | null) ?? null;
  cache.set(key, { value, meta, loadedAt: Date.now() });
  return { value, meta };
}

// Upsert a credential (encrypts before saving) and invalidate the cache.
export async function setCredential(args: {
  provider: ProviderType;
  scope?: string | null;
  value: string;
  label?: string;
  meta?: Record<string, unknown>;
}) {
  const enc = encryptValue(args.value);
  const scope = args.scope ?? null;
  // Find existing row first since composite uniques with nullable scope are awkward.
  const existing = await prisma.providerCredential.findFirst({
    where: { provider: args.provider, scope },
  });
  if (existing) {
    await prisma.providerCredential.update({
      where: { id: existing.id },
      data: { ...enc, label: args.label, meta: args.meta as never, active: true },
    });
  } else {
    await prisma.providerCredential.create({
      data: {
        provider: args.provider, scope,
        label: args.label,
        ...enc,
        meta: args.meta as never,
        active: true,
      },
    });
  }
  invalidateCredential(args.provider, scope);
}

// Delete a credential (e.g. when user removes a Shopify connection).
export async function deleteCredential(provider: ProviderType, scope: string | null = null) {
  await prisma.providerCredential.deleteMany({
    where: { provider, scope: scope ?? null },
  });
  invalidateCredential(provider, scope);
}

// Quick check used by SetupChecklist and the dashboard. Doesn't decrypt — just looks for
// a row's existence + active flag. Fast.
export async function hasCredential(provider: ProviderType, scope: string | null = null): Promise<boolean> {
  const c = await prisma.providerCredential.count({
    where: { provider, scope: scope ?? null, active: true },
  }).catch(() => 0);
  return c > 0;
}

// Test a credential by calling the provider's lightweight endpoint. Updates the row
// with lastTestedAt + lastTestOk + lastTestError so the UI can show a green/red dot.
// Implementations live in src/lib/providers/* and register here.
export type TestResult = { ok: boolean; latencyMs: number; detail?: string };
const TESTERS = new Map<ProviderType, (value: string, scope: string | null) => Promise<TestResult>>();

export function registerTester(provider: ProviderType, tester: (value: string, scope: string | null) => Promise<TestResult>) {
  TESTERS.set(provider, tester);
}

export async function testCredential(provider: ProviderType, scope: string | null = null): Promise<TestResult> {
  const cred = await getCredential(provider, scope);
  if (!cred) return { ok: false, latencyMs: 0, detail: "credential not configured" };
  const tester = TESTERS.get(provider);
  if (!tester) return { ok: false, latencyMs: 0, detail: "no tester registered for this provider" };
  const t0 = Date.now();
  let result: TestResult;
  try {
    result = await tester(cred.value, scope);
  } catch (e) {
    result = { ok: false, latencyMs: Date.now() - t0, detail: e instanceof Error ? e.message : "test failed" };
  }
  await prisma.providerCredential.updateMany({
    where: { provider, scope: scope ?? null },
    data: { lastTestedAt: new Date(), lastTestOk: result.ok, lastTestError: result.ok ? null : (result.detail ?? "unknown error") },
  });
  return result;
}
