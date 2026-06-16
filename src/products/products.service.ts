import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { Product, ProductDocument } from './product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = await this.productModel.create({
      ...createProductDto,
      name: createProductDto.name.trim(),
      category: this.normalizeLabel(createProductDto.category),
      ecommercePlatform: createProductDto.ecommercePlatform.trim(),
      styleTags: createProductDto.styleTags.map((tag) =>
        this.normalizeLabel(tag),
      ),
    });

    return product;
  }

  async findAll(): Promise<Product[]> {
    return this.productModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(productId: string): Promise<Product> {
    this.assertValidObjectId(productId);

    const product = await this.productModel.findById(productId).exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findByStyle(style: string): Promise<Product[]> {
    const normalizedStyle = this.normalizeLabel(style);

    return this.productModel
      .find({ styleTags: normalizedStyle })
      .sort({ price: 1, createdAt: -1 })
      .exec();
  }

  async findByBudget(amount: number): Promise<Product[]> {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Budget amount must be a positive number');
    }

    return this.productModel
      .find({ price: { $lte: amount } })
      .sort({ price: 1, createdAt: -1 })
      .exec();
  }

  private normalizeLabel(value: string): string {
    return value.trim().toLowerCase();
  }

  private assertValidObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product id');
    }
  }
}
