import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const apiPrefix = process.env.API_PREFIX ?? 'api';

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DECOHO API')
    .setDescription(
      'Backend API documentation for DECOHO: authentication, users, rooms, AI room analysis, products, decor plans, favorites, and admin dashboard.',
    )
    .setVersion('1.0.0')
    .addServer(`/${apiPrefix}`)
    .addTag('Auth', 'JWT authentication, refresh tokens, and profile access')
    .addTag('Users', 'User profile, avatar upload, and account management')
    .addTag('Rooms', 'Room image upload and room ownership APIs')
    .addTag('AI', 'OpenAI Vision room analysis APIs')
    .addTag('Products', 'Product catalog and product recommendation source')
    .addTag('Decor Plans', 'AI-generated decor plan workflow')
    .addTag('Favorites', 'Saved decor plans for authenticated users')
    .addTag('Admin', 'Admin-only dashboard analytics')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste a JWT access token from POST /auth/login.',
    })
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
  });
  SwaggerModule.setup(`${apiPrefix}/docs`, app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customSiteTitle: 'DECOHO API Docs',
  });

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
