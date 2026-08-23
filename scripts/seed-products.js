/**
 * Seed products via POST /api/products/admin
 * Usage:
 *   node scripts/seed-products.js <admin-token>
 *
 * Reads: ./products.json
 * Expects: array of product objects matching AdminCreateProductDto
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'https://decoho-be.onrender.com/api';
const token = process.argv[2];
const inputPath = path.resolve(process.cwd(), 'products.json');

if (!token) {
  console.error('Missing admin token. Usage: node scripts/seed-products.js <admin-token>');
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const products = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(products) || products.length === 0) {
  console.error('products.json must be a non-empty array');
  process.exit(1);
}

(async () => {
  let success = 0;
  let failed = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      const res = await fetch(`${API_BASE}/products/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(p),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[${i + 1}/${products.length}] FAIL ${p.name ?? p.sku ?? i}: ${res.status} ${text.slice(0, 200)}`);
        failed++;
      } else {
        console.log(`[${i + 1}/${products.length}] OK ${p.name ?? p.sku ?? i}`);
        success++;
      }
    } catch (err) {
      console.error(`[${i + 1}/${products.length}] ERROR ${p.name ?? i}: ${err.message}`);
      failed++;
    }
    // small delay to avoid rate limit
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`\nDone. Success=${success} Failed=${failed} Total=${products.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
