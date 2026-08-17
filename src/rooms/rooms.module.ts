import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { Product, ProductSchema } from '../products/product.schema';
import { Room, RoomSchema } from './room.schema';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { ProductSpacesController } from './product-spaces.controller';

@Module({
  imports: [
    AuthModule,
    CloudinaryModule,
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [RoomsController, ProductSpacesController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
