import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Product, ProductDocument } from '../products/product.schema';
import { AddShowroomItemDto, CreateShowroomDto, UpdateShowroomDto, UpdateShowroomItemDto } from './dto/showroom.dto';
import { Showroom, ShowroomDocument, ShowroomStatus } from './showroom.schema';

@Injectable()
export class ShowroomsService{
  constructor(@InjectModel(Showroom.name)private readonly model:Model<ShowroomDocument>,@InjectModel(Product.name)private readonly products:Model<ProductDocument>,private readonly cloudinary:CloudinaryService){}
  listAdmin(){return this.model.find().sort({createdAt:-1}).populate('items.productId','name price image status').exec();}
  listPublic(){return this.model.find({status:ShowroomStatus.Published}).sort({createdAt:-1}).populate('items.productId','name price image status').exec();}
  async publicById(id:string){this.id(id);const item=await this.model.findOne({_id:new Types.ObjectId(id),status:ShowroomStatus.Published}).populate('items.productId','name price image status').exec();if(!item)throw new NotFoundException('Published showroom not found');return item;}
  create(userId:string,dto:CreateShowroomDto){this.id(userId);return this.model.create({...dto,createdBy:new Types.ObjectId(userId)});}
  async update(id:string,dto:UpdateShowroomDto){this.id(id);const item=await this.model.findByIdAndUpdate(id,{$set:dto},{new:true,runValidators:true}).exec();if(!item)throw new NotFoundException('Showroom not found');return item;}
  async uploadEnvironment(id:string,file:Express.Multer.File){this.id(id);const asset=await this.cloudinary.uploadModel(file,'decoho/showrooms');const item=await this.model.findByIdAndUpdate(id,{$set:{environmentModelUrl:asset.secureUrl,environmentModelPublicId:asset.publicId}},{new:true}).exec();if(!item)throw new NotFoundException('Showroom not found');return item;}
  uploadProductModel(file:Express.Multer.File){return this.cloudinary.uploadModel(file,'decoho/showroom-products');}
  async addItem(id:string,dto:AddShowroomItemDto){this.id(id);if(!await this.products.exists({_id:new Types.ObjectId(dto.productId)}))throw new NotFoundException('Product not found');const item=await this.model.findByIdAndUpdate(id,{$push:{items:{...dto,productId:new Types.ObjectId(dto.productId)}}},{new:true,runValidators:true}).exec();if(!item)throw new NotFoundException('Showroom not found');return item;}
  async updateItem(id:string,itemId:string,dto:UpdateShowroomItemDto){this.id(id);this.id(itemId);const set:Record<string,unknown>={};for(const key of ['position','rotation','scale'] as const)if(dto[key])set[`items.$.${key}`]=dto[key];const item=await this.model.findOneAndUpdate({_id:new Types.ObjectId(id),'items._id':new Types.ObjectId(itemId)},{$set:set},{new:true,runValidators:true}).exec();if(!item)throw new NotFoundException('Showroom object not found');return item;}
  async deleteItem(id:string,itemId:string){this.id(id);this.id(itemId);const item=await this.model.findOneAndUpdate({_id:new Types.ObjectId(id),'items._id':new Types.ObjectId(itemId)},{$pull:{items:{_id:new Types.ObjectId(itemId)}}},{new:true}).exec();if(!item)throw new NotFoundException('Showroom object not found');return item;}
  private id(value:string){if(!Types.ObjectId.isValid(value))throw new BadRequestException('Invalid object id');}
}
