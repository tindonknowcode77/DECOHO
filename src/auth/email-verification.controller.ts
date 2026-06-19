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
        valid: true,
        message: 'Email verified successfully',
        user: {
          id: '666f8b1c8a7f5e0012a11101',
          email: 'maya@example.com',
          fullName: 'Maya Chen',
          role: 'user',
          status: 'active',
          isEmailVerified: true,
          emailVerifiedAt: '2026-06-19T10:00:00.000Z',
        },
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
