import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { CLOUDINARY } from './cloudinary.provider';

type CloudinaryClient = typeof cloudinary;

export type CloudinaryImage = {
  publicId: string;
  secureUrl: string;
  url: string;
  width: number;
  height: number;
  format: string;
  resourceType: string;
  bytes: number;
  originalFilename?: string;
};

export type DeleteImageResult = {
  publicId: string;
  deleted: boolean;
  result: string;
};

export type CloudinaryAsset = { publicId: string; secureUrl: string; bytes: number; format: string; resourceType: string };

@Injectable()
export class CloudinaryService {
  private readonly defaultFolder =
    process.env.CLOUDINARY_FOLDER ?? 'decoho/uploads';

  constructor(
    @Inject(CLOUDINARY)
    private readonly cloudinaryClient: CloudinaryClient,
  ) {}

  async uploadImage(
    file: Express.Multer.File,
    folder = this.defaultFolder,
  ): Promise<CloudinaryImage> {
    this.validateImage(file);

    const result = file.buffer
      ? await this.uploadFromBuffer(file.buffer, folder)
      : await this.uploadFromPath(file.path, folder);

    return this.toCloudinaryImage(result);
  }

  async uploadModel(file: Express.Multer.File, folder: string): Promise<CloudinaryAsset> {
    if (!file) throw new BadRequestException('3D model file is required');
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (!extension || !['glb', 'gltf'].includes(extension)) throw new BadRequestException('3D model must be GLB or GLTF');
    if (file.size > 50 * 1024 * 1024) throw new BadRequestException('3D model must be 50MB or smaller');
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = this.cloudinaryClient.uploader.upload_stream({ folder, resource_type: 'raw', unique_filename: true, overwrite: false }, (error?: UploadApiErrorResponse, value?: UploadApiResponse) => {
        if (error) return reject(error);
        if (!value) return reject(new InternalServerErrorException('3D model upload failed'));
        resolve(value);
      });
      stream.end(file.buffer);
    });
    return { publicId: result.public_id, secureUrl: result.secure_url, bytes: result.bytes, format: extension, resourceType: result.resource_type };
  }

  async deleteImage(publicId: string): Promise<DeleteImageResult> {
    if (!publicId?.trim()) {
      throw new BadRequestException('Cloudinary publicId is required');
    }

    const result = await this.cloudinaryClient.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });

    if (result.result === 'not found') {
      throw new NotFoundException('Image not found on Cloudinary');
    }

    return {
      publicId,
      deleted: result.result === 'ok',
      result: result.result,
    };
  }

  getImageUrl(publicId: string): string {
    if (!publicId?.trim()) {
      throw new BadRequestException('Cloudinary publicId is required');
    }

    return this.cloudinaryClient.url(publicId, {
      secure: true,
      resource_type: 'image',
    });
  }

  private uploadFromBuffer(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinaryClient.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
        },
        (
          error?: UploadApiErrorResponse,
          result?: UploadApiResponse,
        ): void => {
          if (error) {
            reject(error);
            return;
          }

          if (!result) {
            reject(new InternalServerErrorException('Cloudinary upload failed'));
            return;
          }

          resolve(result);
        },
      );

      uploadStream.end(buffer);
    });
  }

  private async uploadFromPath(
    path: string | undefined,
    folder: string,
  ): Promise<UploadApiResponse> {
    if (!path) {
      throw new BadRequestException('Image file buffer or path is required');
    }

    return this.cloudinaryClient.uploader.upload(path, {
      folder,
      resource_type: 'image',
      unique_filename: true,
      overwrite: false,
    });
  }

  private validateImage(file?: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Image must be JPEG, PNG, or WEBP');
    }

    const maxImageSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxImageSizeInBytes) {
      throw new BadRequestException('Image must be 10MB or smaller');
    }
  }

  private toCloudinaryImage(result: UploadApiResponse): CloudinaryImage {
    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      url: result.url,
      width: result.width,
      height: result.height,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      originalFilename: result.original_filename,
    };
  }
}
