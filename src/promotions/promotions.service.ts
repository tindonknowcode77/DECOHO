import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { DiscountType, Promotion, PromotionDocument } from './promotion.schema';

export type PromotionContext = { subtotal:number; productIds:string[]; categoryIds:string[]; supplierIds:string[] };

@Injectable()
export class PromotionsService {
  constructor(@InjectModel(Promotion.name) private readonly promotionModel:Model<PromotionDocument>){}

  findAll(){return this.promotionModel.find().sort({createdAt:-1}).exec();}
  async findById(id:string){this.id(id);const item=await this.promotionModel.findById(id).exec();if(!item)throw new NotFoundException('Promotion not found');return item;}
  async create(dto:CreatePromotionDto){this.validateRules(dto);try{return await this.promotionModel.create(this.payload(dto));}catch(error){if((error as {code?:number}).code===11000)throw new ConflictException('Promotion code already exists');throw error;}}
  async update(id:string,dto:UpdatePromotionDto){this.id(id);const current=await this.findById(id);const merged={...current.toObject(),...dto};this.validateRules(merged);const item=await this.promotionModel.findByIdAndUpdate(id,{$set:this.payload(dto)},{new:true,runValidators:true}).exec();if(!item)throw new NotFoundException('Promotion not found');return item;}
  async disable(id:string){this.id(id);const item=await this.promotionModel.findByIdAndUpdate(id,{$set:{isActive:false}},{new:true}).exec();if(!item)throw new NotFoundException('Promotion not found');return item;}

  async validateCode(code:string,context:PromotionContext){
    const promotion=await this.promotionModel.findOne({code:code.trim().toUpperCase()}).exec();if(!promotion)throw new NotFoundException('Promotion code not found');
    const now=new Date();if(!promotion.isActive)throw new BadRequestException('Promotion is disabled');if(now<promotion.startDate)throw new BadRequestException('Promotion has not started');if(now>promotion.endDate)throw new BadRequestException('Promotion has expired');if(promotion.usageCount>=promotion.usageLimit)throw new BadRequestException('Promotion usage limit reached');if(context.subtotal<promotion.minimumOrderAmount)throw new BadRequestException('Order does not meet the minimum amount');
    const scopes=[this.intersects(promotion.productIds,context.productIds),this.intersects(promotion.categoryIds,context.categoryIds),this.intersects(promotion.supplierIds,context.supplierIds)];const hasScope=promotion.productIds.length+promotion.categoryIds.length+promotion.supplierIds.length>0;if(hasScope&&!scopes.some(Boolean))throw new BadRequestException('Promotion does not apply to these products');
    let discount=promotion.discountType===DiscountType.Percentage?context.subtotal*promotion.discountValue/100:promotion.discountValue;if(promotion.maximumDiscountAmount!==undefined)discount=Math.min(discount,promotion.maximumDiscountAmount);discount=Math.min(Math.round(discount),context.subtotal);
    return {promotionId:promotion.id,code:promotion.code,discountAmount:discount,discountType:promotion.discountType,discountValue:promotion.discountValue,remainingUses:promotion.usageLimit-promotion.usageCount};
  }

  async redeem(code:string){const now=new Date();const item=await this.promotionModel.findOneAndUpdate({code:code.trim().toUpperCase(),isActive:true,startDate:{$lte:now},endDate:{$gte:now},$expr:{$lt:['$usageCount','$usageLimit']}},{$inc:{usageCount:1}},{new:true}).exec();if(!item)throw new BadRequestException('Promotion can no longer be redeemed');return item;}

  private payload(dto:Partial<CreatePromotionDto>){const result:Record<string,unknown>={...dto};if(dto.code)result.code=dto.code.trim().toUpperCase();for(const key of ['productIds','categoryIds','supplierIds'] as const){if(dto[key])result[key]=dto[key]!.map((id)=>new Types.ObjectId(id));}return result;}
  private validateRules(dto:{startDate?:Date;endDate?:Date;discountType?:DiscountType;discountValue?:number}){if(dto.startDate&&dto.endDate&&new Date(dto.endDate)<=new Date(dto.startDate))throw new BadRequestException('endDate must be after startDate');if(dto.discountType===DiscountType.Percentage&&(dto.discountValue??0)>100)throw new BadRequestException('Percentage discount cannot exceed 100');if((dto.discountValue??0)<=0)throw new BadRequestException('discountValue must be greater than zero');}
  private intersects(values:Types.ObjectId[],ids:string[]){const set=new Set(ids);return values.some((value)=>set.has(value.toString()));}
  private id(value:string){if(!Types.ObjectId.isValid(value))throw new BadRequestException('Invalid promotion id');}
}
