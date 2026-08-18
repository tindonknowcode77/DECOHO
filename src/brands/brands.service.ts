import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument, ProductStatus } from '../products/product.schema';
import { SupplierApplicationStatus, User, UserDocument, UserRole } from '../users/user.schema';
import { Brand, BrandDocument } from './brand.schema';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name) private readonly brandModel: Model<BrandDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  findPublic() {
    return this.brandModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  findAllForAdmin() {
    return this.brandModel.find().populate('supplierIds', 'fullName email supplierStoreName').sort({ createdAt: -1 }).exec();
  }

  async create(dto: CreateBrandDto) {
    const slug = await this.uniqueSlug(dto.name);
    return this.brandModel.create({ ...dto, name: dto.name.trim(), slug, isActive: dto.isActive ?? true });
  }

  async update(id: string, dto: UpdateBrandDto) {
    this.assertId(id);
    const update: Record<string, unknown> = { ...dto };
    if (dto.name) { update.name = dto.name.trim(); update.slug = await this.uniqueSlug(dto.name, id); }
    const brand = await this.brandModel.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).exec();
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async setVisibility(id: string, isActive: boolean) {
    this.assertId(id);
    const brand = await this.brandModel.findByIdAndUpdate(id, { $set: { isActive } }, { new: true }).exec();
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async linkSuppliers(id: string, supplierIds: string[]) {
    this.assertId(id);
    supplierIds.forEach((supplierId) => this.assertId(supplierId));
    const validSuppliers = await this.userModel.find({
      _id: { $in: supplierIds.map((supplierId) => new Types.ObjectId(supplierId)) },
      role: UserRole.Supplier,
      supplierApplicationStatus: SupplierApplicationStatus.Approved,
    }).select('_id').lean().exec();
    if (validSuppliers.length !== supplierIds.length) {
      throw new BadRequestException('Every linked account must be an approved supplier');
    }
    const brand = await this.brandModel.findByIdAndUpdate(
      id,
      { $set: { supplierIds: validSuppliers.map((supplier) => supplier._id) } },
      { new: true, runValidators: true },
    ).populate('supplierIds', 'fullName email supplierStoreName').exec();
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async getProducts(id: string, admin = false) {
    this.assertId(id);
    if (!(await this.brandModel.exists({ _id: id, ...(admin ? {} : { isActive: true }) }))) throw new NotFoundException('Brand not found');
    return this.productModel.find({
      brandId: new Types.ObjectId(id),
      ...(admin ? {} : { isLocked: { $ne: true }, status: { $in: [ProductStatus.Approved, ProductStatus.OutOfStock] } }),
    }).sort({ isFeatured: -1, createdAt: -1 }).exec();
  }

  async remove(id: string): Promise<void> {
    this.assertId(id);
    if (await this.productModel.exists({ brandId: new Types.ObjectId(id) })) throw new ConflictException('Cannot delete a brand that has products');
    if (!(await this.brandModel.findByIdAndDelete(id).exec())) throw new NotFoundException('Brand not found');
  }

  private assertId(id: string) { if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id'); }
  private async uniqueSlug(name: string, excludeId?: string) {
    const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand';
    for (let index = 0; index < 1000; index += 1) {
      const slug = index ? `${base}-${index + 1}` : base;
      const filter: Record<string, unknown> = { slug };
      if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };
      if (!(await this.brandModel.exists(filter))) return slug;
    }
    throw new ConflictException('Unable to create a unique brand slug');
  }
}
