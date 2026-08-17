import { GoogleGenAI } from '@google/genai';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../products/product.schema';
import { UpdateDetectionDto, UpdateScannerConfigDto } from './dto/admin-scanner.dto';
import {
  AiScannerConfig,
  AiScannerConfigDocument,
  AiScannerError,
  AiScannerErrorDocument,
  DetectedProduct,
  DetectionStatus,
  ScanResult,
  ScanResultDocument,
} from './schemas/scan-result.schema';

@Injectable()
export class AiScannerService {
  private readonly logger = new Logger(AiScannerService.name);
  private readonly gemini: GoogleGenAI;
  private readonly model =
    process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';

  constructor(
    @InjectModel(ScanResult.name)
    private readonly scanResultModel: Model<ScanResult>,
    @InjectModel(AiScannerConfig.name) private readonly configModel:Model<AiScannerConfigDocument>,
    @InjectModel(AiScannerError.name) private readonly errorModel:Model<AiScannerErrorDocument>,
    @InjectModel(Product.name) private readonly productModel:Model<ProductDocument>,
  ) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY is not configured',
      );
    }

    this.gemini = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: Number(process.env.GEMINI_TIMEOUT_MS ?? 60000),
      },
    });
  }

  async scan(image: Express.Multer.File,userId?:string): Promise<ProductScanResponse> {
    this.validateImage(image);
    const config=await this.getConfig();

    let outputText: string;

    try {
      const response = await this.gemini.models.generateContent({
        model: config.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Phân tích ảnh nội thất này và nhận diện những sản phẩm nội thất, trang trí chính đang nhìn thấy. ' +
                  'Với mỗi sản phẩm, trả về tên tiếng Việt ngắn gọn, danh mục, chất liệu có khả năng nhất, màu sắc, ' +
                  'phong cách, kích thước ước tính và độ tin cậy confidence từ 0 đến 1. ' +
                  'Không tự tạo thương hiệu, model hoặc giá. Dùng "Chưa xác định" khi không thể suy luận đáng tin cậy. ' +
                  'Chỉ trả về đối tượng JSON theo schema, không dùng Markdown hoặc lời giải thích.',
              },
              {
                inlineData: {
                  data: image.buffer.toString('base64'),
                  mimeType: image.mimetype,
                },
              },
            ],
          },
        ],
        config: {
          maxOutputTokens: 4000,
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['roomType', 'dominantColors', 'products'],
            properties: {
              roomType: { type: 'string' },
              dominantColors: {
                type: 'array',
                items: { type: 'string' },
                maxItems: 8,
              },
              products: {
                type: 'array',
                maxItems: 12,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'name',
                    'category',
                    'material',
                    'color',
                    'style',
                    'dimensions',
                    'confidence',
                  ],
                  properties: {
                    name: { type: 'string' },
                    category: { type: 'string' },
                    material: { type: 'string' },
                    color: { type: 'string' },
                    style: { type: 'string' },
                    dimensions: { type: 'string' },
                    confidence: {
                      type: 'number',
                      minimum: 0,
                      maximum: 1,
                    },
                  },
                },
              },
            },
          },
        },
      });

      outputText = response.text ?? '';
    } catch (error) {
      await this.recordError(error,image.originalname,userId,config.model);
      this.handleGeminiError(error);
    }

    let parsed:VisionScanResult;
    try{parsed=this.parseResponse(outputText);}catch(error){await this.recordError(error,image.originalname,userId,config.model);throw error;}

    try {
      const saved = await this.scanResultModel.create({
        dominantColors: parsed.dominantColors.slice(0, 8),
        fileSize: image.size,
        mimeType: image.mimetype,
        model: config.model,
        originalFileName: image.originalname,
        products: parsed.products.slice(0, 20).map((product)=>({...product,status:product.confidence<config.confidenceThreshold?DetectionStatus.NeedReview:DetectionStatus.Confirmed})),
        roomType: parsed.roomType,
        userId:userId&&isValidObjectId(userId)?new Types.ObjectId(userId):undefined,
        confidenceThreshold:config.confidenceThreshold,
        needsReview:parsed.products.some((product)=>product.confidence<config.confidenceThreshold),
      });

      return this.toResponse(saved);
    } catch (error) {
      this.logger.error(
        `MongoDB failed to save AI scan result: ${this.errorMessage(error)}`,
      );
      throw new InternalServerErrorException(
        'AI analyzed the image, but the scan result could not be saved',
      );
    }
  }

  async findById(id: string): Promise<ProductScanResponse> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid scan result id');
    }

    const result = await this.scanResultModel.findById(id).exec();

    if (!result) {
      throw new NotFoundException('Scan result not found');
    }

    return this.toResponse(result);
  }

  async adminHistory(query?:string,needsReview?:boolean){const filter:Record<string,unknown>={};if(query)filter.$or=[{originalFileName:{$regex:query,$options:'i'}},{roomType:{$regex:query,$options:'i'}}];if(needsReview!==undefined)filter.needsReview=needsReview;return this.scanResultModel.find(filter).sort({createdAt:-1}).populate('userId','name email').populate('products.linkedProductId','name price image').exec();}
  async adminStats(){const[total,review,errors]=await Promise.all([this.scanResultModel.countDocuments(),this.scanResultModel.countDocuments({needsReview:true}),this.errorModel.countDocuments()]);return{totalScans:total,needsReview:review,apiErrors:errors};}
  async adminErrors(){return this.errorModel.find().sort({createdAt:-1}).limit(200).populate('userId','name email').exec();}
  async updateDetection(scanId:string,detectionId:string,dto:UpdateDetectionDto){if(!isValidObjectId(scanId)||!isValidObjectId(detectionId))throw new BadRequestException('Invalid scan or detection id');if(dto.linkedProductId&&!await this.productModel.exists({_id:new Types.ObjectId(dto.linkedProductId)}))throw new NotFoundException('Product not found');const set:Record<string,unknown>={'products.$.status':DetectionStatus.Corrected};for(const key of ['name','category','material','color','style','dimensions'] as const)if(dto[key]!==undefined)set[`products.$.${key}`]=dto[key];if(dto.linkedProductId)set['products.$.linkedProductId']=new Types.ObjectId(dto.linkedProductId);const result=await this.scanResultModel.findOneAndUpdate({_id:new Types.ObjectId(scanId),'products._id':new Types.ObjectId(detectionId)},{$set:set},{new:true,runValidators:true}).exec();if(!result)throw new NotFoundException('Scan or detection not found');result.needsReview=result.products.some((product)=>product.status===DetectionStatus.NeedReview);await result.save();return result;}
  async getConfig(){return this.configModel.findOneAndUpdate({key:'default'},{$setOnInsert:{model:this.model,confidenceThreshold:0.6,isActive:true}},{new:true,upsert:true,setDefaultsOnInsert:true}).exec();}
  async updateConfig(dto:UpdateScannerConfigDto){return this.configModel.findOneAndUpdate({key:'default'},{$set:dto,$setOnInsert:{key:'default',model:this.model}},{new:true,upsert:true,runValidators:true,setDefaultsOnInsert:true}).exec();}

  private validateImage(image: Express.Multer.File): void {
    const supportedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

    if (!image?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    if (!supportedTypes.has(image.mimetype)) {
      throw new BadRequestException(
        'Only JPG, PNG, and WEBP images are supported',
      );
    }

    if (image.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Image must not exceed 10 MB');
    }
  }

  private handleGeminiError(error: unknown): never {
    const message = this.errorMessage(error);
    const upstreamStatus = this.errorStatus(error);
    const isTimeout =
      /timeout|timed out|deadline exceeded/i.test(message) ||
      upstreamStatus === HttpStatus.REQUEST_TIMEOUT;
    const status = isTimeout
      ? HttpStatus.GATEWAY_TIMEOUT
      : upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 500
        ? upstreamStatus
        : HttpStatus.BAD_GATEWAY;

    this.logger.error(
      `Gemini API error status=${upstreamStatus ?? 'unknown'} model=${this.model} message=${message}`,
    );

    throw new HttpException(
      {
        error: isTimeout ? 'Gemini Timeout' : 'Gemini API Error',
        message: isTimeout
          ? 'Gemini xử lý ảnh quá thời gian. Hãy thử ảnh nhỏ hơn hoặc tăng GEMINI_TIMEOUT_MS.'
          : message,
        model: this.model,
        statusCode: status,
      },
      status,
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private errorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const value = error as {
      code?: number;
      status?: number;
      response?: { status?: number };
    };

    return value.status ?? value.code ?? value.response?.status;
  }

  private parseResponse(outputText: string): VisionScanResult {
    if (!outputText?.trim()) {
      throw new BadRequestException('Gemini returned an empty scan result');
    }

    try {
      const parsed = JSON.parse(
        this.extractJsonObject(outputText),
      ) as VisionScanResult;

      return {
        dominantColors: this.cleanStringList(parsed.dominantColors),
        products: (parsed.products ?? []).map((product) => ({
          category: this.cleanValue(product.category),
          color: this.cleanValue(product.color),
          confidence: Math.min(1,Math.max(0,(Number(product.confidence)||0)>1?(Number(product.confidence)||0)/100:Number(product.confidence)||0)),
          dimensions: this.cleanValue(product.dimensions),
          material: this.cleanValue(product.material),
          name: this.cleanValue(product.name),
          style: this.cleanValue(product.style),
          status: DetectionStatus.Confirmed,
        })),
        roomType: this.cleanValue(parsed.roomType),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Gemini returned invalid JSON: ${this.previewText(outputText)}`,
      );
      throw new BadRequestException('Gemini returned invalid JSON');
    }
  }

  private extractJsonObject(value: string): string {
    const cleaned = value
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new BadRequestException(
        'Gemini response does not contain a complete JSON object',
      );
    }

    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  private previewText(value: string): string {
    return value.replace(/\s+/g, ' ').trim().slice(0, 500);
  }

  private cleanStringList(values: string[]): string[] {
    return [
      ...new Set(
        (values ?? [])
          .map((value) => this.cleanValue(value))
          .filter((value) => value !== 'Chưa xác định'),
      ),
    ];
  }

  private cleanValue(value: string): string {
    return typeof value === 'string' && value.trim()
      ? value.trim().slice(0, 160)
      : 'Chưa xác định';
  }

  private toResponse(result: ScanResultDocument): ProductScanResponse {
    return {
      createdAt: result.createdAt,
      dominantColors: result.dominantColors,
      id: result._id.toString(),
      products: result.products.map((product) => ({
        category: product.category,
        color: product.color,
        confidence: product.confidence,
        dimensions: product.dimensions,
        material: product.material,
        name: product.name,
        style: product.style,
        status:product.status,
        linkedProductId:product.linkedProductId,
      })),
      roomType: result.roomType,
      model:result.model,
      confidenceThreshold:result.confidenceThreshold,
      needsReview:result.needsReview,
    };
  }

  private async recordError(error:unknown,fileName:string,userId?:string,model=this.model){try{await this.errorModel.create({userId:userId&&isValidObjectId(userId)?new Types.ObjectId(userId):undefined,model,message:this.errorMessage(error).slice(0,1000),statusCode:this.errorStatus(error),fileName});}catch(saveError){this.logger.error(`Could not save scanner error: ${this.errorMessage(saveError)}`);}}
}

type VisionScanResult = {
  roomType: string;
  dominantColors: string[];
  products: DetectedProduct[];
};

export type ProductScanResponse = {
  id: string;
  roomType: string;
  dominantColors: string[];
  products: DetectedProduct[];
  createdAt?: Date;
  model:string;
  confidenceThreshold:number;
  needsReview:boolean;
};
