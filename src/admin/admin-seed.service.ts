import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import {
  SupplierApplicationStatus,
  User,
  UserDocument,
  UserRole,
  UserStatus,
} from '../users/user.schema';

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      this.logger.warn(
        'Admin seed skipped. Configure ADMIN_EMAIL and ADMIN_PASSWORD.',
      );
      return;
    }

    if (password.length < 10) {
      this.logger.error('ADMIN_PASSWORD must contain at least 10 characters.');
      return;
    }

    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      if (existingUser.role === UserRole.Admin) {
        await this.userModel.updateOne(
          { _id: existingUser._id },
          { $set: { role: UserRole.SuperAdmin, isVerified: true } },
        );
        this.logger.log(`Existing admin promoted to SUPER_ADMIN: ${email}`);
      } else if (existingUser.role !== UserRole.SuperAdmin) {
        this.logger.warn(
          `Admin seed skipped because ${email} already belongs to a non-admin account.`,
        );
      }
      return;
    }

    const passwordHash = await bcrypt.hash(
      password,
      Number(process.env.PASSWORD_SALT_ROUNDS ?? 12),
    );

    await this.userModel.create({
      email,
      passwordHash,
      fullName: process.env.ADMIN_FULL_NAME?.trim() || 'DECOHO Admin',
      role: UserRole.SuperAdmin,
      status: UserStatus.Active,
      supplierApplicationStatus: SupplierApplicationStatus.None,
      isVerified: true,
      emailVerifiedAt: new Date(),
    });

    this.logger.log(`Admin account created: ${email}`);
  }
}
