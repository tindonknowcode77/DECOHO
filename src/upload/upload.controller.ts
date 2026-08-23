import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPPLIER)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a product image to Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Image uploaded',
    schema: {
      type: 'object',
      properties: {
        secureUrl: { type: 'string' },
        url: { type: 'string' },
        publicId: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
    },
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required (multipart field "file")');
    }
    const folder = process.env.CLOUDINARY_FOLDER
      ? `${process.env.CLOUDINARY_FOLDER}/products`
      : 'decoho/products';

    const result = await this.cloudinaryService.uploadImage(file, folder);
    return {
      secureUrl: result.secureUrl,
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
    };
  }
}
