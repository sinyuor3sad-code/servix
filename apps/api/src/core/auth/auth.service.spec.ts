import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import { CacheService } from '../../shared/cache/cache.service';
import { MailService } from '../../shared/mail/mail.service';
import { SmsService } from '../../shared/sms/sms.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
}));

import { compare } from 'bcryptjs';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    create: jest.fn(),
  },
  tenantUser: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  passwordReset: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      'jwt.accessSecret': 'test-access-secret',
      'jwt.refreshSecret': 'test-refresh-secret',
      'jwt.accessExpiration': '15m',
      'jwt.refreshExpiration': '7d',
      APP_URL: 'http://localhost:3000',
    };
    return config[key] ?? defaultValue ?? '';
  }),
};

const mockCacheService = {
  checkLoginIpBlock: jest.fn().mockResolvedValue(0),
  incrementLoginFailIp: jest.fn().mockResolvedValue({ count: 1, blockSeconds: 0 }),
  resetLoginFailIp: jest.fn().mockResolvedValue(undefined),
  isAccountLocked: jest.fn().mockResolvedValue(false),
  incrementLoginFailAccount: jest.fn().mockResolvedValue({ count: 1, locked: false }),
  resetLoginFailAccount: jest.fn().mockResolvedValue(undefined),
  blacklistRefreshToken: jest.fn().mockResolvedValue(undefined),
  isRefreshTokenBlacklisted: jest.fn().mockResolvedValue(false),
  setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
  getPasswordChangedAt: jest.fn().mockResolvedValue(null),
  checkForgotPasswordRateLimit: jest.fn().mockResolvedValue(true),
  incrementForgotPasswordAttempt: jest.fn().mockResolvedValue(1),
};

