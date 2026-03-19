import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './shared/interceptors/response-transform.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);

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
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',').map((o) => o.trim());
  app.enableCors({
    origin: nodeEnv === 'production' && corsOrigins.length > 0
      ? corsOrigins
      : corsOrigins.length > 0
        ? corsOrigins
        : 'http://localhost:3000',
    credentials: true,
  });

  if (configService.get('NODE_ENV') !== 'production') {
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

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
}

bootstrap();
