import { NotFoundException } from '@nestjs/common';
import { DataRightsService } from './data-rights.service';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import { EncryptionService } from '../../shared/encryption/encryption.service';

describe('DataRightsService', () => {
  let service: DataRightsService;
  let mockPlatformDb: any;
  let mockEncryption: any;
  let mockTenantDb: any;

  beforeEach(() => {
    mockPlatformDb = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          fullName: 'أحمد',
          email: 'ahmed@test.com',
          phone: '966501234567',
          avatarUrl: null,
          isEmailVerified: true,
          isPhoneVerified: true,
          authProvider: 'local',
          lastLoginAt: new Date(),
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockEncryption = {
      encrypt: jest.fn((val: string) => val),
      decrypt: jest.fn((val: string) => val),
      isEnabled: false,
    };

    mockTenantDb = {
      client: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'client-1',
          fullName: 'أحمد',
          phone: '0501234567',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'apt-1', date: new Date(), status: 'completed' },
        ]),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'inv-1', total: 150, status: 'paid' },
        ]),
      },
      activityLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      setting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };

    service = new DataRightsService(
      mockPlatformDb as unknown as PlatformPrismaClient,
      mockEncryption as unknown as EncryptionService,
    );
  });

  describe('exportAll', () => {
    it('should export user profile from platform DB', async () => {
      const result = await service.exportAll('user-1', null);

      expect(result.profile).toBeDefined();
      expect(result.profile.fullName).toBe('أحمد');
      expect(result.exportedAt).toBeDefined();
      expect(mockPlatformDb.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
    });

    it('should export appointments and invoices from tenant DB', async () => {
      const result = await service.exportAll('user-1', mockTenantDb);

      expect(result.appointments).toHaveLength(1);
      expect(result.invoices).toHaveLength(1);
      expect(mockTenantDb.appointment.findMany).toHaveBeenCalled();
      expect(mockTenantDb.invoice.findMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPlatformDb.user.findUnique.mockResolvedValue(null);

      await expect(service.exportAll('nonexistent', null)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should exclude sensitive settings from export', async () => {
      mockTenantDb.setting.findMany.mockResolvedValue([
        { key: 'salon_name', value: 'صالون الجمال' },
        { key: 'whatsapp_access_token', value: 'secret-token' },
      ]);

      const result = await service.exportAll('user-1', mockTenantDb);

      expect(result.settings['salon_name']).toBe('صالون الجمال');
      expect(result.settings['whatsapp_access_token']).toBeUndefined();
    });
  });

  describe('correct', () => {
    it('should update allowed fields on platform User', async () => {
      const result = await service.correct(
        'user-1',
        { fullName: 'أحمد محمد' },
        mockTenantDb,
      );

      expect(result.updated).toBe(true);
      expect(result.fields).toContain('fullName');
      expect(mockPlatformDb.user.update).toHaveBeenCalled();
    });

    it('should reject invalid fields', async () => {
      await expect(
        service.correct('user-1', { password: 'hack' }, null),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update tenant Client record when tenant DB is available', async () => {
      await service.correct('user-1', { fullName: 'أحمد محمد' }, mockTenantDb);

      expect(mockTenantDb.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-1' },
          data: expect.objectContaining({ fullName: 'أحمد محمد' }),
        }),
      );
    });
  });

  describe('requestDeletion', () => {
    it('should schedule deletion 30 days from now', async () => {
      const result = await service.requestDeletion('user-1', mockTenantDb);

      expect(result.status).toBe('pending_deletion');
      const scheduled = new Date(result.scheduledDeletionDate);
      const diffDays = Math.round(
        (scheduled.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(30);
    });

    it('should persist deletion request in tenant settings', async () => {
      await service.requestDeletion('user-1', mockTenantDb);

      expect(mockTenantDb.setting.upsert).toHaveBeenCalledTimes(3);
    });

    it('should list retained data types', async () => {
      const result = await service.requestDeletion('user-1', mockTenantDb);

      expect(result.retainedData).toHaveLength(2);
      expect(result.retainedData[0]).toContain('الفواتير');
    });
  });

  describe('cancelDeletion', () => {
    it('should cancel a pending deletion', async () => {
      mockTenantDb.setting.findUnique
        .mockResolvedValueOnce({ key: 'pdpl_deletion_requested_at', value: new Date().toISOString() })
        .mockResolvedValueOnce({ key: 'pdpl_deletion_user_id', value: 'user-1' });

      const result = await service.cancelDeletion('user-1', mockTenantDb);

      expect(result.cancelled).toBe(true);
      expect(mockTenantDb.setting.deleteMany).toHaveBeenCalled();
    });

    it('should throw if no pending deletion exists', async () => {
      mockTenantDb.setting.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelDeletion('user-1', mockTenantDb),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if no tenant context', async () => {
      await expect(
        service.cancelDeletion('user-1', null),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
