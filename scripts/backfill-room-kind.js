#!/usr/bin/env node
/**
 * Backfill script: gắn `kind` discriminator cho docs trong collection `rooms`
 * đã tồn tại trước khi schema thêm field này.
 *
 * Hậu quả trước fix: `POST /product-spaces/...` và `POST /rooms/upload` đều
 * ghi vào cùng collection, không có cách phân biệt Room và Moodboard.
 *
 * Heuristic:
 *   - Nếu document có `productPoints.0` tồn tại  -> kind = 'moodboard'
 *   - Ngược lại                                   -> kind = 'room'
 *
 * Idempotent: chạy nhiều lần đều an toàn, không ghi đè giá trị đã đúng.
 *
 * Cách chạy:
 *   node scripts/backfill-room-kind.js
 *
 * Yêu cầu biến môi trường MONGO_URI (mặc định lấy từ process.env.MONGO_URI).
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/decoho';
const DB_NAME = (() => {
  try {
    const url = new URL(MONGO_URI.replace('mongodb://', 'http://'));
    return url.pathname.replace(/^\//, '') || 'decoho';
  } catch {
    return 'decoho';
  }
})();

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log(`[backfill] connected to ${MONGO_URI}`);

  const rooms = client.db(DB_NAME).collection('rooms');

  const moodboardFilter = {
    'productPoints.0': { $exists: true },
    $or: [
      { kind: { $exists: false } },
      { kind: 'room' },
    ],
  };
  const roomFilter = {
    'productPoints.0': { $exists: false },
    $or: [
      { kind: { $exists: false } },
      { kind: 'moodboard' },
    ],
  };

  const moodboardResult = await rooms.updateMany(moodboardFilter, {
    $set: { kind: 'moodboard' },
  });
  console.log(
    `[backfill] moodboard -> ${moodboardResult.modifiedCount} doc(s) updated`,
  );

  const roomResult = await rooms.updateMany(roomFilter, {
    $set: { kind: 'room' },
  });
  console.log(`[backfill] room -> ${roomResult.modifiedCount} doc(s) updated`);

  await client.close();
  console.log('[backfill] done');
}

main().catch((error) => {
  console.error('[backfill] failed:', error);
  process.exit(1);
});
