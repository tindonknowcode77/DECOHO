import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import {
  CommunityFollow,
  CommunityFollowSchema,
  CommunityNotification,
  CommunityNotificationSchema,
  CommunityPost,
  CommunityPostSchema,
  CommunityStory,
  CommunityStorySchema,
} from './community.schema';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [
    AuthModule,
    CloudinaryModule,
    MongooseModule.forFeature([
      { name: CommunityPost.name, schema: CommunityPostSchema },
      { name: CommunityFollow.name, schema: CommunityFollowSchema },
      { name: CommunityNotification.name, schema: CommunityNotificationSchema },
      { name: CommunityStory.name, schema: CommunityStorySchema },
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
