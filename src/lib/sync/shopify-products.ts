// Shopify → Sendify product sync.
//
// Mirrors product + variants (with prices) from each store. Multi-market pricing comes
// from Shopify Markets (one variant.price per market). For now we store the store's
// default price; once we wire the Markets GraphQL extension we'll fan out into
// ProductPrice rows per market.

import { prisma } from "../db";
import { iterateShopifyProducts, type ShopifyProduct } from "../providers/shopify";

export type ProductSyncProgress = {
  storeSlug: string;
  productsFetched: number;
  variantsFetched: number;
  upserted: number;
  failed: number;
  firstError?: string;
  startedAt: number;
  finishedAt?: number;
};

export async function syncStoreProducts(
  storeSlug: string,
  onProgress?: (p: ProductSyncProgress) => void,
  options?: { budgetMs?: number },
): Promise<ProductSyncProgress & { hasMore?: boolean }> {
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) throw new Error(`Store ${storeSlug} not found`);

  const budgetMs = options?.budgetMs ?? Infinity;
  const startedAt = Date.now();

  const progress: ProductSyncProgress & { hasMore?: boolean } = {
    storeSlug, productsFetched: 0, variantsFetched: 0, upserted: 0, failed: 0, startedAt,
  };

  for await (const batch of iterateShopifyProducts(storeSlug, 50)) {
    progress.productsFetched += batch.length;
    for (const p of batch) {
      try {
        await upsertProduct(p, store.id, store.countryCode, store.currency);
        progress.upserted++;
        progress.variantsFetched += p.variants.nodes.length;
      } catch (e) {
        progress.failed++;
        if (!progress.firstError) progress.firstError = e instanceof Error ? e.message.slice(0, 200) : "upsert failed";
      }
    }
    onProgress?.(progress);
    if (Date.now() - startedAt > budgetMs) {
      progress.hasMore = true;
      return progress;
    }
  }

  // Update store.productCount denormalized field.
  const count = await prisma.product.count({ where: { storeId: store.id } });
  await prisma.store.update({ where: { id: store.id }, data: { productCount: count } }).catch(() => {});

  progress.finishedAt = Date.now();
  onProgress?.(progress);
  return progress;
}

async function upsertProduct(p: ShopifyProduct, storeId: string, market: string, currency: string) {
  // Upsert the product itself
  const product = await prisma.product.upsert({
    where: { storeId_shopifyId: { storeId, shopifyId: p.id } },
    create: {
      storeId, shopifyId: p.id,
      handle: p.handle, title: p.title,
      vendor: p.vendor, productType: p.productType,
      status: p.status.toLowerCase(),
      tags: p.tags,
      imageUrl: p.featuredImage?.url ?? null,
      descriptionHtml: p.descriptionHtml,
      shopifyCreatedAt: new Date(p.createdAt),
      shopifyUpdatedAt: new Date(p.updatedAt),
    },
    update: {
      handle: p.handle, title: p.title,
      vendor: p.vendor, productType: p.productType,
      status: p.status.toLowerCase(),
      tags: p.tags,
      imageUrl: p.featuredImage?.url ?? null,
      descriptionHtml: p.descriptionHtml,
      shopifyUpdatedAt: new Date(p.updatedAt),
    },
  });

  // Upsert each variant + a single ProductPrice row for the store's default market.
  // When we add Shopify Markets support we'll write one ProductPrice per market here.
  for (const v of p.variants.nodes) {
    const variant = await prisma.productVariant.upsert({
      where: { productId_shopifyId: { productId: product.id, shopifyId: v.id } },
      create: {
        productId: product.id, shopifyId: v.id,
        sku: v.sku, title: v.title,
        imageUrl: v.image?.url ?? null,
        inventoryQty: v.inventoryQuantity, available: v.availableForSale,
      },
      update: {
        sku: v.sku, title: v.title,
        imageUrl: v.image?.url ?? null,
        inventoryQty: v.inventoryQuantity, available: v.availableForSale,
      },
    });

    const price = parseFloat(v.price);
    const compareAt = v.compareAtPrice ? parseFloat(v.compareAtPrice) : null;
    if (isFinite(price)) {
      await prisma.productPrice.upsert({
        where: { variantId_market: { variantId: variant.id, market } },
        create: { variantId: variant.id, market, currency, price, comparePrice: compareAt },
        update: { currency, price, comparePrice: compareAt },
      });
    }
  }
}
