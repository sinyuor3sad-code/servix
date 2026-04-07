// IMPORTANT: Sentry must be imported before everything else
import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './shared/interceptors/response-transform.interceptor';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve uploaded files (logos etc.)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.use(helmet({
    contentSecurityPolicy: false, // Managed by CloudFlare
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);

  // API root redirect
  app.getHttpAdapter().get('/', (_req: any, res: any) => {
    const info: Record<string, string> = {
      name: 'SERVIX API',
      version: '1.0.0',
      health: '/api/v1/health',
    };
    // Only expose docs link outside production (SEC-3)
    if (configService.get<string>('NODE_ENV', 'development') !== 'production') {
      info.docs = '/docs';
    }
    res.json(info);
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const rawOrigins = configService.get<string>('CORS_ORIGINS', '');
  const corsOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // SEC-6: In production, only allow explicitly configured origins. Never use '*'.
  app.enableCors({
    origin: nodeEnv === 'production'
      ? corsOrigins.length > 0
        ? corsOrigins
        : false // Block all cross-origin if no origins configured in production
      : corsOrigins.length > 0
        ? corsOrigins
        : 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language'],
    maxAge: 86400, // Cache preflight for 24h
  });

  // Swagger docs — hidden in production for security (SEC-3)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SERVIX API')
      .setDescription('منصة SaaS لإدارة الأعمال الخدمية — Hybrid SaaS platform for service businesses')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'المصادقة والتسجيل')
      .addTag('Tenants', 'إدارة الصالونات')
      .addTag('Subscriptions', 'الاشتراكات والباقات')
      .addTag('Features', 'إدارة الميزات')
      .addTag('Roles', 'الأدوار والصلاحيات')
      .addTag('Users', 'إدارة المستخدمين')
      .addTag('Uploads', 'رفع الملفات')
      .addTag('Audit Logs', 'سجل العمليات')
      .addTag('Notifications', 'الإشعارات')
      .addTag('Salon Info', 'بيانات الصالون العامة')
      .addTag('Services', 'إدارة الخدمات')
      .addTag('Employees', 'إدارة الموظفات')
      .addTag('Clients', 'إدارة العملاء')
      .addTag('Appointments', 'إدارة المواعيد والحجوزات')
      .addTag('Invoices', 'الفواتير والمدفوعات')
      .addTag('Coupons', 'إدارة الكوبونات')
      .addTag('Loyalty', 'نظام الولاء')
      .addTag('Expenses', 'إدارة المصروفات')
      .addTag('Attendance', 'حضور وانصراف الموظفات')
      .addTag('Settings', 'إعدادات الصالون')
      .addTag('Reports', 'التقارير')
      .addTag('Booking (Public)', 'واجهة الحجز العامة')
      .addTag('Admin', 'إدارة المنصة')
      .addTag('Health', 'فحص صحة النظام')
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument);
  }

  // Enable NestJS shutdown lifecycle hooks (OnModuleDestroy, etc.)
  app.enableShutdownHooks();

  const server = await app.listen(port);
  logger.log(`SERVIX API listening on port ${port} (${nodeEnv})`);

  // ── Graceful Shutdown ──
  const SHUTDOWN_TIMEOUT_MS = 30_000;

  const gracefulShutdown = async (signal: string) => {
    logger.log(`${signal} received — بدء الإيقاف الرشيق...`);

    // 1. Stop accepting new connections
    server.close(() => {
      logger.log('HTTP server closed — لا طلبات جديدة');
    });

    // 2. Force exit after timeout
    const forceTimeout = setTimeout(() => {
      logger.warn('Graceful shutdown timeout — إغلاق إجباري');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      // 3. Wait for NestJS to close (prisma disconnect, bullmq, etc.)
      await app.close();
      clearTimeout(forceTimeout);
      logger.log('تم الإيقاف الرشيق بنجاح ✓');
      process.exit(0);
    } catch (error) {
      logger.error('خطأ أثناء الإيقاف الرشيق', error);
      clearTimeout(forceTimeout);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap();

