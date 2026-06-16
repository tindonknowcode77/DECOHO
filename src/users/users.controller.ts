import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
  Get,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { User } from './user.schema';

type JwtRequestUser = {
  sub?: string;
  userId?: string;
  id?: string;
  _id?: string;
};

type AuthenticatedRequest = Request & {
  user?: JwtRequestUser;
};

@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiResponse({ status: 500, description: 'Internal server error' })
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ description: 'Current user profile returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@Req() request: AuthenticatedRequest): Promise<User> {
    return this.usersService.getProfile(this.getCurrentUserId(request));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiOkResponse({ description: 'User profile updated' })
  @ApiResponse({ status: 400, description: 'Invalid profile payload' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateProfile(
      this.getCurrentUserId(request),
      updateUserDto,
    );
  }

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({ summary: 'Upload or replace the authenticated user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'User avatar uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid avatar file' })
  @ApiResponse({ status: 404, description: 'User not found' })
  uploadAvatar(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() avatar: Express.Multer.File,
  ): Promise<User> {
    return this.usersService.uploadAvatar(
      this.getCurrentUserId(request),
      avatar,
    );
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete the authenticated user account' })
  @ApiNoContentResponse({ description: 'User account deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteAccount(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.usersService.deleteAccount(this.getCurrentUserId(request));
  }

  private getCurrentUserId(request: AuthenticatedRequest): string {
    const user = request.user;
    const userId = user?.sub ?? user?.userId ?? user?.id ?? user?._id;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user id is missing');
    }

    return userId;
  }
}
