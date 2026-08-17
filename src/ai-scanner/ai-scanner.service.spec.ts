import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AiScannerService } from './ai-scanner.service';
import { AiScannerConfig, AiScannerError, ScanResult } from './schemas/scan-result.schema';
import { Product } from '../products/product.schema';

describe('AiScannerService', () => {
  let service: AiScannerService;

  beforeEach(async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiScannerService,
        {
          provide: getModelToken(ScanResult.name),
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
          },
        },
        { provide: getModelToken(AiScannerConfig.name), useValue: { findOneAndUpdate: jest.fn() } },
        { provide: getModelToken(AiScannerError.name), useValue: { create: jest.fn(), countDocuments: jest.fn(), find: jest.fn() } },
        { provide: getModelToken(Product.name), useValue: { exists: jest.fn() } },
      ],
    }).compile();

    service = module.get<AiScannerService>(AiScannerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
