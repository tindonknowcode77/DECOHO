import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  User,
  UserAvatar,
  UserDocument,
  UserRole,
  UserStatus,
} from './user.schema';

type AvatarUploadFile = Express.Multer.File & {
  path?: string;
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  format?: string;
};

@Injectable()
export class UsersService {
  private readonly passwordSaltRounds = Number(
    process.env.PASSWORD_SALT_ROUNDS ?? 12,
  );

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const email = createUserDto.email.toLowerCase().trim();
    await this.ensureEmailIsAvailable(email);

    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      this.passwordSaltRounds,
    );

    const user = await this.userModel.create({
      email,
      passwordHash,
      fullName: createUserDto.fullName.trim(),
      role: UserRole.User,
      preferences: createUserDto.preferences,
      status: UserStatus.Active,
    });

    return user;
  }

  async getProfile(userId: string): Promise<User> {
    return this.findActiveUserById(userId);
  }

  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    this.assertValidObjectId(userId);

    const update = this.buildProfileUpdate(updateUserDto);
    if (Object.keys(update).length === 0) {
      return this.getProfile(userId);
    }

    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          status: { $ne: UserStatus.Deleted },
          deletedAt: { $exists: false },
        },
        { $set: update },
        { new: true, runValidators: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async uploadAvatar(
    userId: string,
    avatarFile: AvatarUploadFile,
  ): Promise<User> {
    this.assertValidObjectId(userId);
    this.validateAvatarFile(avatarFile);

    const avatar = this.buildAvatarPayload(avatarFile);
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          status: { $ne: UserStatus.Deleted },
          deletedAt: { $exists: false },
        },
        { $set: { avatar } },
        { new: true, runValidators: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    this.assertValidObjectId(userId);

    const deletedAt = new Date();
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          status: { $ne: UserStatus.Deleted },
          deletedAt: { $exists: false },
        },
        {
          $set: {
            email: `deleted+${userId}.${Date.now()}@deleted.decoho.local`,
            passwordHash: `deleted:${randomUUID()}`,
            fullName: 'Deleted User',
            status: UserStatus.Deleted,
            deletedAt,
            preferences: {},
          },
          $unset: {
            avatar: '',
            lastLoginAt: '',
            refreshTokenHash: '',
          },
        },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        email: email.toLowerCase().trim(),
        status: { $ne: UserStatus.Deleted },
        deletedAt: { $exists: false },
      })
      .select('+passwordHash')
      .exec();
  }

  async findById(userId: string): Promise<User | null> {
    this.assertValidObjectId(userId);

    return this.userModel
      .findOne({
        _id: userId,
        status: { $ne: UserStatus.Deleted },
        deletedAt: { $exists: false },
      })
      .exec();
  }

  async findByIdWithRefreshToken(
    userId: string,
  ): Promise<UserDocument | null> {
    this.assertValidObjectId(userId);

    return this.userModel
      .findOne({
        _id: userId,
        status: { $ne: UserStatus.Deleted },
        deletedAt: { $exists: false },
      })
      .select('+refreshTokenHash')
      .exec();
  }

  async setRefreshTokenHash(
    userId: string,
    refreshTokenHash: string,
  ): Promise<void> {
    this.assertValidObjectId(userId);

    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          status: { $ne: UserStatus.Deleted },
          deletedAt: { $exists: false },
        },
        {
          $set: {
            refreshTokenHash,
            lastLoginAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  async clearRefreshTokenHash(userId: string): Promise<void> {
    this.assertValidObjectId(userId);

    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          status: { $ne: UserStatus.Deleted },
          deletedAt: { $exists: false },
        },
        { $unset: { refreshTokenHash: '' } },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async findActiveUserById(userId: string): Promise<User> {
    this.assertValidObjectId(userId);

    const user = await this.userModel
      .findOne({
        _id: userId,
        status: { $ne: UserStatus.Deleted },
        deletedAt: { $exists: false },
      })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureEmailIsAvailable(email: string): Promise<void> {
    const existingUser = await this.userModel.exists({ email });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }
  }

  private buildProfileUpdate(updateUserDto: UpdateUserDto): Partial<User> {
    const update: Partial<User> = {};

    if (updateUserDto.fullName !== undefined) {
      update.fullName = updateUserDto.fullName.trim();
    }

    if (updateUserDto.preferences !== undefined) {
      update.preferences = {
        ...updateUserDto.preferences,
        currency: updateUserDto.preferences.currency?.toUpperCase(),
      };
    }

    return update;
  }

  private validateAvatarFile(avatarFile?: AvatarUploadFile): void {
    if (!avatarFile) {
      throw new BadRequestException('Avatar file is required');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(avatarFile.mimetype)) {
      throw new BadRequestException(
        'Avatar must be a JPEG, PNG, or WEBP image',
      );
    }

    const maxFileSizeInBytes = 5 * 1024 * 1024;
    if (avatarFile.size > maxFileSizeInBytes) {
      throw new BadRequestException('Avatar must be 5MB or smaller');
    }
  }

  private buildAvatarPayload(avatarFile: AvatarUploadFile): UserAvatar {
    return {
      publicId: avatarFile.public_id ?? avatarFile.filename,
      secureUrl: avatarFile.secure_url ?? avatarFile.path,
      originalName: avatarFile.originalname,
      mimeType: avatarFile.mimetype,
      size: avatarFile.size,
      width: avatarFile.width,
      height: avatarFile.height,
      format:
        avatarFile.format ??
        avatarFile.originalname.split('.').pop()?.toLowerCase(),
    };
  }

  private assertValidObjectId(userId: string): void {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
  }
}
