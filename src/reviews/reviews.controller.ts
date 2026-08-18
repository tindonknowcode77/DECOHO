import { Body, Controller, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';import { Roles } from '../common/decorators/roles.decorator';import { Role } from '../common/enums/roles.enum';import { RolesGuard } from '../common/guards/roles.guard';
import { CreateReviewDto, ModerateReviewDto, ReportReviewDto, ResolveReviewReportDto } from './dto/review.dto';import { ReviewStatus } from './review.schema';import { ReviewsService } from './reviews.service';
type AuthRequest=Request&{user?:{sub?:string}};
@ApiTags('Reviews')@Controller('reviews')export class ReviewsController{
constructor(private readonly service:ReviewsService){}
@Get()list(@Query('productId')productId?:string){return this.service.listPublic(productId);}
@Post()@UseGuards(JwtAuthGuard)@ApiBearerAuth()create(@Req()req:AuthRequest,@Body()dto:CreateReviewDto){return this.service.create(this.user(req),dto);}
@Post(':id/reports')@UseGuards(JwtAuthGuard)@ApiBearerAuth()report(@Req()req:AuthRequest,@Param('id')id:string,@Body()dto:ReportReviewDto){return this.service.report(this.user(req),id,dto);}
@Get('admin/all')@UseGuards(JwtAuthGuard,RolesGuard)@Roles(Role.ADMIN)@ApiBearerAuth()adminList(@Query('productId')productId?:string,@Query('supplierId')supplierId?:string,@Query('status')status?:ReviewStatus,@Query('reported')reported?:string){return this.service.adminList({productId,supplierId,status,reported:reported==='true'});}
@Patch('admin/:id/hide')@UseGuards(JwtAuthGuard,RolesGuard)@Roles(Role.ADMIN)@ApiBearerAuth()hide(@Req()req:AuthRequest,@Param('id')id:string,@Body()dto:ModerateReviewDto){return this.service.hide(this.user(req),id,dto);}
@Patch('admin/:id/delete-spam')@UseGuards(JwtAuthGuard,RolesGuard)@Roles(Role.ADMIN)@ApiBearerAuth()deleteSpam(@Req()req:AuthRequest,@Param('id')id:string,@Body()dto:ModerateReviewDto){return this.service.deleteSpam(this.user(req),id,dto);}
@Patch('admin/:id/restore')@UseGuards(JwtAuthGuard,RolesGuard)@Roles(Role.ADMIN)@ApiBearerAuth()restore(@Req()req:AuthRequest,@Param('id')id:string){return this.service.restore(this.user(req),id);}
@Patch('admin/:id/reports/resolve')@UseGuards(JwtAuthGuard,RolesGuard)@Roles(Role.ADMIN)@ApiBearerAuth()resolve(@Req()req:AuthRequest,@Param('id')id:string,@Body()dto:ResolveReviewReportDto){return this.service.resolveReport(this.user(req),id,dto);}
private user(req:AuthRequest){if(!req.user?.sub)throw new UnauthorizedException();return req.user.sub;}}
