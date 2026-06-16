import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiService } from '../ai/ai.service';
import { Product } from '../products/product.schema';
import { ProductsService } from '../products/products.service';
import { RoomsService } from '../rooms/rooms.service';
import { CreateDecorPlanDto } from './dto/create-decor-plan.dto';
import {
  DecorPlan,
  DecorPlanDocument,
  DecorStyle,
  RecommendedProduct,
} from './decor-plan.schema';

export type GenerateDecorPlanResponse = {
  estimatedCost: number;
  designSuggestion: string;
  recommendedProducts: RecommendedProductResponse[];
};

export type RecommendedProductResponse = {
  productId: string;
  name: string;
  price: number;
  image: string;
  category: string;
  ecommercePlatform: string;
  productLink: string;
  styleTags: string[];
};

type ProductLike = Product & {
  id?: string;
  _id?: Types.ObjectId | { toString(): string };
};

@Injectable()
export class DecorPlanService {
  private readonly maxRecommendedProducts = 8;

  constructor(
    @InjectModel(DecorPlan.name)
    private readonly decorPlanModel: Model<DecorPlanDocument>,
    private readonly roomsService: RoomsService,
    private readonly aiService: AiService,
    private readonly productsService: ProductsService,
  ) {}

  async generateDecorPlan(
    userId: string,
    createDecorPlanDto: CreateDecorPlanDto,
  ): Promise<GenerateDecorPlanResponse> {
    this.assertValidObjectId(userId);

    const room = await this.roomsService.getRoomById(
      userId,
      createDecorPlanDto.roomId,
    );

    const analysis = await this.aiService.analyzeRoom(room.imageUrl);
    const recommendedProducts = await this.recommendProducts(
      createDecorPlanDto.style,
      createDecorPlanDto.budget,
    );
    const estimatedCost = this.calculateEstimatedCost(recommendedProducts);

    const designSuggestion =
      await this.aiService.generateDecorationSuggestion({
        roomType: analysis.roomType,
        detectedObjects: analysis.detectedObjects,
        colors: analysis.colors,
        style: createDecorPlanDto.style,
        budget: createDecorPlanDto.budget,
        estimatedCost,
        productNames: recommendedProducts.map((product) => product.name),
      });

    await this.decorPlanModel.create({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(createDecorPlanDto.roomId),
      budget: createDecorPlanDto.budget,
      style: createDecorPlanDto.style,
      estimatedCost,
      designSuggestion,
      recommendedProducts,
      analysis,
    });

    return {
      estimatedCost,
      designSuggestion,
      recommendedProducts: recommendedProducts.map((product) =>
        this.toRecommendedProductResponse(product),
      ),
    };
  }

  private async recommendProducts(
    style: DecorStyle,
    budget: number,
  ): Promise<RecommendedProduct[]> {
    const productsByStyle = await this.productsService.findByStyle(style);
    let candidates = productsByStyle.filter(
      (product) => product.price <= budget,
    );

    if (candidates.length === 0) {
      candidates = await this.productsService.findByBudget(budget);
    }

    return this.selectProductsWithinBudget(candidates, budget).map((product) =>
      this.toRecommendedProduct(product),
    );
  }

  private selectProductsWithinBudget(
    products: Product[],
    budget: number,
  ): Product[] {
    const selectedProducts: Product[] = [];
    let totalCost = 0;

    for (const product of products) {
      if (selectedProducts.length >= this.maxRecommendedProducts) {
        break;
      }

      if (totalCost + product.price > budget) {
        continue;
      }

      selectedProducts.push(product);
      totalCost += product.price;
    }

    return selectedProducts;
  }

  private calculateEstimatedCost(products: RecommendedProduct[]): number {
    return products.reduce((total, product) => total + product.price, 0);
  }

  private toRecommendedProduct(product: Product): RecommendedProduct {
    const productLike = product as ProductLike;
    const productId = productLike.id ?? productLike._id?.toString();

    if (!productId || !Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid recommended product id');
    }

    return {
      productId: new Types.ObjectId(productId),
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      ecommercePlatform: product.ecommercePlatform,
      productLink: product.productLink,
      styleTags: product.styleTags,
    };
  }

  private toRecommendedProductResponse(
    product: RecommendedProduct,
  ): RecommendedProductResponse {
    return {
      productId: product.productId.toString(),
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      ecommercePlatform: product.ecommercePlatform,
      productLink: product.productLink,
      styleTags: product.styleTags,
    };
  }

  private assertValidObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid object id');
    }
  }
}
