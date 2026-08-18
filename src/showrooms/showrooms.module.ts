import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { Product, ProductSchema } from '../products/product.schema';
import { Showroom, ShowroomSchema } from './showroom.schema';
import { ShowroomsController } from './showrooms.controller';
import { ShowroomsService } from './showrooms.service';
@Module({imports:[AuthModule,CloudinaryModule,MongooseModule.forFeature([{name:Showroom.name,schema:ShowroomSchema},{name:Product.name,schema:ProductSchema}])],controllers:[ShowroomsController],providers:[ShowroomsService]})
export class ShowroomsModule{}
