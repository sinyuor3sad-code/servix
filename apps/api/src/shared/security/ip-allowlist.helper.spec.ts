import { isIpAllowed } from './ip-allowlist.helper';

/**
 * V-43 — unit coverage for the hand-rolled IPv4/CIDR allowlist matcher.
 * CIDR boundary math is error-prone, so exercise the edges explicitly.
 */
describe('V-43 — isIpAllowed (IPv4 + CIDR allowlist)', () => {
  describe('feature disabled (empty allowlist)', () => {
    it('empty string → all IPs allowed', () => {
      expect(isIpAllowed('203.0.113.4', '')).toBe(true);
      expect(isIpAllowed('10.0.0.1', '   ')).toBe(true);
    });
    it('undefined-ish allowlist → all allowed', () => {
      expect(isIpAllowed('1.2.3.4', undefined as unknown as string)).toBe(true);
    });
  });

  describe('exact IPv4 match', () => {
    it('matches the exact IP', () => {
      expect(isIpAllowed('203.0.113.4', '203.0.113.4')).toBe(true);
    });
    it('rejects a different IP', () => {
      expect(isIpAllowed('203.0.113.5', '203.0.113.4')).toBe(false);
    });
    it('matches within a CSV list', () => {
      expect(isIpAllowed('5.6.7.8', '1.2.3.4,5.6.7.8,9.10.11.12')).toBe(true);
      expect(isIpAllowed('9.9.9.9', '1.2.3.4,5.6.7.8,9.10.11.12')).toBe(false);
    });
    it('tolerates whitespace around CSV entries', () => {
      expect(isIpAllowed('5.6.7.8', ' 1.2.3.4 , 5.6.7.8 ')).toBe(true);
    });
  });

  describe('CIDR ranges', () => {
    it('/24 — matches inside, rejects outside', () => {
      expect(isIpAllowed('203.0.113.0', '203.0.113.0/24')).toBe(true);
      expect(isIpAllowed('203.0.113.255', '203.0.113.0/24')).toBe(true);
      expect(isIpAllowed('203.0.114.0', '203.0.113.0/24')).toBe(false);
      expect(isIpAllowed('203.0.112.255', '203.0.113.0/24')).toBe(false);
    });
    it('/8 — wide range boundary', () => {
      expect(isIpAllowed('10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(isIpAllowed('10.255.255.255', '10.0.0.0/8')).toBe(true);
      expect(isIpAllowed('11.0.0.0', '10.0.0.0/8')).toBe(false);
    });
    it('/32 — single host', () => {
      expect(isIpAllowed('192.168.1.1', '192.168.1.1/32')).toBe(true);
      expect(isIpAllowed('192.168.1.2', '192.168.1.1/32')).toBe(false);
    });
    it('/0 — matches everything (degenerate but valid)', () => {
      expect(isIpAllowed('8.8.8.8', '0.0.0.0/0')).toBe(true);
    });
    it('network address is normalized — host bits in entry ignored', () => {
      // 203.0.113.50/24 should behave identically to 203.0.113.0/24
      expect(isIpAllowed('203.0.113.7', '203.0.113.50/24')).toBe(true);
      expect(isIpAllowed('203.0.114.7', '203.0.113.50/24')).toBe(false);
    });
  });

  describe('invalid input — fail-closed per entry', () => {
    it('malformed CIDR prefix → entry matches nothing', () => {
      expect(isIpAllowed('10.0.0.1', '10.0.0.0/33')).toBe(false);
      expect(isIpAllowed('10.0.0.1', '10.0.0.0/-1')).toBe(false);
      expect(isIpAllowed('10.0.0.1', '10.0.0.0/abc')).toBe(false);
    });
    it('out-of-range octet → no match', () => {
      expect(isIpAllowed('10.0.0.1', '10.0.0.256')).toBe(false);
      expect(isIpAllowed('999.0.0.1', '999.0.0.1')).toBe(false); // client IP also invalid
    });
    it('non-IPv4 client (IPv6) → no match (graceful skip)', () => {
      expect(isIpAllowed('::1', '10.0.0.0/8')).toBe(false);
      expect(isIpAllowed('fe80::1', '203.0.113.4')).toBe(false);
    });
    it('wrong octet count → no match', () => {
      expect(isIpAllowed('10.0.0', '10.0.0.0/8')).toBe(false);
      expect(isIpAllowed('10.0.0.0.1', '10.0.0.0/8')).toBe(false);
    });
    it('a malformed entry does not poison a valid one in the same CSV', () => {
      // First entry is garbage, second is a real match.
      expect(isIpAllowed('5.6.7.8', 'garbage/99,5.6.7.8')).toBe(true);
    });
    it('allowlist active but IP undefined → deny (fail-closed)', () => {
      expect(isIpAllowed(undefined, '10.0.0.0/8')).toBe(false);
    });
  });
});
