import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@ApiResponse({ status: 500, description: 'Internal server error' })
@Controller('verify-email')
export class EmailVerificationController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'Verify email by clicking the verification link' })
  @ApiOkResponse({
    description: 'Email verified',
    schema: {
      example: {
        message: 'Email verified successfully',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired verification token',
  })
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmailToken(token);
  }
}
