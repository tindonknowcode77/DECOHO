/**
 * Script import sản phẩm từ file JSON vào MongoDB
 * Chạy: npx ts-node scripts/import-products.ts
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const { Schema } = mongoose;

const ProductDimensionsSchema = new Schema(
  {
    length: { type: Schema.Types.Number },
    width:  { type: Schema.Types.Number },
    height: { type: Schema.Types.Number },
    raw:    { type: Schema.Types.String },
  },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    brandId:     { type: Schema.Types.ObjectId, ref: 'Brand' },
    categoryId:  { type: Schema.Types.ObjectId, ref: 'Category' },
    supplierId:  { type: Schema.Types.ObjectId, ref: 'User' },

    sku:         { type: String, maxlength: 80 },
    name:        { type: String, required: true },
    category:    { type: String },
    brand:       { type: String },
    description: { type: String, maxlength: 2000 },
    price:       { type: Number, required: true, min: 0 },
    discount:    { type: Number, default: 0, min: 0 },
    stock:       { type: Number, default: 0, min: 0 },
    soldCount:   { type: Number, default: 0, min: 0 },
    status:      { type: String, enum: ['DRAFT','PENDING','APPROVED','REJECTED','HIDDEN','OUT_OF_STOCK'], default: 'DRAFT', index: true },
    isLocked:    { type: Boolean, default: false },
    moderationReason: { type: String, maxlength: 1000 },
    isFeatured:  { type: Boolean, default: false },
    material:    { type: String },
    color:       { type: String },
    dimensions:  { type: ProductDimensionsSchema },
    weight:      { type: String },
    origin:      { type: String },
    warranty:    { type: String },
    rating:      { type: Number, min: 0, max: 5, default: 0 },
    reviews:     { type: Number, default: 0 },
    image:       { type: String },
    images:      { type: [String], default: [] },
    tags:        { type: [String], default: [] },
    styleTags:   { type: [String], default: [] },
    ecommercePlatform: { type: String, enum: ['Shopee','Lazada','Tiki','Sendo','Amazon','IKEA','Other'] },
    productLink:  { type: String, maxlength: 1000 },
  },
  { timestamps: true, versionKey: false, collection: 'products' },
);

ProductSchema.virtual('productId').get(function () {
  return this._id?.toString();
});
ProductSchema.set('toJSON', { virtuals: true });

const ProductModel = mongoose.model('Product', ProductSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function parseStatus(raw: string | undefined): string {
  const map: Record<string, string> = {
    DRAFT: 'DRAFT', PENDING: 'PENDING', APPROVED: 'APPROVED',
    REJECTED: 'REJECTED', HIDDEN: 'HIDDEN', OUT_OF_STOCK: 'OUT_OF_STOCK',
  };
  return map[raw ?? ''] ?? 'DRAFT';
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const jsonPath = path.resolve(__dirname, '../../products-import.json');
  console.log('📂 Reading:', jsonPath);
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const products = JSON.parse(raw) as Record<string, unknown>[];

  console.log(`\n📦 Total products in JSON: ${products.length}`);

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not found in .env');

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of products) {
    try {
      const sku = String(item['sku'] ?? '').trim();

      // Check duplicate by SKU
      const existing = await ProductModel.findOne({ sku }).lean().exec();
      if (existing) {
        // Update productLink if missing
        const newLink = normalizeUrl(item['productLink'] as string);
        if (newLink && !existing.productLink) {
          await ProductModel.updateOne({ _id: existing._id }, { productLink: newLink });
          console.log(`  🔄 Updated productLink for SKU: ${sku}`);
          imported++;
        } else {
          console.log(`  ⏭️  Skip (exists): ${sku}`);
          skipped++;
        }
        continue;
      }

      const price = item['price'];
      if (typeof price !== 'number' || isNaN(price)) {
        console.warn(`  ⚠️  Skipping "${item['name']}" — invalid price: ${price}`);
        skipped++;
        continue;
      }

      const doc = {
        sku: sku || undefined,
        name: String(item['name'] ?? 'Untitled').trim(),
        category: String(item['category'] ?? '').trim().toLowerCase() || undefined,
        brand: normalizeUrl(item['brand'] as string),
        description: normalizeUrl(item['description'] as string),
        price,
        discount: Number(item['discount']) || 0,
        stock: Number(item['stock']) || 0,
        soldCount: Number(item['soldCount']) || 0,
        status: parseStatus(item['status'] as string | undefined),
        isLocked: Boolean(item['isLocked']),
        moderationReason: item['moderationReason'] ?? undefined,
        isFeatured: Boolean(item['isFeatured']),
        material: normalizeUrl(item['material'] as string),
        color: normalizeUrl(item['color'] as string),
        dimensions: item['dimensions'] ?? undefined,
        weight: normalizeUrl(item['weight'] as string),
        origin: normalizeUrl(item['origin'] as string),
        warranty: normalizeUrl(item['warranty'] as string),
        rating: typeof item['rating'] === 'number' ? item['rating'] : 0,
        reviews: Number(item['reviews']) || 0,
        image: normalizeUrl(item['image'] as string),
        images: Array.isArray(item['images']) ? item['images'].filter(Boolean) : [],
        tags: Array.isArray(item['tags']) ? item['tags'].filter(Boolean) : [],
        styleTags: Array.isArray(item['styleTags'])
          ? (item['styleTags'] as string[]).map((t) => t.trim().toLowerCase()).filter(Boolean)
          : [],
        ecommercePlatform: normalizeUrl(item['ecommercePlatform'] as string),
        productLink: normalizeUrl(item['productLink'] as string),
      };

      await ProductModel.create(doc);
      console.log(`  ✅ Imported: ${sku} — ${doc.name}`);
      imported++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Error: ${msg}`);
      errors++;
    }
  }

  console.log('\n───────────────');
  console.log(`✅ Imported : ${imported}`);
  console.log(`⏭️  Skipped  : ${skipped}`);
  console.log(`❌ Errors   : ${errors}`);
  console.log(`📊 Total    : ${imported + skipped + errors}`);

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected.');
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
