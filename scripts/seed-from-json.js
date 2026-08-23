/**
 * Seed products_en.json -> POST /api/products
 *
 * Schema verified against live /api/products endpoint:
 *   required: name, price, image (URL), ecommercePlatform, productLink
 *   optional: category, stock, styleTags, weight, origin, warranty,
 *             rating, reviews, images, description, sku, color, material,
 *             dimensions, brand, tags, discount
 *
 * Usage:
 *   ADMIN_TOKEN=eyJ... node scripts/seed-from-json.js
 *   or
 *   node scripts/seed-from-json.js <admin-token>
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'https://decoho-be.onrender.com/api';
const token = process.env.ADMIN_TOKEN || process.argv[2];
const candidates = [
  path.resolve(__dirname, '..', '..', 'products_en.json'),
  path.resolve(__dirname, '..', 'products_en.json'),
  path.resolve(process.cwd(), 'products_en.json'),
  path.resolve(process.cwd(), '..', 'products_en.json'),
];
const inputPath = candidates.find((p) => fs.existsSync(p));

if (!token) {
  console.error('Missing admin token.\nUsage: ADMIN_TOKEN=xxx node scripts/seed-from-json.js');
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

function parsePrice(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw == null) return 0;
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function parseDimensions(raw) {
  if (!raw) return undefined;
  // "55 x 80 cm" -> {length, width, height}
  const parts = String(raw)
    .replace(/[^\dxX\s]/gi, ' ')
    .split(/\s*x\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return {
    length: parts[0] ? `${parts[0]} cm` : undefined,
    width: parts[1] ? `${parts[1]} cm` : undefined,
    height: parts[2] ? `${parts[2]} cm` : undefined,
  };
}

function cleanStr(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

function mapRecord(rec, idx) {
  const productId = cleanStr(rec.Product_ID) || `SP-${String(idx + 1).padStart(4, '0')}`;
  const category = cleanStr(rec.Product_Category) || 'Decor';
  const styleTag = cleanStr(rec.Style) || 'Modern';
  // Verified working schema:
  //  required: name, price, image, ecommercePlatform, productLink, category, styleTags
  return {
    name: cleanStr(rec.Product_Name) || `Product ${idx + 1}`,
    category,
    price: parsePrice(rec.Price),
    image: 'https://placehold.co/600x600/png?text=' + encodeURIComponent(productId),
    ecommercePlatform: 'Other',
    productLink: `https://decoho-fe.example.com/products/${productId}`,
    styleTags: [styleTag],
  };
}

(async () => {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const records = JSON.parse(raw);
  if (!Array.isArray(records) || records.length === 0) {
    console.error('products_en.json must be a non-empty array');
    process.exit(1);
  }

  console.log(`Loaded ${records.length} records. Seeding via ${API_BASE}/products ...`);

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (let i = 0; i < records.length; i++) {
    const dto = mapRecord(records[i], i);
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dto),
      });
      const text = await res.text();
      if (!res.ok) {
        fail++;
        const snippet = text.slice(0, 400);
        failures.push({ i, sku: dto.sku, status: res.status, body: snippet });
        console.error(`[${i + 1}/${records.length}] FAIL ${dto.sku} -> ${res.status} :: ${snippet}`);
      } else {
        ok++;
        if ((i + 1) % 50 === 0 || i + 1 === records.length) {
          console.log(`[${i + 1}/${records.length}] OK total=${ok} fail=${fail}`);
        }
      }
    } catch (err) {
      fail++;
      failures.push({ i, sku: dto.sku, error: err.message });
      console.error(`[${i + 1}/${records.length}] ERR ${dto.sku}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Success=${ok} Failed=${fail} Total=${records.length}`);
  if (failures.length) {
    fs.writeFileSync(
      path.resolve(__dirname, 'seed-failures.json'),
      JSON.stringify(failures, null, 2),
    );
    console.log(`Failures written to scripts/seed-failures.json`);
  }
  process.exit(fail > 0 ? 1 : 0);
})();