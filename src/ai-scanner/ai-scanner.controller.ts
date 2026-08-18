import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseFilePipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateDetectionDto, UpdateScannerConfigDto } from './dto/admin-scanner.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  AiScannerService,
  ProductScanResponse,
} from './ai-scanner.service';

@ApiTags('AI Scanner')
@Controller('ai-scanner')
export class AiScannerController {
  constructor(private readonly aiScannerService: AiScannerService) {}

  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Detect furniture products in an uploaded image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'JPG, PNG, or WEBP image up to 10 MB.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Image analyzed and scan result saved' })
  @ApiResponse({ status: 400, description: 'Missing or invalid image' })
  scan(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [],
      }),
    )
    image: Express.Multer.File,
    @Req() request:Request&{user?:{sub?:string}},
  ): Promise<ProductScanResponse> {
    return this.aiScannerService.scan(image,request.user?.sub);
  }

  @Get('admin/history')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(Role.ADMIN)
  adminHistory(@Query('q')q?:string,@Query('needsReview')needsReview?:string){return this.aiScannerService.adminHistory(q,needsReview===undefined?undefined:needsReview==='true');}

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(Role.ADMIN)
  adminStats(){return this.aiScannerService.adminStats();}

  @Get('admin/errors')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(Role.ADMIN)
  adminErrors(){return this.aiScannerService.adminErrors();}

  @Get('admin/config')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(Role.ADMIN)
  getConfig(){return this.aiScannerService.getConfig();}

  @Patch('admin/config')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(Role.ADMIN)
  updateConfig(@Body()dto:UpdateScannerConfigDto){return this.aiScannerService.updateConfig(dto);}

  @Patch('admin/:scanId/detections/:detectionId')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(Role.ADMIN)
  updateDetection(@Param('scanId')scanId:string,@Param('detectionId')detectionId:string,@Body()dto:UpdateDetectionDto){return this.aiScannerService.updateDetection(scanId,detectionId,dto);}

  @Get(':id')
  @ApiOperation({ summary: 'Get a saved AI scan result' })
  @ApiParam({ name: 'id', description: 'MongoDB scan result id' })
  @ApiOkResponse({ description: 'Saved scan result returned' })
  @ApiResponse({ status: 400, description: 'Invalid scan result id' })
  @ApiResponse({ status: 404, description: 'Scan result not found' })
  findById(@Param('id') id: string): Promise<ProductScanResponse> {
    return this.aiScannerService.findById(id);
  }
}
