/**
 * Script import moodboards thẳng vào collection `moodboards` (độc lập với `rooms`).
 *
 *   yarn seed:moodboards
 *
 * Yêu cầu:
 *  - MONGODB_URI trong .env
 *  - Có ít nhất 1 user trong collection `users` để gán authorId
 */
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

type MoodboardSeed = {
  title: string;
  description: string;
  imageUrl: string;
  roomType:
    | 'bedroom'
    | 'living_room'
    | 'kitchen'
    | 'bathroom'
    | 'office'
    | 'dining_room'
    | 'other';
  tags: string[];
  isPublic?: boolean;
  isFeatured?: boolean;
  likes?: number;
  views?: number;
  authorName?: string;
  productPoints?: Array<{ productId: string; x: number; y: number }>;
};

const SEEDS: MoodboardSeed[] = [
  {
    title: 'Phòng khách Japandi tối giản',
    description:
      'Phong cách Japandi kết hợp giữa tối giản Bắc Âu và tinh tế Nhật Bản. Tông gỗ ấm, ánh sáng tự nhiên, nội thất ít nhưng chất.',
    imageUrl:
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1600',
    roomType: 'living_room',
    tags: ['Japandi', 'Minimal', 'Wood'],
    isPublic: true,
    isFeatured: true,
    likes: 342,
    views: 1280,
    authorName: 'Hữu Thịnh',
  },
  {
    title: 'Phòng ngủ Soft Serenity',
    description:
      'Gam màu trung tính nhẹ nhàng, vải linen và gỗ tự nhiên tạo cảm giác thư thái cho giấc ngủ.',
    imageUrl:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1600',
    roomType: 'bedroom',
    tags: ['Soft Neutral', 'Cozy', 'Bedroom'],
    isPublic: true,
    likes: 189,
    views: 760,
    authorName: 'Lan Anh',
  },
  {
    title: 'Bếp Nordic hiện đại',
    description:
      'Tông trắng - gỗ sáng kết hợp cây xanh. Bếp sạch sẽ, gọn gàng và đầy đủ ánh sáng.',
    imageUrl:
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1600',
    roomType: 'kitchen',
    tags: ['Nordic', 'Kitchen', 'Minimal'],
    isPublic: true,
    likes: 156,
    views: 540,
    authorName: 'Khánh Ngọc',
  },
  {
    title: 'Phòng tắm Zen',
    description:
      'Đá tự nhiên, gỗ chống ẩm, cây xanh tạo không gian spa thư giãn tại nhà.',
    imageUrl:
      'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1600',
    roomType: 'bathroom',
    tags: ['Zen', 'Spa', 'Stone'],
    isPublic: true,
    likes: 198,
    views: 612,
    authorName: 'Trúc Linh',
  },
  {
    title: 'Góc làm việc Cozy',
    description:
      'Bàn gỗ nhỏ, ghế êm, ánh đèn vàng. Một góc nhỏ cho cả ngày tập trung.',
    imageUrl:
      'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=1600',
    roomType: 'office',
    tags: ['Study', 'Cozy', 'Work From Home'],
    isPublic: true,
    likes: 298,
    views: 880,
    authorName: 'Phương Thảo',
  },
  {
    title: 'Phòng ăn Boho đầy màu sắc',
    description:
      'Hoa văn bohemian, dệt may thủ công, ánh nắng chiều và bàn gỗ lớn cho cả gia đình.',
    imageUrl:
      'https://images.unsplash.com/photo-1556909195-77af8b7f5e64?w=1600',
    roomType: 'dining_room',
    tags: ['Boho', 'Colorful', 'Family'],
    isPublic: true,
    likes: 412,
    views: 1050,
    authorName: 'Mỹ Linh',
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI chưa được cấu hình trong .env');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const users = await db
    .collection('users')
    .find({}, { projection: { _id: 1, name: 1, fullName: 1 } })
    .limit(1)
    .toArray();

  if (users.length === 0) {
    throw new Error(
      'Chưa có user nào trong collection `users`. Hãy tạo 1 user trước khi seed moodboards.',
    );
  }

  const authorId = new ObjectId(String(users[0]._id));

  // Lấy 1 số product thật để ghim thử (tối đa 3 / moodboard)
  const sampleProducts = await db
    .collection('products')
    .find({}, { projection: { _id: 1 } })
    .limit(10)
    .toArray();

  const coll = db.collection('moodboards');
  await coll.deleteMany({}); // clear để seed tươi — bỏ dòng này nếu muốn giữ data cũ

  const docs = SEEDS.map((seed, idx) => {
    const points = (seed.productPoints ?? sampleProducts.slice(0, 3).map((p, i) => ({
      productId: new ObjectId(String(p._id)),
      x: 25 + i * 25,
      y: 30 + i * 15,
    })));

    return {
      authorId,
      authorName: seed.authorName,
      title: seed.title,
      description: seed.description,
      imageUrl: seed.imageUrl,
      roomType: seed.roomType,
      tags: seed.tags,
      likes: seed.likes ?? 0,
      views: seed.views ?? 0,
      isPublic: seed.isPublic ?? true,
      isFeatured: seed.isFeatured ?? false,
      productPoints: points,
      createdAt: new Date(Date.now() - idx * 86400000),
      updatedAt: new Date(),
    };
  });

  const result = await coll.insertMany(docs);
  console.log(`✓ Đã insert ${result.insertedCount} moodboards vào collection "moodboards"`);

  await client.close();
}

main().catch((err) => {
  console.error('Seed moodboards thất bại:', err);
  process.exit(1);
});
