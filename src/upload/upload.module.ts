import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuthModule } from '../auth/auth.module';
import { UploadController } from './upload.controller';

@Module({
  imports: [CloudinaryModule, AuthModule],
  controllers: [UploadController],
})
export class UploadModule {}
