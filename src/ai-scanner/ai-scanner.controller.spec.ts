import { Test, TestingModule } from '@nestjs/testing';
import { AiScannerController } from './ai-scanner.controller';
import { AiScannerService } from './ai-scanner.service';

describe('AiScannerController', () => {
  let controller: AiScannerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiScannerController],
      providers: [
        {
          provide: AiScannerService,
          useValue: {
            findById: jest.fn(),
            scan: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AiScannerController>(AiScannerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
