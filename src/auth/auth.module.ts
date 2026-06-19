import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationController } from './email-verification.controller';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenStrategy } from './refresh-token.strategy';

@Module({
  imports: [UsersModule, MailModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController, EmailVerificationController],
  providers: [AuthService, JwtStrategy, RefreshTokenStrategy, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
