import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  User = 'USER',
  Supplier = 'SUPPLIER',
  Staff = 'STAFF',
  Admin = 'ADMIN',
  SuperAdmin = 'SUPER_ADMIN',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

export enum SupplierApplicationStatus {
  None = 'NONE',
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Suspended = 'SUSPENDED',
}

@Schema({ _id: false })
export class UserAvatar {
  @Prop({ trim: true })
  publicId?: string;

  @Prop({ trim: true })
  secureUrl?: string;

  @Prop({ trim: true })
  originalName?: string;

  @Prop({ trim: true })
  mimeType?: string;

  @Prop({ min: 0 })
  size?: number;

  @Prop({ min: 0 })
  width?: number;

  @Prop({ min: 0 })
  height?: number;

  @Prop({ trim: true })
  format?: string;
}

export const UserAvatarSchema = SchemaFactory.createForClass(UserAvatar);

@Schema({ _id: false })
export class UserPreferences {
  @Prop({ type: [String], default: [] })
  styles?: string[];

  @Prop({ min: 0 })
  budgetMin?: number;

  @Prop({ min: 0 })
  budgetMax?: number;

  @Prop({ trim: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency?: string;
}

export const UserPreferencesSchema =
  SchemaFactory.createForClass(UserPreferences);

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ trim: true, index: true, sparse: true })
  googleId?: string;

  @Prop({ enum: ['local', 'google'], default: 'local' })
  authProvider?: 'local' | 'google';

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop({ select: false })
  passwordResetTokenHash?: string;

  @Prop({ select: false })
  passwordResetExpiresAt?: Date;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ trim: true, maxlength: 20, index: true })
  phone?: string;

  @Prop({ type: UserAvatarSchema })
  avatar?: UserAvatar;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.User,
  })
  role: UserRole;

  @Prop({
    type: String,
    enum: Object.values(SupplierApplicationStatus),
    default: SupplierApplicationStatus.None,
    index: true,
  })
  supplierApplicationStatus: SupplierApplicationStatus;

  @Prop({ trim: true, maxlength: 160 })
  supplierStoreName?: string;

  @Prop({ trim: true, maxlength: 1000 })
  supplierApplicationMessage?: string;

  @Prop({ trim: true, maxlength: 100 })
  businessLicenseNumber?: string;

  @Prop({ trim: true, maxlength: 1000 })
  businessLicenseUrl?: string;

  @Prop({ trim: true, maxlength: 300 })
  businessAddress?: string;

  @Prop({ trim: true, maxlength: 1200 })
  supplierDescription?: string;

  @Prop({ trim: true, maxlength: 254, lowercase: true })
  supplierContactEmail?: string;

  @Prop({ trim: true, maxlength: 20 })
  supplierContactPhone?: string;

  @Prop({ trim: true, maxlength: 500 })
  supplierWebsite?: string;

  @Prop({ trim: true, maxlength: 100 })
  supplierTaxCode?: string;

  @Prop({ type: [String], default: [] })
  supplierShippingAreas?: string[];

  @Prop({ trim: true, maxlength: 1000 })
  supplierWarrantyPolicy?: string;

  @Prop({ trim: true, maxlength: 1000 })
  supplierReturnPolicy?: string;

  @Prop({ trim: true, maxlength: 120 })
  supplierBankName?: string;

  @Prop({ trim: true, maxlength: 50 })
  supplierBankAccountNumber?: string;

  @Prop({ trim: true, maxlength: 160 })
  supplierBankAccountName?: string;

  @Prop({ default: false })
  supplierInformationRequired?: boolean;

  @Prop({ trim: true, maxlength: 500 })
  supplierReviewNote?: string;

  @Prop()
  supplierAppliedAt?: Date;

  @Prop()
  supplierReviewedAt?: Date;

  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
  })
  status: UserStatus;

  @Prop({ default: false, index: true })
  isVerified: boolean;

  @Prop()
  emailVerifiedAt?: Date;

  @Prop({ type: UserPreferencesSchema, default: {} })
  preferences?: UserPreferences;

  @Prop({ default: false, index: true })
  onboardingCompleted?: boolean;

  @Prop({ type: Object, default: {} })
  onboardingPreferences?: Record<string, unknown>;

  @Prop()
  onboardingCompletedAt?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ supplierApplicationStatus: 1, supplierAppliedAt: 1 });
UserSchema.index({ status: 1, createdAt: -1 });
UserSchema.index({ isVerified: 1, createdAt: -1 });
UserSchema.index(
  { deletedAt: 1 },
  { partialFilterExpression: { deletedAt: { $exists: true } } },
);

UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    return ret;
  },
});

UserSchema.set('toObject', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    return ret;
  },
});
