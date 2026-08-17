import { GoogleGenAI, Part } from '@google/genai';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

export type RoomAnalysisResponse = {
  roomType: string;
  detectedObjects: string[];
  colors: string[];
};

export type GenerateDecorSuggestionParams = {
  roomType: string;
  detectedObjects: string[];
  colors: string[];
  style: string;
  budget: number;
  estimatedCost: number;
  productNames: string[];
};

type ObjectDetectionResponse = {
  detectedObjects: string[];
};

type ColorDetectionResponse = {
  colors: string[];
};

type RoomTypeClassificationResponse = {
  roomType: string;
};

@Injectable()
export class AiService {
  private readonly gemini: GoogleGenAI;
  private readonly logger = new Logger(AiService.name);
  private readonly model =
    process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';
  private readonly timeoutMs = Number(
    process.env.GEMINI_TIMEOUT_MS ?? 60000,
  );

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY is not configured',
      );
    }

    this.gemini = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: this.timeoutMs },
    });
  }

  async analyzeRoom(imageUrl: string): Promise<RoomAnalysisResponse> {
    const result = await this.createVisionJsonResponse<RoomAnalysisResponse>({
      imageUrl,
      prompt:
        'Phân tích ảnh nội thất này. Trả về loại phòng có khả năng nhất, các đồ nội thất/trang trí chính và màu sắc chủ đạo. Dùng nhãn tiếng Việt ngắn gọn, không giải thích.',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['roomType', 'detectedObjects', 'colors'],
        properties: {
          roomType: { type: 'string' },
          detectedObjects: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 20,
          },
          colors: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 12,
          },
        },
      },
    });

    return {
      roomType: result.roomType.trim(),
      detectedObjects: this.normalizeStringList(result.detectedObjects),
      colors: this.normalizeStringList(result.colors),
    };
  }

  async detectObjects(imageUrl: string): Promise<string[]> {
    const result = await this.createVisionJsonResponse<ObjectDetectionResponse>({
      imageUrl,
      prompt:
        'Nhận diện các đồ nội thất và trang trí chính trong ảnh. Chỉ trả về tên tiếng Việt ngắn gọn.',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['detectedObjects'],
        properties: {
          detectedObjects: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 20,
          },
        },
      },
    });

    return this.normalizeStringList(result.detectedObjects);
  }

  async detectColors(imageUrl: string): Promise<string[]> {
    const result = await this.createVisionJsonResponse<ColorDetectionResponse>({
      imageUrl,
      prompt:
        'Nhận diện các màu sắc chủ đạo trong ảnh nội thất. Chỉ trả về tên màu tiếng Việt thông dụng.',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['colors'],
        properties: {
          colors: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 12,
          },
        },
      },
    });

    return this.normalizeStringList(result.colors);
  }

  async classifyRoomType(imageUrl: string): Promise<string> {
    const result =
      await this.createVisionJsonResponse<RoomTypeClassificationResponse>({
        imageUrl,
        prompt:
          'Phân loại ảnh này thành một loại phòng ngắn gọn bằng tiếng Việt, ví dụ: Phòng ngủ, Phòng khách, Nhà bếp, Phòng tắm, Phòng làm việc hoặc Phòng ăn.',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['roomType'],
          properties: {
            roomType: { type: 'string' },
          },
        },
      });

    return result.roomType.trim();
  }

  async generateDecorationSuggestion(
    params: GenerateDecorSuggestionParams,
  ): Promise<string> {
    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents:
          `Viết một đoạn đề xuất trang trí ngắn gọn và thực tế cho ${params.roomType}. ` +
          `Phong cách mong muốn: ${params.style}. Ngân sách: ${params.budget}. ` +
          `Đồ vật đã nhận diện: ${params.detectedObjects.join(', ') || 'Không có'}. ` +
          `Màu sắc: ${params.colors.join(', ') || 'Không có'}. ` +
          `Sản phẩm đề xuất: ${params.productNames.join(', ') || 'Không có'}. ` +
          `Chi phí ước tính: ${params.estimatedCost}. Không dùng markdown.`,
        config: {
          maxOutputTokens: 350,
        },
      });

      const suggestion = response.text?.trim() ?? '';

      if (!suggestion) {
        throw new BadRequestException(
          'Gemini returned an empty suggestion',
        );
      }

      return suggestion;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Gemini decoration suggestion failed: ${this.errorMessage(error)}`,
      );
      throw new InternalServerErrorException(
        'Failed to generate decoration suggestion with Gemini',
      );
    }
  }

  private async createVisionJsonResponse<T>(params: {
    imageUrl: string;
    prompt: string;
    schema: Record<string, unknown>;
  }): Promise<T> {
    const imagePart = await this.createImagePart(params.imageUrl);

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: params.prompt }, imagePart],
          },
        ],
        config: {
          maxOutputTokens: 800,
          responseJsonSchema: params.schema,
          responseMimeType: 'application/json',
        },
      });

      return this.parseJsonResponse<T>(response.text ?? '');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Gemini room analysis failed: ${this.errorMessage(error)}`,
      );
      throw new InternalServerErrorException(
        'Failed to analyze room image with Gemini Vision',
      );
    }
  }

  private async createImagePart(imageUrl: string): Promise<Part> {
    this.validateImageUrl(imageUrl);

    if (imageUrl.startsWith('data:')) {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(
        imageUrl,
      );

      if (!match) {
        throw new BadRequestException('Invalid image data URL');
      }

      return {
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      };
    }

    try {
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Unable to download room image (${response.status})`,
        );
      }

      const mimeType = response.headers
        .get('content-type')
        ?.split(';')[0]
        .trim();

      if (
        mimeType !== 'image/jpeg' &&
        mimeType !== 'image/png' &&
        mimeType !== 'image/webp'
      ) {
        throw new BadRequestException(
          'Room image must be JPG, PNG, or WEBP',
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length > 10 * 1024 * 1024) {
        throw new BadRequestException('Room image must not exceed 10 MB');
      }

      return {
        inlineData: {
          mimeType,
          data: buffer.toString('base64'),
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Unable to download room image: ${this.errorMessage(error)}`,
      );
    }
  }

  private parseJsonResponse<T>(outputText: string): T {
    if (!outputText.trim()) {
      throw new BadRequestException(
        'Gemini returned an empty analysis result',
      );
    }

    try {
      return JSON.parse(this.stripJsonFence(outputText)) as T;
    } catch {
      throw new BadRequestException('Gemini returned invalid JSON');
    }
  }

  private validateImageUrl(imageUrl: string): void {
    if (!imageUrl?.trim()) {
      throw new BadRequestException('Image URL is required');
    }

    try {
      const parsedUrl = new URL(imageUrl);
      const isValidProtocol =
        parsedUrl.protocol === 'http:' ||
        parsedUrl.protocol === 'https:' ||
        parsedUrl.protocol === 'data:';

      if (!isValidProtocol) {
        throw new Error('Invalid protocol');
      }
    } catch {
      throw new BadRequestException('Image URL must be a valid URL');
    }
  }

  private normalizeStringList(values: string[]): string[] {
    return [
      ...new Set(
        (values ?? [])
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ].slice(0, 20);
  }

  private stripJsonFence(value: string): string {
    return value
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
