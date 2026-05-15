// Storefront content fetcher for newsletters.
//
// Pulls "what's new on the brand's website" from two sources:
//   1. Shopify products — latest active items with images from prisma.product
//      (already synced via the existing webhook + sync paths).
//   2. Shopify blog — Atom feed at {storefrontUrl}/blogs/news.atom which every
//      Shopify store exposes by default. Pulls the 3-5 most recent posts so
//      the newsletter can include "Latest from the journal".
//
// Both lookups are best-effort: if a blog doesn't exist (404) or the store
// hasn't synced products yet, the newsletter still goes out without that
// section.

import { prisma } from "@/lib/db";

export type StorefrontProductHint = {
  handle: string;
  title: string;
  imageUrl: string | null;
  price: number | null;
  productUrl: string;
};

export type StorefrontPost = {
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string;
  imageUrl?: string;
};

export async function loadLatestProducts(storeSlug: string, limit = 6): Promise<StorefrontProductHint[]> {
  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, countryCode: true, storefrontUrl: true },
  });
  if (!store) return [];
  const rows = await prisma.product.findMany({
    where: { storeId: store.id, status: "active", imageUrl: { not: null } },
    orderBy: { shopifyCreatedAt: "desc" },
    take: limit,
    select: {
      handle: true, title: true, imageUrl: true,
      variants: {
        take: 1,
        select: { prices: { where: { market: store.countryCode }, take: 1, select: { price: true } } },
      },
    },
  });
  return rows.map((p) => ({
    handle: p.handle,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.variants[0]?.prices[0]?.price ? Number(p.variants[0].prices[0].price) : null,
    productUrl: `${store.storefrontUrl ?? ""}/products/${p.handle}`.replace(/\/$/, ""),
  }));
}

// Best-effort fetch of recent blog posts from a Shopify store's Atom feed.
// Returns [] when the feed is missing / malformed / takes too long.
export async function loadLatestPosts(storefrontUrl: string, limit = 3): Promise<StorefrontPost[]> {
  if (!storefrontUrl) return [];
  const cleanBase = storefrontUrl.replace(/\/$/, "");
  // Most Shopify themes expose /blogs/news.atom. Some merchants rename the
  // handle, so try a few common paths and the first that returns valid XML wins.
  const candidates = [
    `${cleanBase}/blogs/news.atom`,
    `${cleanBase}/blog.atom`,
    `${cleanBase}/blogs/blog.atom`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        // 4-second cap so a slow storefront doesn't block the newsletter draft.
        signal: AbortSignal.timeout(4_000),
        headers: { "user-agent": "sendify-newsletter/1.0" },
      });
      if (!r.ok) continue;
      const xml = await r.text();
      if (!xml.includes("<entry") && !xml.includes("<item")) continue;
      const posts = parseAtom(xml).slice(0, limit);
      if (posts.length > 0) return posts;
    } catch {
      // Swallow timeout / network errors — try next candidate or fall through.
      continue;
    }
  }
  return [];
}

// Minimal Atom parser. Shopify's feed is well-formed; we just extract title,
// link, summary, published, and the first image inside the content.
function parseAtom(xml: string): StorefrontPost[] {
  const entries = xml.split(/<entry\b/i).slice(1);
  const out: StorefrontPost[] = [];
  for (const raw of entries) {
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch  = raw.match(/<link[^>]*\bhref="([^"]+)"/i);
    const dateMatch  = raw.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ?? raw.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const summary    = raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ?? raw.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
    const imgMatch   = (summary?.[1] ?? "").match(/<img[^>]+src="([^"]+)"/i) ?? raw.match(/<media:content[^>]+url="([^"]+)"/i);
    if (!titleMatch || !linkMatch) continue;
    const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    const decoded = (s: string) =>
      s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    out.push({
      title: decoded(stripHtml(titleMatch[1])).slice(0, 140),
      url: decoded(linkMatch[1]),
      excerpt: stripHtml(decoded(summary?.[1] ?? "")).slice(0, 260),
      publishedAt: dateMatch?.[1]?.trim() ?? "",
      imageUrl: imgMatch?.[1],
    });
  }
  return out;
}
