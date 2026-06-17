import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDecorPlanDto } from './dto/create-decor-plan.dto';
import {
  DecorPlanService,
  GenerateDecorPlanResponse,
} from './decor-plan.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    userId?: string;
    id?: string;
    _id?: string;
  };
};

@ApiTags('Decor Plans')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiResponse({ status: 500, description: 'Decor plan generation failed' })
@UseGuards(JwtAuthGuard)
@Controller('decor-plans')
export class DecorPlanController {
  constructor(private readonly decorPlanService: DecorPlanService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a decoration plan for an uploaded room' })
  @ApiBody({
    schema: {
      example: {
        roomId: '666f8b1c8a7f5e0012a22201',
        budget: 5000000,
        style: 'Minimalist',
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Decor plan generated',
    schema: {
      example: {
        decorPlanId: '666f8b1c8a7f5e0012a44401',
        estimatedCost: 4500000,
        designSuggestion:
          'Use a calm Minimalist layout with neutral colors and compact storage pieces.',
        recommendedProducts: [],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid decor plan payload' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  generateDecorPlan(
    @Req() request: AuthenticatedRequest,
    @Body() createDecorPlanDto: CreateDecorPlanDto,
  ): Promise<GenerateDecorPlanResponse> {
    return this.decorPlanService.generateDecorPlan(
      this.getCurrentUserId(request),
      createDecorPlanDto,
    );
  }

  private getCurrentUserId(request: AuthenticatedRequest): string {
    const user = request.user;
    const userId = user?.sub ?? user?.userId ?? user?.id ?? user?._id;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user id is missing');
    }

    return userId;
  }
}
