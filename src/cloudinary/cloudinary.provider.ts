import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY = 'CLOUDINARY';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export const CloudinaryProvider = {
  provide: CLOUDINARY,
  useFactory: () => {
    cloudinary.config({
      cloud_name: getRequiredEnv('CLOUDINARY_CLOUD_NAME'),
      api_key: getRequiredEnv('CLOUDINARY_API_KEY'),
      api_secret: getRequiredEnv('CLOUDINARY_API_SECRET'),
      secure: true,
    });

    return cloudinary;
  },
};
