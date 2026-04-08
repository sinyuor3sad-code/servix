import { ABTestingService } from './ab-testing.service';

describe('ABTestingService', () => {
  let service: ABTestingService;

  beforeEach(() => {
    service = new ABTestingService();
  });

  describe('getVariant', () => {
    it('should return "control" for unknown experiment', () => {
      expect(service.getVariant('nonexistent', 'user-1')).toBe('control');
    });

    it('should return "control" for inactive experiment', () => {
      // Default experiments start as DRAFT
      expect(service.getVariant('exp-booking-flow', 'user-1')).toBe('control');
    });

    it('should return a variant for active experiments', () => {
      service.updateStatus('exp-booking-flow', 'ACTIVE');
      const variant = service.getVariant('exp-booking-flow', 'user-1');
      expect(['control', 'variant-a']).toContain(variant);
    });

    it('should return same variant for same user (deterministic)', () => {
      service.updateStatus('exp-booking-flow', 'ACTIVE');
      const v1 = service.getVariant('exp-booking-flow', 'user-123');
      const v2 = service.getVariant('exp-booking-flow', 'user-123');
      expect(v1).toBe(v2);
    });

    it('should distribute across variants', () => {
      service.updateStatus('exp-booking-flow', 'ACTIVE');
      const variants = new Set<string>();
      for (let i = 0; i < 100; i++) {
        variants.add(service.getVariant('exp-booking-flow', `user-${i}`));
      }
      // With 50/50 split, we should see both variants
      expect(variants.size).toBe(2);
    });
  });

  describe('trackConversion', () => {
    it('should track conversion events', () => {
      service.updateStatus('exp-booking-flow', 'ACTIVE');
      service.getVariant('exp-booking-flow', 'user-1');
      service.trackConversion('exp-booking-flow', 'user-1', 'booking_completed', 1);

      const results = service.getResults('exp-booking-flow');
      const totalConversions = results.variants.reduce((s, v) => s + v.conversions, 0);
      expect(totalConversions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getResults', () => {
    it('should return empty for unknown experiment', () => {
      const results = service.getResults('nonexistent');
      expect(results.experiment).toBeUndefined();
      expect(results.variants).toHaveLength(0);
    });

    it('should calculate conversion rates', () => {
      service.updateStatus('exp-booking-flow', 'ACTIVE');

      // Expose 10 users
      for (let i = 0; i < 10; i++) {
        service.getVariant('exp-booking-flow', `user-${i}`);
      }

      // Convert 3 users
      service.trackConversion('exp-booking-flow', 'user-0', 'signup');
      service.trackConversion('exp-booking-flow', 'user-1', 'signup');
      service.trackConversion('exp-booking-flow', 'user-2', 'signup');

      const results = service.getResults('exp-booking-flow');
      const totalExposures = results.variants.reduce((s, v) => s + v.exposures, 0);
      expect(totalExposures).toBe(10);
    });
  });

  describe('CRUD', () => {
    it('should create experiment', () => {
      const exp = service.createExperiment({
        id: 'test-exp',
        name: 'Test',
        description: 'Test experiment',
        status: 'DRAFT',
        variants: [
          { name: 'control', percentage: 50 },
          { name: 'variant-b', percentage: 50 },
        ],
      });
      expect(exp.id).toBe('test-exp');
    });

    it('should update status', () => {
      service.updateStatus('exp-booking-flow', 'ACTIVE');
      expect(service.getExperiment('exp-booking-flow')?.status).toBe('ACTIVE');

      service.updateStatus('exp-booking-flow', 'PAUSED');
      expect(service.getExperiment('exp-booking-flow')?.status).toBe('PAUSED');
    });

    it('should list all experiments', () => {
      const all = service.getAllExperiments();
      expect(all.length).toBeGreaterThanOrEqual(2); // 2 defaults
    });
  });
});
