import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const apiPrefix = process.env.API_PREFIX ?? 'api';
  const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      const isConfigured = configuredOrigins.includes(normalizedOrigin);
      const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):3000$/.test(normalizedOrigin);

      callback(isConfigured || isLocalFrontend ? null : new Error(`CORS blocked origin: ${origin}`), isConfigured || isLocalFrontend);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
    .addTag('Product Spaces', 'Interactive rooms with product hotspots and visibility management')
    .addTag('Showrooms 3D', '3D environments, product models, transforms, and publishing')
    .addTag('Reviews', 'Product ratings, images, reports, and moderation')
    .addTag('Support Tickets', 'Customer support, order complaints, disputes, and assignment')
    .addTag('Website Content', 'Banners, articles, policies, FAQ, footer, and contact CMS')
    .addTag('AI', 'Gemini Vision room analysis APIs')
    .addTag('Products', 'Product catalog and product recommendation source')
    .addTag('Categories', 'Hierarchical product category management')
    .addTag('Brands', 'Brand visibility, supplier links, and product lookup')
    .addTag('Orders', 'Order workflow, shipping, refunds, and complaints')
    .addTag('Payments', 'Transactions, refunds, platform fees, and supplier payouts')
    .addTag('Promotions', 'Discount codes, targeting, limits, and validation')
    .addTag('Decor Plans', 'AI-generated decor plan workflow')
    .addTag('Favorites', 'Saved decor plans for authenticated users')
    .addTag('Admin', 'Admin-only dashboard analytics')
    .addTag('Supplier Center', 'Supplier profile, dashboard, products, orders, payouts, and reviews')
    .addTag('Search', 'Global search, browser search history, and trending queries')
    .addTag('Community', 'Real user posts, before/after makeovers, comments, likes, saves, and follows')
    .addTag('Health', 'Backend availability check')
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

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`DECOHO Backend is running at http://localhost:${port}/${apiPrefix}`);
  console.log(`Health check: http://localhost:${port}/${apiPrefix}/health`);
}

void bootstrap();
