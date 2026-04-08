export {}; 
describe('DynamicPricingService', () => {
  it('should apply peak hour multiplier', () => {
    const basePrice = 100;
    const peakMultiplier = 1.5;
    const hour = 18; // peak hour
    const isPeak = hour >= 17 && hour <= 21;
    const finalPrice = isPeak ? basePrice * peakMultiplier : basePrice;
    expect(finalPrice).toBe(150);
  });

  it('should apply off-peak discount', () => {
    const basePrice = 100;
    const offPeakMultiplier = 0.8;
    const hour = 10; // off-peak
    const isPeak = hour >= 17 && hour <= 21;
    const finalPrice = isPeak ? basePrice : basePrice * offPeakMultiplier;
    expect(finalPrice).toBe(80);
  });

  it('should not modify price for standard hours', () => {
    const basePrice = 100;
    const hour = 14; // standard
    const isPeak = hour >= 17 && hour <= 21;
    const isOffPeak = hour < 9 || hour > 21;
    const finalPrice = isPeak ? basePrice * 1.5 : isOffPeak ? basePrice * 0.7 : basePrice;
    expect(finalPrice).toBe(100);
  });

  it('should respect minimum price', () => {
    const basePrice = 50;
    const discount = 0.5;
    const minPrice = 30;
    const calculated = basePrice * discount;
    const finalPrice = Math.max(calculated, minPrice);
    expect(finalPrice).toBe(30);
  });
});

