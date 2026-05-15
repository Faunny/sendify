// Server entry for /settings. Fetches stores, senders and users from Prisma
// once on the server and passes them to the client tabs component. Replaces
// the previous all-mock STORES/SENDERS import that left every field with
// fake data.

import { prisma } from "@/lib/db";
import { SettingsClient, type SettingsStore, type SettingsSender, type SettingsUser } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  const [storeRows, senderRows, userRows] = await Promise.all([
    prisma.store.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
    prisma.sender.findMany({
      where: { active: true },
      orderBy: { fromEmail: "asc" },
    }).catch(() => []),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }).catch(() => []),
  ]);

  const stores: SettingsStore[] = storeRows.map((s) => {
    const palette = (s.brandPalette ?? {}) as Record<string, string>;
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      shopifyDomain: s.shopifyDomain,
      storefrontUrl: s.storefrontUrl ?? "",
      countryCode: s.countryCode,
      defaultLanguage: s.defaultLanguage,
      currency: s.currency,
      productCount: s.productCount ?? 0,
      markets: s.markets ?? [],
      legal: {
        legalName: s.legalName ?? s.name,
        vatNumber: s.vatNumber ?? "",
        address: s.legalAddress ?? "",
        postalCode: s.legalPostalCode ?? "",
        city: s.legalCity ?? "",
        country: s.legalCountry ?? "",
        supportEmail: s.supportEmail ?? "",
        supportPhone: s.supportPhone ?? "",
      },
      brand: {
        logoUrl: s.brandLogoUrl ?? "",
        palette,
        fontHeading: s.brandFontHeading ?? "Geist",
        fontBody: s.brandFontBody ?? "Inter",
      },
    };
  });

  const senders: SettingsSender[] = senderRows.map((s) => ({
    id: s.id,
    storeId: s.storeId,
    fromEmail: s.fromEmail,
    fromName: s.fromName,
    verified: s.verified,
    provider: s.provider,
    dailyCap: s.dailyCap,
    warmupStartedAt: s.warmupStartedAt?.toISOString() ?? null,
    warmupTargetPerDay: s.warmupTargetPerDay,
  }));

  const users: SettingsUser[] = userRows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

  return <SettingsClient stores={stores} senders={senders} users={users} />;
}
