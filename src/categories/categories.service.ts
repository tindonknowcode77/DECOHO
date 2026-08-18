import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Category, CategoryDocument } from './category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

export type CategoryListItem = {
  _id: Types.ObjectId;
  id: string;
  name: string;
  slug: string;
  parentId?: Types.ObjectId | null;
  imageUrl?: string;
  imagePublicId?: string;
  displayOrder: number;
  isActive: boolean;
};

export type CategoryTreeItem = CategoryListItem & {
  children: CategoryListItem[];
};

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findAll(): Promise<CategoryListItem[]> {
    const categories = (await this.categoryModel.find().sort({ displayOrder: 1, name: 1 }).lean().exec()) as CategoryListItem[];
    return categories.map((category) => ({ ...category, id: category._id.toString() }));
  }

  async findTree(): Promise<CategoryTreeItem[]> {
    const categories = await this.findAll();
    return categories.filter((item) => !item.parentId).map((parent) => ({
      ...parent,
      children: categories.filter((item) => item.parentId?.toString() === parent.id),
    }));
  }

  async create(dto: CreateCategoryDto) {
    await this.assertParent(dto.parentId);
    const slug = await this.createUniqueSlug(dto.name);
    return this.categoryModel.create({
      ...dto,
      name: dto.name.trim(),
      slug,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    this.assertId(id);
    if (dto.parentId === id) throw new BadRequestException('Category cannot be its own parent');
    await this.assertParent(dto.parentId);
    const update: Record<string, unknown> = { ...dto };
    if (dto.name) { update.name = dto.name.trim(); update.slug = await this.createUniqueSlug(dto.name, id); }
    if (dto.parentId !== undefined) update.parentId = dto.parentId ? new Types.ObjectId(dto.parentId) : null;
    const category = await this.categoryModel.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).exec();
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    this.assertId(id);
    const image = await this.cloudinaryService.uploadImage(file, 'decoho/categories');
    const category = await this.categoryModel.findByIdAndUpdate(id, { $set: { imageUrl: image.secureUrl, imagePublicId: image.publicId } }, { new: true }).exec();
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async reorder(items: Array<{ id: string; displayOrder: number }>): Promise<CategoryTreeItem[]> {
    items.forEach((item) => this.assertId(item.id));
    await this.categoryModel.bulkWrite(items.map((item) => ({ updateOne: { filter: { _id: item.id }, update: { $set: { displayOrder: item.displayOrder } } } })));
    return this.findTree();
  }

  async remove(id: string): Promise<void> {
    this.assertId(id);
    if (await this.categoryModel.exists({ parentId: new Types.ObjectId(id) })) {
      throw new ConflictException('Delete or move subcategories first');
    }
    const category = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!category) throw new NotFoundException('Category not found');
    if (category.imagePublicId) await this.cloudinaryService.deleteImage(category.imagePublicId).catch(() => undefined);
  }

  private async assertParent(parentId?: string) {
    if (!parentId) return;
    this.assertId(parentId);
    if (!(await this.categoryModel.exists({ _id: parentId }))) throw new BadRequestException('Parent category not found');
  }

  private assertId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid category id');
  }

  private async createUniqueSlug(name: string, excludeId?: string) {
    const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
    for (let index = 0; index < 1000; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`;
      const filter: Record<string, unknown> = { slug };
      if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };
      if (!(await this.categoryModel.exists(filter))) return slug;
    }
    throw new ConflictException('Unable to create a unique category slug');
  }
}
