import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { Product, ProductSchema } from '../products/product.schema';
import { Moodboard, MoodboardSchema } from './moodboard.schema';
import { MoodboardsController } from './moodboards.controller';
import { MoodboardsService } from './moodboards.service';

@Module({
  imports: [
    AuthModule,
    CloudinaryModule,
    MongooseModule.forFeature([
      { name: Moodboard.name, schema: MoodboardSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [MoodboardsController],
  providers: [MoodboardsService],
  exports: [MoodboardsService],
})
export class MoodboardsModule {}
