import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

cloudinary.config({
  cloud_name: 'djzzwjznn',
  api_key: '352163572724556',
  api_secret: 'D6AD9FT2juAjq6FfTer6QuQj4u0',
});

const mongoUri = 'mongodb://decoho_app:decoho123@ac-qoq6tse-shard-00-00.032fubj.mongodb.net:27017,ac-qoq6tse-shard-00-01.032fubj.mongodb.net:27017,ac-qoq6tse-shard-00-02.032fubj.mongodb.net:27017/DecohoDB?tls=true&replicaSet=atlas-n0l4vl-shard-0&authSource=admin&retryWrites=true&w=majority';

const glbFilePath = 'C:\\Users\\tin\\.gemini\\antigravity\\brain\\ac3bfe8d-70b8-4d05-b679-aa8b886dfa7a\\.user_uploaded\\media_1793287848150_51e7a8bf.glb';

async function run() {
  console.log('1. Đang upload file 3D GLB lên Cloudinary...');
  const uploadResult = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      glbFilePath,
      {
        folder: 'decoho/showrooms',
        resource_type: 'raw',
        public_id: `tripo-interior-room-${Date.now()}`,
        format: 'glb',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });

  console.log('Upload thành công! URL 3D:', uploadResult.secure_url);

  console.log('2. Đang kết nối MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('Kết nối MongoDB thành công!');

  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  const showroomsCollection = db.collection('showrooms');

  let adminUser = await usersCollection.findOne({ role: 'ADMIN' });
  if (!adminUser) {
    adminUser = await usersCollection.findOne();
  }
  const createdBy = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

  console.log('3. Đang lưu Showroom vào cơ sở dữ liệu...');
  const showroomDoc = {
    title: 'Phòng mẫu nội thất 3D (Tripo3D AI)',
    description: 'Không gian nội thất hiện đại được tạo tự động bởi Tripo3D AI. Trải nghiệm xoay 360°, chạm để khám phá từng góc phòng.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
    environmentModelUrl: uploadResult.secure_url,
    environmentModelPublicId: uploadResult.public_id,
    status: 'PUBLISHED',
    items: [],
    createdBy: createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertResult = await showroomsCollection.insertOne(showroomDoc);
  console.log('Đã tạo Showroom thành công trong DB! ID:', insertResult.insertedId);

  await mongoose.disconnect();
  console.log('Hoàn tất!');
}

run().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});

