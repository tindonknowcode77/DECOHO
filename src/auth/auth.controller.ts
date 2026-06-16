import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Request } from 'express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class LoginDto {
  @ApiProperty({ example: 'maya@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Str0ngP@ssword!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token. Prefer sending it as a Bearer token in the Authorization header.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

type AuthenticatedRequestUser = {
  sub?: string;
  userId?: string;
  id?: string;
  _id?: string;
  refreshToken?: string;
};

type AuthenticatedRequest = Request & {
  user?: AuthenticatedRequestUser;
};

@ApiTags('Auth')
@ApiResponse({ status: 500, description: 'Internal server error' })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiCreatedResponse({ description: 'User registered and tokens returned' })
  @ApiResponse({ status: 400, description: 'Invalid registration payload' })
  @ApiResponse({ status: 409, description: 'Email is already registered' })
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ description: 'Access and refresh tokens returned' })
  @ApiResponse({ status: 400, description: 'Invalid login payload' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiOkResponse({ description: 'New access and refresh tokens returned' })
  @ApiResponse({ status: 400, description: 'Invalid refresh token payload' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  refresh(@Req() request: AuthenticatedRequest) {
    const user = this.getCurrentUser(request);

    if (!user.refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    return this.authService.refresh(user.sub, user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke the current refresh token' })
  @ApiNoContentResponse({ description: 'Refresh token revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.authService.logout(this.getCurrentUserId(request));
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ description: 'Authenticated user profile returned' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  profile(@Req() request: AuthenticatedRequest) {
    return this.authService.getProfile(this.getCurrentUserId(request));
  }

  private getCurrentUser(request: AuthenticatedRequest): Required<
    Pick<AuthenticatedRequestUser, 'sub'>
  > &
    AuthenticatedRequestUser {
    const user = request.user;
    const userId = user?.sub ?? user?.userId ?? user?.id ?? user?._id;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user id is missing');
    }

    return {
      ...user,
      sub: userId,
    };
  }

  private getCurrentUserId(request: AuthenticatedRequest): string {
    return this.getCurrentUser(request).sub;
  }
}
