import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('Promotions') @Controller('promotions')
export class PromotionsController{
  constructor(private readonly promotionsService:PromotionsService){}
  @Post('validate') @ApiOperation({summary:'Validate a promotion code for a cart'}) validate(@Body()dto:ValidatePromotionDto){return this.promotionsService.validateCode(dto.code,dto);}
  @Get('admin/all') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() findAll(){return this.promotionsService.findAll();}
  @Get('admin/:id') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() findById(@Param('id')id:string){return this.promotionsService.findById(id);}
  @Post() @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() @ApiCreatedResponse({description:'Promotion created'}) create(@Body()dto:CreatePromotionDto){return this.promotionsService.create(dto);}
  @Patch(':id') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() update(@Param('id')id:string,@Body()dto:UpdatePromotionDto){return this.promotionsService.update(id,dto);}
  @Patch(':id/disable') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() disable(@Param('id')id:string){return this.promotionsService.disable(id);}
}
