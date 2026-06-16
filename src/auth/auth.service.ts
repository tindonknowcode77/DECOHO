import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/user.schema';
import { UsersService } from '../users/users.service';

type UserWithPrivateFields = User & {
  id?: string;
  _id?: { toString(): string };
  refreshTokenHash?: string;
  toObject?: () => Record<string, unknown>;
};

type TokenPayload = {
  sub: string;
  email: string;
  role: string;
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
  preferences?: unknown;
  lastLoginAt?: Date;
};

type AuthResponse = TokenPair & {
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
  ) {}

  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    const user = (await this.usersService.create(
      createUserDto,
    )) as UserWithPrivateFields;

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user, tokens.refreshToken);

    return {
      ...tokens,
      user: this.toAuthUserResponse(user),
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = (await this.usersService.findByEmail(
      email,
    )) as UserWithPrivateFields | null;

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
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

  async getProfile(userId: string): Promise<AuthUserResponse> {
    const user = (await this.usersService.getProfile(
      userId,
    )) as UserWithPrivateFields;

    return this.toAuthUserResponse(user);
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
      preferences: data.preferences,
      lastLoginAt: data.lastLoginAt as Date | undefined,
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

  private getJwtExpiresIn(
    name: string,
    fallback: NonNullable<JwtSignOptions['expiresIn']>,
  ): JwtSignOptions['expiresIn'] {
    return (process.env[name] ??
      fallback) as NonNullable<JwtSignOptions['expiresIn']>;
  }
}
