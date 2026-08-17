import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiScannerController } from './ai-scanner.controller';
import { AiScannerService } from './ai-scanner.service';
import {
  ScanResult,
  ScanResultSchema,
  AiScannerConfig,
  AiScannerConfigSchema,
  AiScannerError,
  AiScannerErrorSchema,
} from './schemas/scan-result.schema';
import { Product, ProductSchema } from '../products/product.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: ScanResult.name, schema: ScanResultSchema },
      { name: AiScannerConfig.name, schema: AiScannerConfigSchema },
      { name: AiScannerError.name, schema: AiScannerErrorSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [AiScannerController],
  providers: [AiScannerService],
  exports: [AiScannerService],
})
export class AiScannerModule {}
