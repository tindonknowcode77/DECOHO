import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User, UserStatus } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import { normalizeRole, Role } from '../common/enums/roles.enum';

type UserWithPrivateFields = User & {
  id?: string;
  _id?: { toString(): string };
  passwordHash?: string;
  refreshTokenHash?: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
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

type PasswordResetPayload = {
  sub: string;
  email: string;
  nonce: string;
  type: 'password_reset';
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type AuthUserResponse = {
  _id: string;
  email: string;
  fullName: string;
  avatar?: unknown;
  role: string;
  status: string;
  isVerified: boolean;
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
  onboardingCompleted: boolean;
};

type RegisteredUserResponse = Pick<
  AuthUserResponse,
  '_id' | 'email' | 'fullName' | 'role' | 'isVerified'
>;

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
  user: RegisteredUserResponse;
  verifyToken?: string;
  verifyLink: string;
  emailSent: boolean;
};

type ResendVerificationResponse = {
  message: string;
  verifyToken?: string;
  verifyLink: string;
  emailSent: boolean;
};

type VerifyAccessTokenResponse = {
  valid: true;
  user: AuthUserResponse;
};

type VerifyEmailTokenResponse = {
  message: string;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string;
  exp?: string;
  given_name?: string;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
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
      user: this.toRegisteredUserResponse(user),
      verifyToken: emailVerification.verificationToken,
      verifyLink: emailVerification.verificationLink,
      emailSent: emailVerification.emailSent,
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

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email before login');
    }

    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Account is suspended');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user, tokens.refreshToken);

    return {
      ...tokens,
      user: this.toAuthUserResponse(user),
    };
  }

  async requestPasswordReset(email: string): Promise<{ message: string; emailSent: boolean }> {
    const generic = { message: 'Nếu email tồn tại, DECOHO đã gửi liên kết đặt lại mật khẩu.', emailSent: false };
    const user = (await this.usersService.findByEmail(email)) as UserWithPrivateFields | null;
    if (!user || user.status !== UserStatus.Active) return generic;

    const nonce = randomBytes(32).toString('hex');
    const expiresIn = this.getPasswordResetExpiresIn();
    const token = await this.jwtService.signAsync<PasswordResetPayload>({ sub: this.getUserId(user), email: user.email, nonce, type: 'password_reset' }, { secret: this.getPasswordResetSecret(), expiresIn });
    const expiresAt = new Date(Date.now() + this.durationToMilliseconds(String(expiresIn)));
    await this.usersService.setPasswordResetToken(this.getUserId(user), await bcrypt.hash(nonce, this.passwordSaltRounds), expiresAt);

    const emailSent = await this.mailService.sendPasswordResetEmail({
      to: user.email, fullName: user.fullName,
      resetLink: this.buildPasswordResetLink(token), expiresIn: String(expiresIn),
    });
    return { ...generic, emailSent };
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const payload = await this.verifyPasswordResetToken(token);
    const user = (await this.usersService.findByIdWithPasswordResetToken(payload.sub)) as UserWithPrivateFields | null;
    if (!user?.passwordResetTokenHash || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
    const validNonce = await bcrypt.compare(payload.nonce, user.passwordResetTokenHash);
    if (!validNonce) throw new UnauthorizedException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng');
    await this.usersService.resetPassword(payload.sub, await bcrypt.hash(password, this.passwordSaltRounds));
    return { message: 'Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.' };
  }

  async googleLogin(credential: string): Promise<AuthResponse> {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new InternalServerErrorException('GOOGLE_CLIENT_ID is not configured');
    }

    let response: Response;
    try {
      response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) },
      );
    } catch {
      throw new UnauthorizedException('Unable to verify Google login');
    }

    if (!response.ok) throw new UnauthorizedException('Invalid Google ID token');
    const profile = (await response.json()) as GoogleTokenInfo;
    const issuerIsValid = profile.iss === 'accounts.google.com' || profile.iss === 'https://accounts.google.com';
    const isValid = profile.aud === clientId && profile.email_verified === 'true' && Boolean(profile.email && profile.sub) && issuerIsValid && Number(profile.exp ?? 0) * 1000 > Date.now();
    if (!isValid || !profile.email || !profile.sub) {
      throw new UnauthorizedException('Google account could not be verified');
    }

    const user = (await this.usersService.findOrCreateGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      fullName: profile.name || profile.given_name || profile.email.split('@')[0],
      avatarUrl: profile.picture,
    })) as UserWithPrivateFields;
    if (user.status !== UserStatus.Active) throw new UnauthorizedException('Account is suspended');

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user, tokens.refreshToken);
    return { ...tokens, user: this.toAuthUserResponse(user) };
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

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email before login');
    }

    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Account is suspended');
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

    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const emailVerification =
      await this.createAndSendEmailVerificationLink(user);

    return {
      message: 'Verification email resent',
      verifyToken: emailVerification.verificationToken,
      verifyLink: emailVerification.verificationLink,
      emailSent: emailVerification.emailSent,
    };
  }

  async verifyEmailToken(token: string): Promise<VerifyEmailTokenResponse> {
    const payload = await this.verifyEmailVerificationToken(token);
    await this.usersService.markEmailAsVerified(payload.sub);

    return {
      message: 'Email verified successfully',
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

  private async verifyPasswordResetToken(token: string): Promise<PasswordResetPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<PasswordResetPayload>(token, { secret: this.getPasswordResetSecret() });
      if (payload.type !== 'password_reset' || !payload.sub || !payload.nonce) throw new UnauthorizedException('Invalid password reset token');
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
  }

  private async generateTokens(user: UserWithPrivateFields): Promise<TokenPair> {
    const payload: TokenPayload = {
      sub: this.getUserId(user),
      email: user.email,
      role: this.normalizeUserRole(user.role),
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
      _id: this.getUserId(user),
      email: data.email as string,
      fullName: data.fullName as string,
      avatar: data.avatar,
      role: this.normalizeUserRole(data.role as string),
      status: data.status as string,
      isVerified: Boolean(data.isVerified),
      lastLoginAt: data.lastLoginAt as Date | undefined,
      emailVerifiedAt: data.emailVerifiedAt as Date | undefined,
      onboardingCompleted: Boolean(data.onboardingCompleted),
    };
  }

  private toRegisteredUserResponse(
    user: UserWithPrivateFields,
  ): RegisteredUserResponse {
    const authUser = this.toAuthUserResponse(user);

    return {
      _id: authUser._id,
      fullName: authUser.fullName,
      email: authUser.email,
      role: authUser.role,
      isVerified: authUser.isVerified,
    };
  }

  private getUserId(user: UserWithPrivateFields): string {
    const userId = user.id ?? user._id?.toString();

    if (!userId) {
      throw new InternalServerErrorException('User id is missing');
    }

    return userId;
  }

  private normalizeUserRole(role?: string): Role {
    return normalizeRole(role) ?? Role.USER;
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

  private getPasswordResetSecret(): string { return process.env.JWT_PASSWORD_RESET_SECRET ?? this.getRequiredEnv('JWT_ACCESS_SECRET'); }

  private getPasswordResetExpiresIn(): NonNullable<JwtSignOptions['expiresIn']> {
    return (process.env.JWT_PASSWORD_RESET_EXPIRES_IN ?? '15m') as NonNullable<JwtSignOptions['expiresIn']>;
  }

  private buildPasswordResetLink(token: string): string {
    const url = new URL(process.env.PASSWORD_RESET_URL ?? 'http://localhost:3000/reset-password');
    url.searchParams.set('token', token);
    return url.toString();
  }

  private durationToMilliseconds(value: string): number {
    const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
    if (!match) return 15 * 60 * 1000;
    const amount = Number(match[1]);
    const unit = (match[2] ?? 'ms').toLowerCase();
    return amount * ({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] ?? 1);
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
