import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { AddShowroomItemDto, CreateShowroomDto, UpdateShowroomDto, UpdateShowroomItemDto } from './dto/showroom.dto';
import { ShowroomsService } from './showrooms.service';

@ApiTags('Showrooms 3D')
@Controller('showrooms')
export class ShowroomsController{
  constructor(private readonly service:ShowroomsService){}
  @Get() listPublic(){return this.service.listPublic();}
  @Get('admin/all') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() listAdmin(){return this.service.listAdmin();}
  @Post('admin') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() create(@Req()req:Request&{user?:{sub?:string}},@Body()dto:CreateShowroomDto){if(!req.user?.sub)throw new UnauthorizedException();return this.service.create(req.user.sub,dto);}
  @Patch('admin/:id') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() update(@Param('id')id:string,@Body()dto:UpdateShowroomDto){return this.service.update(id,dto);}
  @Post('admin/:id/environment') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('model')) uploadEnvironment(@Param('id')id:string,@UploadedFile()file:Express.Multer.File){return this.service.uploadEnvironment(id,file);}
  @Post('admin/models/upload') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('model')) uploadModel(@UploadedFile()file:Express.Multer.File){return this.service.uploadProductModel(file);}
  @Post('admin/:id/items') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() addItem(@Param('id')id:string,@Body()dto:AddShowroomItemDto){return this.service.addItem(id,dto);}
  @Patch('admin/:id/items/:itemId') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() updateItem(@Param('id')id:string,@Param('itemId')itemId:string,@Body()dto:UpdateShowroomItemDto){return this.service.updateItem(id,itemId,dto);}
  @Delete('admin/:id/items/:itemId') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.ADMIN) @ApiBearerAuth() deleteItem(@Param('id')id:string,@Param('itemId')itemId:string){return this.service.deleteItem(id,itemId);}
  @Get(':id') @ApiOperation({summary:'Preview a published 3D showroom'}) preview(@Param('id')id:string){return this.service.publicById(id);}
}