const mockMailService = { send: jest.fn().mockResolvedValue(undefined) };
const mockSmsService = { send: jest.fn().mockResolvedValue(undefined) };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: MailService, useValue: mockMailService },
        { provide: SmsService, useValue: mockSmsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();

    mockJwtService.signAsync.mockResolvedValue('mock-token');
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          'jwt.accessSecret': 'test-access-secret',
          'jwt.refreshSecret': 'test-refresh-secret',
          'jwt.accessExpiration': '15m',
          'jwt.refreshExpiration': '7d',
          APP_URL: 'http://localhost:3000',
        };
        return config[key] ?? defaultValue ?? '';
      },
    );
    mockCacheService.checkLoginIpBlock.mockResolvedValue(0);
    mockCacheService.isAccountLocked.mockResolvedValue(false);
    mockCacheService.incrementLoginFailIp.mockResolvedValue({ count: 1, blockSeconds: 0 });
    mockCacheService.incrementLoginFailAccount.mockResolvedValue({ count: 1, locked: false });
    mockCacheService.resetLoginFailIp.mockResolvedValue(undefined);
    mockCacheService.resetLoginFailAccount.mockResolvedValue(undefined);
    mockCacheService.isRefreshTokenBlacklisted.mockResolvedValue(false);
    mockCacheService.getPasswordChangedAt.mockResolvedValue(null);
    mockCacheService.checkForgotPasswordRateLimit.mockResolvedValue(true);
  });

  describe('register', () => {
    const registerDto = {
      fullName: 'أحمد محمد',
      email: 'ahmed@example.com',
      phone: '+966501234567',
      password: 'StrongPass123!',
      salonNameAr: 'صالون الأناقة',
      salonNameEn: 'Elegance Salon',
    };

    it('يجب إنشاء مستخدم ومنشأة بنجاح', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'role-owner-id',
        name: 'owner',
      });

      const createdUser = {
        id: 'user-id',
        fullName: registerDto.fullName,
        email: registerDto.email,
        phone: registerDto.phone,
        avatarUrl: null,
        passwordHash: 'hashed_password',
      };
      const createdTenant = {
        id: 'tenant-id',
        nameAr: registerDto.salonNameAr,
        nameEn: registerDto.salonNameEn,
        slug: 'elegance-salon-a1b2c3d4',
      };

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue(createdUser) },
          tenant: { create: jest.fn().mockResolvedValue(createdTenant) },
          tenantUser: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await service.register(registerDto);

      expect(result.user.email).toBe(registerDto.email);
      expect(result.tenant.nameAr).toBe(registerDto.salonNameAr);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('mock-token');
    });

    it('يجب رفض التسجيل إذا كان البريد مسجلاً مسبقاً', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'existing-user',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('يجب رفض التسجيل إذا كان رقم الجوال مسجلاً مسبقاً', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'existing-user', phone: registerDto.phone }); // phone check

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('يجب رفض التسجيل إذا لم يتم العثور على دور المالك', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      emailOrPhone: 'ahmed@example.com',
      password: 'StrongPass123!',
    };

    const mockUser = {
      id: 'user-id',
      fullName: 'أحمد محمد',
      email: 'ahmed@example.com',
      phone: '+966501234567',
      avatarUrl: null,
      passwordHash: 'hashed_password',
    };

    it('يجب تسجيل الدخول وإرجاع التوكنات لبيانات صحيحة', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.tenantUser.findMany.mockResolvedValue([
        {
          id: 'tu-id',
          tenantId: 'tenant-id',
          roleId: 'role-id',
          isOwner: true,
          tenant: {
            id: 'tenant-id',
            nameAr: 'صالون',
            nameEn: 'Salon',
            slug: 'salon',
          },
          role: { id: 'role-id', name: 'owner', nameAr: 'مالك' },
        },
      ]);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login(loginDto, '127.0.0.1');

      expect(result.user.email).toBe(loginDto.emailOrPhone);
      expect(result.tokens.accessToken).toBe('mock-token');
      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0].isOwner).toBe(true);
    });

    it('يجب رفض الدخول لكلمة مرور خاطئة', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('يجب رفض الدخول لمستخدم غير موجود', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('يجب رفض الدخول إذا لم يكن لدى المستخدم صالون مرتبط', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.tenantUser.findMany.mockResolvedValue([]);

      await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    describe('login - rate limiting (SEC-1)', () => {
      it('يجب رفض الدخول عندما يكون IP محظوراً', async () => {
        mockCacheService.checkLoginIpBlock.mockResolvedValue(900);

        await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('يجب رفض الدخول عندما يكون الحساب مقفلاً', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockUser);
        mockCacheService.isAccountLocked.mockResolvedValue(true);

        await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('يجب زيادة عداد محاولات الدخول الفاشلة عند كلمة مرور خاطئة', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockUser);
        (compare as jest.Mock).mockResolvedValue(false);

        await expect(service.login(loginDto, '127.0.0.1')).rejects.toThrow(
          UnauthorizedException,
        );

        expect(mockCacheService.incrementLoginFailIp).toHaveBeenCalledWith('127.0.0.1');
        expect(mockCacheService.incrementLoginFailAccount).toHaveBeenCalledWith('user-id');
      });

      it('يجب إعادة تعيين عداد المحاولات الفاشلة عند نجاح الدخول', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(mockUser);
        (compare as jest.Mock).mockResolvedValue(true);
        mockPrisma.tenantUser.findMany.mockResolvedValue([
          {
            id: 'tu-id',
            tenantId: 'tenant-id',
            roleId: 'role-id',
            isOwner: true,
            tenant: {
              id: 'tenant-id',
              nameAr: 'صالون',
              nameEn: 'Salon',
              slug: 'salon',
            },
            role: { id: 'role-id', name: 'owner', nameAr: 'مالك' },
          },
        ]);
        mockPrisma.user.update.mockResolvedValue(mockUser);

        await service.login(loginDto, '127.0.0.1');

        expect(mockCacheService.resetLoginFailIp).toHaveBeenCalledWith('127.0.0.1');
        expect(mockCacheService.resetLoginFailAccount).toHaveBeenCalledWith('user-id');
      });
    });
  });

  describe('refreshTokens', () => {
    it('يجب إرجاع توكنات جديدة لرمز تحديث صالح', async () => {
      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
        tenantId: 'tenant-id',
        roleId: 'role-id',
      };
      mockJwtService.verify.mockReturnValue(payload);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(mockJwtService.verify).toHaveBeenCalledWith(
        'valid-refresh-token',
        { secret: 'test-refresh-secret' },
      );
    });

    it('يجب رفض رمز التحديث المنتهي أو غير الصالح', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(
        service.refreshTokens('invalid-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    describe('refreshTokens - token blacklist (SEC-2)', () => {
      it('يجب رفض الرمز الموجود في القائمة السوداء', async () => {
        mockCacheService.isRefreshTokenBlacklisted.mockResolvedValue(true);

        await expect(
          service.refreshTokens('blacklisted-refresh-token'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('يجب رفض التحديث عند تغيير كلمة المرور بعد إصدار التوكن', async () => {
        mockJwtService.verify.mockReturnValue({
          sub: 'user-id',
          email: 'test@example.com',
          tenantId: 'tenant-id',
          roleId: 'role-id',
          iat: 1000000,
        });
        mockCacheService.getPasswordChangedAt.mockResolvedValue(1000000001);

        await expect(
          service.refreshTokens('valid-refresh-token'),
        ).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  describe('changePassword', () => {
    const userId = 'user-id';
    const changePasswordDto = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    };

    const mockUser = {
      id: userId,
      fullName: 'أحمد',
      email: 'ahmed@test.com',
      phone: '+966501234567',
      avatarUrl: null,
      passwordHash: 'hashed_old_password',
    };

    it('يجب تغيير كلمة المرور عند إدخال كلمة المرور الحالية الصحيحة', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.changePassword(userId, changePasswordDto);

      expect(result.message).toBe('تم تغيير كلمة المرور بنجاح');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: 'hashed_password' },
      });
    });

    it('يجب رفض التغيير عند إدخال كلمة مرور حالية خاطئة', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب استدعاء setPasswordChangedAt بعد تغيير كلمة المرور', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.changePassword(userId, changePasswordDto);

      expect(mockCacheService.setPasswordChangedAt).toHaveBeenCalledWith(userId);
    });
  });

  describe('forgotPassword', () => {
    it('يجب إرسال رابط إعادة تعيين كلمة المرور', async () => {
      const mockUser = {
        id: 'user-id',
        fullName: 'أحمد',
        email: 'ahmed@example.com',
        phone: '+966501234567',
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.passwordReset.create.mockResolvedValue({});

      const result = await service.forgotPassword('ahmed@example.com');

      expect(result.message).toBe(
        'إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور',
      );
      expect(mockPrisma.passwordReset.create).toHaveBeenCalled();
      expect(mockMailService.send).toHaveBeenCalled();
      expect(mockSmsService.send).toHaveBeenCalled();
    });

    it('يجب رفض الطلب عند تجاوز حد المحاولات', async () => {
      mockCacheService.checkForgotPasswordRateLimit.mockResolvedValue(false);

      await expect(
        service.forgotPassword('ahmed@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
