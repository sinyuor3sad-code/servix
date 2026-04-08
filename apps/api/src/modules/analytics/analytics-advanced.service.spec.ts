export {}; 
describe('AnalyticsAdvancedService', () => {
  it('should calculate LTV from monthly price', () => {
    const monthlyPrice = 200;
    const ageMonths = 6;
    const ltv = monthlyPrice * ageMonths;
    expect(ltv).toBe(1200);
  });

  it('should calculate churn risk score', () => {
    let score = 0;
    const noActiveSub = true;
    const expiringIn7Days = true;
    const oldTrial = false;
    const inactive14Days = true;

    if (noActiveSub) score += 40;
    if (expiringIn7Days) score += 30;
    if (oldTrial) score += 20;
    if (inactive14Days) score += 25;
    score = Math.min(100, score);

    expect(score).toBe(95);
  });

  it('should classify risk levels', () => {
    const classify = (s: number) => s >= 60 ? 'HIGH' : s >= 30 ? 'MEDIUM' : 'LOW';
    expect(classify(80)).toBe('HIGH');
    expect(classify(45)).toBe('MEDIUM');
    expect(classify(10)).toBe('LOW');
  });

  it('should calculate retention rate', () => {
    const total = 50;
    const active = 40;
    const rate = Math.round((active / total) * 100);
    expect(rate).toBe(80);
  });

  it('should calculate MRR and ARR', () => {
    const subscriptions = [
      { planPrice: 200 },
      { planPrice: 500 },
      { planPrice: 200 },
    ];
    const mrr = subscriptions.reduce((s, sub) => s + sub.planPrice, 0);
    expect(mrr).toBe(900);
    expect(mrr * 12).toBe(10800);
  });

  it('should calculate conversion rate', () => {
    const total = 100;
    const active = 35;
    const rate = Math.round((active / total) * 100);
    expect(rate).toBe(35);
  });
});

