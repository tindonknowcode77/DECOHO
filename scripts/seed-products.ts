/* eslint-disable no-console */
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadTsConfig } from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { Product, ProductSchema, ProductStatus } from '../src/products/product.schema';

type SeedProductInput = {
  sku?: string;
  name: string;
  category: string;
  brand?: string;
  description?: string;
  price: number;
  discount?: number;
  stock?: number;
  image?: string;
  images?: string[];
  material?: string;
  color?: string;
  dimensions?: { length?: string; width?: string; height?: string };
  weight?: string;
  origin?: string;
  warranty?: string;
  rating?: number;
  reviews?: number;
  tags?: string[];
  styleTags?: string[];
  isFeatured?: boolean;
  status?: keyof typeof ProductStatus;
};

const STATUS_MAP: Record<string, ProductStatus> = {
  DRAFT: ProductStatus.Draft,
  PENDING: ProductStatus.Pending,
  APPROVED: ProductStatus.Approved,
  REJECTED: ProductStatus.Rejected,
  HIDDEN: ProductStatus.Hidden,
  OUT_OF_STOCK: ProductStatus.OutOfStock,
};

function pickEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function resolveMongoUri(): string {
  const uri = pickEnv('MONGODB_URI', 'MONGO_URI', 'DATABASE_URL');
  if (!uri) {
    throw new Error(
      'Missing MONGODB_URI. Set it in .env or pass it inline: MONGODB_URI=... npm run seed:products',
    );
  }
  return uri;
}

function resolveJsonPath(): string {
  const arg = process.argv.find((value) => value.startsWith('--file='))?.split('=')[1];
  const fallback = process.argv[process.argv.length - 1];
  const candidate = arg ?? (fallback && fallback.endsWith('.json') ? fallback : undefined);
  const relative = candidate ?? 'seed-products.json';
  const absolute = resolve(relative);
  if (!existsSync(absolute)) {
    throw new Error(`Seed JSON not found at ${absolute}. Pass --file=path/to/file.json`);
  }
  return absolute;
}

function normalizeStatus(input: string | undefined): ProductStatus {
  if (!input) return ProductStatus.Approved;
  const upper = input.toUpperCase().replace(/\s+/g, '_');
  return STATUS_MAP[upper] ?? ProductStatus.Approved;
}

function normalizeImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function toObjectId(value: unknown): Types.ObjectId | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  if (!mongoose.isValidObjectId(value)) return undefined;
  return new Types.ObjectId(value);
}

function transform(input: SeedProductInput) {
  return {
    sku: input.sku?.trim(),
    name: input.name.trim(),
    category: input.category?.trim() ?? 'Uncategorized',
    brand: input.brand?.trim(),
    description: input.description?.trim(),
    price: Number(input.price) || 0,
    discount: Number(input.discount ?? 0),
    stock: Number(input.stock ?? 0),
    image: input.image?.trim() ?? input.images?.[0] ?? '',
    images: normalizeImages(input.images ?? input.image),
    material: input.material?.trim(),
    color: input.color?.trim(),
    dimensions: input.dimensions
      ? {
          length: input.dimensions.length,
          width: input.dimensions.width,
          height: input.dimensions.height,
        }
      : undefined,
    weight: input.weight?.trim(),
    origin: input.origin?.trim(),
    warranty: input.warranty?.trim(),
    rating: Number(input.rating ?? 0),
    reviews: Number(input.reviews ?? 0),
    tags: Array.isArray(input.tags) ? input.tags : [],
    styleTags: Array.isArray(input.styleTags) ? input.styleTags : [],
    isFeatured: Boolean(input.isFeatured),
    status: normalizeStatus(input.status as string | undefined),
    brandId: toObjectId((input as Record<string, unknown>).brandId),
    categoryId: toObjectId((input as Record<string, unknown>).categoryId),
    supplierId: toObjectId((input as Record<string, unknown>).supplierId),
    isLocked: false,
    soldCount: 0,
  };
}

async function main() {
  loadTsConfig({ path: '.env' });

  const uri = resolveMongoUri();
  const filePath = resolveJsonPath();

  console.log(`[seed] Reading products from ${filePath}`);
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const list: SeedProductInput[] = Array.isArray(parsed)
    ? (parsed as SeedProductInput[])
    : (parsed as { products?: SeedProductInput[] }).products ?? [];

  if (list.length === 0) {
    throw new Error('Seed file is empty or has unexpected shape (expected array or { products: [...] })');
  }

  console.log(`[seed] Found ${list.length} product(s). Connecting to MongoDB...`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const ProductModel = mongoose.model(Product.name, ProductSchema);

  const docs = list.map(transform);
  const result = await ProductModel.insertMany(docs, { ordered: false });

  console.log(`[seed] Inserted ${result.length} product(s).`);
  result.slice(0, 3).forEach((doc) => {
    console.log(`  - ${doc._id} ${doc.name} (${doc.status})`);
  });

  await mongoose.disconnect();
  console.log('[seed] Done.');
}

main().catch(async (error) => {
  console.error('[seed] Failed:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
