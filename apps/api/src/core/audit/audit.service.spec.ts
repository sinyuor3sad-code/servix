import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, CreateAuditLogData } from './audit.service';
import { PlatformPrismaClient } from '../../shared/database/platform.client';

describe('AuditService (V-35b — outbox-backed log)', () => {
  let service: AuditService;
  let prismaCreate: jest.Mock;

  const sample: CreateAuditLogData = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    action: 'auth.login',
    entityType: 'User',
    entityId: 'user-1',
    newValues: { ip: '1.2.3.4' },
    ipAddress: '1.2.3.4',
    userAgent: 'jest',
  };

  beforeEach(async () => {
    prismaCreate = jest.fn().mockResolvedValue({ id: 'outbox-1' });
    const mockPrisma = { auditOutbox: { create: prismaCreate } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PlatformPrismaClient, useValue: mockPrisma }],
    }).compile();

    service = module.get(AuditService);
  });

  it('writes a pending outbox row on the platform client when no tx is given', async () => {
    await service.log(sample);

    expect(prismaCreate).toHaveBeenCalledTimes(1);
    const arg = prismaCreate.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'auth.login',
      entityType: 'User',
      entityId: 'user-1',
      ipAddress: '1.2.3.4',
      userAgent: 'jest',
    });
    // status/attempts are schema defaults — must NOT be force-set here.
    expect(arg.data).not.toHaveProperty('status');
    expect(arg.data).not.toHaveProperty('attempts');
  });

  it('writes via the provided tx client (atomic path), not the base client', async () => {
    const txCreate = jest.fn().mockResolvedValue({ id: 'outbox-tx' });
    const tx = { auditOutbox: { create: txCreate } } as never;

    await service.log(sample, tx);

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(prismaCreate).not.toHaveBeenCalled();
  });

  it('is fail-loud: a failed outbox insert propagates (no silent swallow)', async () => {
    prismaCreate.mockRejectedValueOnce(new Error('db down'));
    await expect(service.log(sample)).rejects.toThrow('db down');
  });
});
