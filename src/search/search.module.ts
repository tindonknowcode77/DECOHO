import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Brand, BrandSchema } from '../brands/brand.schema';
import { Category, CategorySchema } from '../categories/category.schema';
import { Product, ProductSchema } from '../products/product.schema';
import { Room, RoomSchema } from '../rooms/room.schema';
import { User, UserSchema } from '../users/user.schema';
import { SearchController } from './search.controller';
import { SearchLog, SearchLogSchema } from './search-log.schema';
import { SearchService } from './search.service';

@Module({ imports: [MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }, { name: Category.name, schema: CategorySchema }, { name: Brand.name, schema: BrandSchema }, { name: Room.name, schema: RoomSchema }, { name: User.name, schema: UserSchema }, { name: SearchLog.name, schema: SearchLogSchema }])], controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
