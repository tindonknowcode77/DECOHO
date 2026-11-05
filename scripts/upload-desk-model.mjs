import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'djzzwjznn',
  api_key: '352163572724556',
  api_secret: 'D6AD9FT2juAjq6FfTer6QuQj4u0',
});

const glbFilePath = 'C:\\Users\\tin\\.gemini\\antigravity\\brain\\ac3bfe8d-70b8-4d05-b679-aa8b886dfa7a\\.user_uploaded\\media_1793449638211_e59720b6.glb';

async function run() {
  console.log('Đang upload file 3D bàn gỗ làm việc lên Cloudinary...');
  const uploadResult = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      glbFilePath,
      {
        folder: 'decoho/furniture',
        resource_type: 'raw',
        public_id: `wooden-desk-${Date.now()}`,
        format: 'glb',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });

  console.log('UPLOAD_SUCCESS_URL:' + uploadResult.secure_url);
}

run().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});

