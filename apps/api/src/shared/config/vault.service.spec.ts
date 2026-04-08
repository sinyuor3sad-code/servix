import { VaultService } from './vault.service';
import { ConfigService } from '@nestjs/config';

describe('VaultService', () => {
  let service: VaultService;
  let configGet: jest.Mock;

  beforeEach(() => {
    configGet = jest.fn((key: string, defaultValue?: string) => {
      const store: Record<string, string> = {
        VAULT_ADDR: '',
        VAULT_TOKEN: '',
        DATABASE_URL: 'postgresql://local',
        JWT_SECRET: 'local-jwt-secret',
      };
      return store[key] ?? defaultValue ?? '';
    });

    const mockConfigService = { get: configGet } as unknown as ConfigService;
    service = new VaultService(mockConfigService);
  });

  describe('without Vault', () => {
    it('should initialize with vault disabled', async () => {
      await service.onModuleInit();

      expect(service.isEnabled).toBe(false);
      expect(service.secretCount).toBe(0);
    });

    it('should fallback to ConfigService values', async () => {
      await service.onModuleInit();

      const result = service.get('DATABASE_URL');
      expect(result).toBe('postgresql://local');
    });

    it('should return default value for missing keys', async () => {
      await service.onModuleInit();

      const result = service.get('MISSING_KEY', 'fallback');
      expect(result).toBe('fallback');
    });
  });

  describe('with Vault (mocked fetch)', () => {
    beforeEach(() => {
      configGet.mockImplementation((key: string, defaultValue?: string) => {
        const store: Record<string, string> = {
          VAULT_ADDR: 'http://vault:8200',
          VAULT_TOKEN: 'test-token',
          VAULT_SECRET_PATH: 'secret/data/servix/test',
          DATABASE_URL: 'postgresql://local',
        };
        return store[key] ?? defaultValue ?? '';
      });
    });

    it('should load secrets from Vault', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            data: {
              DATABASE_URL: 'postgresql://vault-db',
              JWT_SECRET: 'vault-jwt-secret',
            },
          },
        }),
      }) as jest.Mock;

      await service.onModuleInit();

      expect(service.isEnabled).toBe(true);
      expect(service.secretCount).toBe(2);
      expect(service.get('DATABASE_URL')).toBe('postgresql://vault-db');
      expect(service.get('JWT_SECRET')).toBe('vault-jwt-secret');
    });

    it('should fallback when Vault is unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused')) as jest.Mock;

      await service.onModuleInit();

      expect(service.isEnabled).toBe(false);
      expect(service.get('DATABASE_URL')).toBe('postgresql://local');
    });

    it('should fallback when Vault returns error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }) as jest.Mock;

      await service.onModuleInit();

      expect(service.isEnabled).toBe(false);
    });
  });
});
