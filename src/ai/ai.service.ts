import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import OpenAI from 'openai';

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
  private readonly openai: OpenAI;
  private readonly model = process.env.OPENAI_VISION_MODEL ?? 'gpt-5.5';

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new InternalServerErrorException('OPENAI_API_KEY is not configured');
    }

    this.openai = new OpenAI({
      apiKey,
      timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 30000),
      maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 2),
    });
  }

  async analyzeRoom(imageUrl: string): Promise<RoomAnalysisResponse> {
    this.validateImageUrl(imageUrl);

    const result = await this.createVisionJsonResponse<RoomAnalysisResponse>({
      imageUrl,
      prompt:
        'Analyze this interior room image. Return the most likely room type, the main visible furniture/decor objects, and the dominant colors. Use short Title Case labels. Do not include explanations.',
      schemaName: 'room_analysis',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['roomType', 'detectedObjects', 'colors'],
        properties: {
          roomType: {
            type: 'string',
            description: 'Most likely room type, for example Bedroom.',
          },
          detectedObjects: {
            type: 'array',
            items: { type: 'string' },
            description: 'Main visible objects in the room.',
          },
          colors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Dominant visible colors in the room.',
          },
        },
      },
    });

    return {
      roomType: this.toTitleCase(result.roomType),
      detectedObjects: this.normalizeStringList(result.detectedObjects),
      colors: this.normalizeStringList(result.colors),
    };
  }

  async detectObjects(imageUrl: string): Promise<string[]> {
    this.validateImageUrl(imageUrl);

    const result = await this.createVisionJsonResponse<ObjectDetectionResponse>({
      imageUrl,
      prompt:
        'Detect the main visible furniture and decor objects in this room image. Return only concise Title Case object names.',
      schemaName: 'room_object_detection',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['detectedObjects'],
        properties: {
          detectedObjects: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    });

    return this.normalizeStringList(result.detectedObjects);
  }

  async detectColors(imageUrl: string): Promise<string[]> {
    this.validateImageUrl(imageUrl);

    const result = await this.createVisionJsonResponse<ColorDetectionResponse>({
      imageUrl,
      prompt:
        'Detect the dominant visible colors in this room image. Return only common color names in Title Case.',
      schemaName: 'room_color_detection',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['colors'],
        properties: {
          colors: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    });

    return this.normalizeStringList(result.colors);
  }

  async classifyRoomType(imageUrl: string): Promise<string> {
    this.validateImageUrl(imageUrl);

    const result =
      await this.createVisionJsonResponse<RoomTypeClassificationResponse>({
        imageUrl,
        prompt:
          'Classify this interior room image into one concise room type. Return a Title Case room type such as Bedroom, Living Room, Kitchen, Bathroom, Office, or Dining Room.',
        schemaName: 'room_type_classification',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['roomType'],
          properties: {
            roomType: {
              type: 'string',
            },
          },
        },
      });

    return this.toTitleCase(result.roomType);
  }

  async generateDecorationSuggestion(
    params: GenerateDecorSuggestionParams,
  ): Promise<string> {
    try {
      const response = await this.openai.responses.create({
        model: this.model,
        input:
          `Create a concise decoration suggestion for a ${params.roomType}. ` +
          `The user wants ${params.style} style and has a budget of ${params.budget}. ` +
          `Detected objects: ${params.detectedObjects.join(', ') || 'None'}. ` +
          `Detected colors: ${params.colors.join(', ') || 'None'}. ` +
          `Recommended products: ${params.productNames.join(', ') || 'None'}. ` +
          `Estimated cost: ${params.estimatedCost}. ` +
          'Return one practical paragraph. Do not use markdown.',
        temperature: 0.6,
        max_output_tokens: 350,
        store: false,
      });

      const suggestion = this.extractOutputText(response).trim();

      if (!suggestion) {
        throw new BadRequestException('OpenAI returned an empty suggestion');
      }

      return suggestion;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to generate decoration suggestion',
      );
    }
  }

  private async createVisionJsonResponse<T>(params: {
    imageUrl: string;
    prompt: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<T> {
    try {
      const response = await this.openai.responses.create({
        model: this.model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: params.prompt,
              },
              {
                type: 'input_image',
                image_url: params.imageUrl,
                detail: 'auto',
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: params.schemaName,
            strict: true,
            schema: params.schema,
          },
        },
        temperature: 0.2,
        max_output_tokens: 500,
        store: false,
      });

      return this.parseJsonResponse<T>(response);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to analyze room image with OpenAI Vision',
      );
    }
  }

  private parseJsonResponse<T>(response: unknown): T {
    const outputText = this.extractOutputText(response);

    if (!outputText) {
      throw new BadRequestException('OpenAI returned an empty analysis result');
    }

    try {
      return JSON.parse(this.stripJsonFence(outputText)) as T;
    } catch {
      throw new BadRequestException('OpenAI returned invalid JSON');
    }
  }

  private extractOutputText(response: unknown): string {
    const directOutputText = (response as { output_text?: string }).output_text;

    if (directOutputText) {
      return directOutputText;
    }

    const output = (response as { output?: unknown[] }).output;
    if (!Array.isArray(output)) {
      return '';
    }

    for (const item of output) {
      const content = (item as { content?: unknown[] }).content;
      if (!Array.isArray(content)) {
        continue;
      }

      const textPart = content.find(
        (part) =>
          (part as { type?: string }).type === 'output_text' &&
          typeof (part as { text?: unknown }).text === 'string',
      );

      if (textPart) {
        return (textPart as { text: string }).text;
      }
    }

    return '';
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
    return [...new Set((values ?? []).map((value) => this.toTitleCase(value)))]
      .filter(Boolean)
      .slice(0, 20);
  }

  private toTitleCase(value: string): string {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private stripJsonFence(value: string): string {
    return value
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');
  }
}
