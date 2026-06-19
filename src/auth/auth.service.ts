import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/user.schema';
import { UsersService } from '../users/users.service';

type UserWithPrivateFields = User & {
  id?: string;
  _id?: { toString(): string };
  passwordHash?: string;
  refreshTokenHash?: string;
  toObject?: () => Record<string, unknown>;
};

type TokenPayload = {
  sub: string;
  email: string;
  role: string;
};

type EmailVerificationPayload = {
  sub: string;
  email: string;
  type: 'email_verification';
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type AuthUserResponse = {
  id: string;
  email: string;
  fullName: string;
  avatar?: unknown;
  role: string;
  status: string;
  isEmailVerified: boolean;
  preferences?: unknown;
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
};

type AuthResponse = TokenPair & {
  user: AuthUserResponse;
};

type EmailVerificationResponse = {
  message: string;
  emailSent: boolean;
  verificationLink: string;
  expiresIn: string;
  verificationToken?: string;
};

type RegisterResponse = {
  message: string;
  user: AuthUserResponse;
  emailVerification: EmailVerificationResponse;
};

type ResendVerificationResponse = {
  message: string;
  emailVerification: EmailVerificationResponse;
};

type VerifyAccessTokenResponse = {
  valid: true;
  user: AuthUserResponse;
};

type VerifyEmailTokenResponse = {
  valid: true;
  message: string;
  user: AuthUserResponse;
};

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds = Number(
    process.env.PASSWORD_SALT_ROUNDS ?? 12,
  );

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<RegisterResponse> {
    const user = (await this.usersService.create(
      createUserDto,
    )) as UserWithPrivateFields;

    const emailVerification =
      await this.createAndSendEmailVerificationLink(user);

    return {
      message: 'Registration successful. Please verify your email before login.',
      user: this.toAuthUserResponse(user),
      emailVerification,
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = (await this.usersService.findByEmail(
      email,
    )) as UserWithPrivateFields | null;

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before login');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user, tokens.refreshToken);

    return {
      ...tokens,
      user: this.toAuthUserResponse(user),
    };
  }

  async refresh(userId: string, refreshToken: string): Promise<AuthResponse> {
    const user = (await this.usersService.findByIdWithRefreshToken(
      userId,
    )) as UserWithPrivateFields | null;

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before login');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user, tokens.refreshToken);

    return {
      ...tokens,
      user: this.toAuthUserResponse(user),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.clearRefreshTokenHash(userId);
  }

  async verifyAccessToken(userId: string): Promise<VerifyAccessTokenResponse> {
    const user = (await this.usersService.getProfile(
      userId,
    )) as UserWithPrivateFields;

    return {
      valid: true,
      user: this.toAuthUserResponse(user),
    };
  }

  async resendVerificationToken(
    email: string,
  ): Promise<ResendVerificationResponse> {
    const user = (await this.usersService.findByEmail(
      email,
    )) as UserWithPrivateFields | null;

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const emailVerification =
      await this.createAndSendEmailVerificationLink(user);

    return {
      message: 'Verification email resent',
      emailVerification,
    };
  }

  async verifyEmailToken(token: string): Promise<VerifyEmailTokenResponse> {
    const payload = await this.verifyEmailVerificationToken(token);
    const user = (await this.usersService.markEmailAsVerified(
      payload.sub,
    )) as UserWithPrivateFields;

    return {
      valid: true,
      message: 'Email verified successfully',
      user: this.toAuthUserResponse(user),
    };
  }

  async getProfile(userId: string): Promise<AuthUserResponse> {
    const user = (await this.usersService.getProfile(
      userId,
    )) as UserWithPrivateFields;

    return this.toAuthUserResponse(user);
  }

  private async createAndSendEmailVerificationLink(
    user: UserWithPrivateFields,
  ): Promise<EmailVerificationResponse> {
    const expiresIn = this.getEmailVerificationExpiresIn();
    const verificationToken = await this.generateEmailVerificationToken(
      user,
      expiresIn,
    );
    const verificationLink =
      this.buildEmailVerificationLink(verificationToken);
    const emailSent = await this.mailService.sendVerificationLinkEmail({
      to: user.email,
      fullName: user.fullName,
      verificationLink,
      expiresIn: String(expiresIn),
    });

    return {
      message: emailSent
        ? 'Verification email sent'
        : 'Verification link generated. Configure Gmail SMTP to send email',
      emailSent,
      verificationLink,
      expiresIn: String(expiresIn),
      ...(this.shouldExposeVerificationTokenInResponse()
        ? { verificationToken }
        : {}),
    };
  }

  private async generateEmailVerificationToken(
    user: UserWithPrivateFields,
    expiresIn: NonNullable<JwtSignOptions['expiresIn']>,
  ): Promise<string> {
    const payload: EmailVerificationPayload = {
      sub: this.getUserId(user),
      email: user.email,
      type: 'email_verification',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getEmailVerificationSecret(),
      expiresIn,
    });
  }

  private async verifyEmailVerificationToken(
    token: string,
  ): Promise<EmailVerificationPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<EmailVerificationPayload>(token, {
          secret: this.getEmailVerificationSecret(),
        });

      if (payload.type !== 'email_verification' || !payload.sub) {
        throw new UnauthorizedException('Invalid verification token');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired verification token');
    }
  }

  private async generateTokens(user: UserWithPrivateFields): Promise<TokenPair> {
    const payload: TokenPayload = {
      sub: this.getUserId(user),
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.getRequiredEnv('JWT_ACCESS_SECRET'),
        expiresIn: this.getJwtExpiresIn('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.getRequiredEnv('JWT_REFRESH_SECRET'),
        expiresIn: this.getJwtExpiresIn('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    user: UserWithPrivateFields,
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      this.passwordSaltRounds,
    );

    await this.usersService.setRefreshTokenHash(
      this.getUserId(user),
      refreshTokenHash,
    );
  }

  private toAuthUserResponse(user: UserWithPrivateFields): AuthUserResponse {
    const data =
      typeof user.toObject === 'function'
        ? (user.toObject() as Record<string, unknown>)
        : (user as unknown as Record<string, unknown>);

    return {
      id: this.getUserId(user),
      email: data.email as string,
      fullName: data.fullName as string,
      avatar: data.avatar,
      role: data.role as string,
      status: data.status as string,
      isEmailVerified: Boolean(data.isEmailVerified),
      preferences: data.preferences,
      lastLoginAt: data.lastLoginAt as Date | undefined,
      emailVerifiedAt: data.emailVerifiedAt as Date | undefined,
    };
  }

  private getUserId(user: UserWithPrivateFields): string {
    const userId = user.id ?? user._id?.toString();

    if (!userId) {
      throw new InternalServerErrorException('User id is missing');
    }

    return userId;
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }

  private getEmailVerificationSecret(): string {
    return (
      process.env.JWT_EMAIL_VERIFICATION_SECRET ??
      this.getRequiredEnv('JWT_ACCESS_SECRET')
    );
  }

  private getEmailVerificationExpiresIn(): NonNullable<
    JwtSignOptions['expiresIn']
  > {
    return (process.env.JWT_EMAIL_VERIFICATION_EXPIRES_IN ??
      '1d') as NonNullable<JwtSignOptions['expiresIn']>;
  }

  private buildEmailVerificationLink(token: string): string {
    const verificationUrl =
      process.env.EMAIL_VERIFICATION_URL ??
      'http://localhost:3000/api/verify-email';
    const url = new URL(verificationUrl);

    url.searchParams.set('token', token);

    return url.toString();
  }

  private shouldExposeVerificationTokenInResponse(): boolean {
    const explicitValue = process.env.EMAIL_VERIFICATION_EXPOSE_TOKEN;
    if (explicitValue !== undefined) {
      return explicitValue === 'true';
    }

    return true;
  }

  private getJwtExpiresIn(
    name: string,
    fallback: NonNullable<JwtSignOptions['expiresIn']>,
  ): JwtSignOptions['expiresIn'] {
    return (process.env[name] ??
      fallback) as NonNullable<JwtSignOptions['expiresIn']>;
  }
}
