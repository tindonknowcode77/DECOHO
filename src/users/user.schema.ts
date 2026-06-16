import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
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

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop({ required: true, trim: true })
  fullName: string;

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
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
  })
  status: UserStatus;

  @Prop({ type: UserPreferencesSchema, default: {} })
  preferences?: UserPreferences;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ status: 1, createdAt: -1 });
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
