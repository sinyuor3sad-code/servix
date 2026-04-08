import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  variants: ExperimentVariant[];
  startDate?: Date;
  endDate?: Date;
}

export interface ExperimentVariant {
  name: string;
  percentage: number; // 0-100
  description?: string;
}

interface ExposureRecord {
  experimentId: string;
  userId: string;
  variant: string;
  timestamp: Date;
}

interface ConversionRecord {
  experimentId: string;
  userId: string;
  metric: string;
  value: number;
  timestamp: Date;
}

/**
 * A/B Testing Service
 * Deterministic variant assignment using MD5-based bucketing.
 * Tracks exposures and conversions for statistical analysis.
 */
@Injectable()
export class ABTestingService {
  private readonly logger = new Logger(ABTestingService.name);
  private readonly experiments = new Map<string, Experiment>();
  private readonly exposures: ExposureRecord[] = [];
  private readonly conversions: ConversionRecord[] = [];

  constructor() {
    this.initSampleExperiments();
  }

  /**
   * Get the variant for a user in an experiment
   * Uses deterministic hashing — same user always gets same variant
   */
  getVariant(experimentId: string, userId: string): string {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'ACTIVE') return 'control';

    // Check existing exposure
    const existing = this.exposures.find(
      (e) => e.experimentId === experimentId && e.userId === userId,
    );
    if (existing) return existing.variant;

    // Deterministic bucket assignment
    const hash = createHash('md5')
      .update(`${experimentId}:${userId}`)
      .digest('hex');
    const bucket = parseInt(hash.slice(0, 8), 16) % 100;

    let cumulative = 0;
    let selectedVariant = 'control';
    for (const variant of experiment.variants) {
      cumulative += variant.percentage;
      if (bucket < cumulative) {
        selectedVariant = variant.name;
        break;
      }
    }

    // Record exposure
    this.exposures.push({
      experimentId,
      userId,
      variant: selectedVariant,
      timestamp: new Date(),
    });

    return selectedVariant;
  }

  /**
   * Track a conversion event for an experiment
   */
  trackConversion(
    experimentId: string,
    userId: string,
    metric: string,
    value: number = 1,
  ): void {
    this.conversions.push({
      experimentId,
      userId,
      metric,
      value,
      timestamp: new Date(),
    });
  }

  /**
   * Get experiment results with conversion rates per variant
   */
  getResults(experimentId: string): {
    experiment: Experiment | undefined;
    variants: Array<{
      name: string;
      exposures: number;
      conversions: number;
      conversionRate: number;
      totalValue: number;
    }>;
  } {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return { experiment: undefined, variants: [] };

    const expExposures = this.exposures.filter(
      (e) => e.experimentId === experimentId,
    );
    const expConversions = this.conversions.filter(
      (c) => c.experimentId === experimentId,
    );

    const variants = experiment.variants.map((v) => {
      const variantExposures = expExposures.filter(
        (e) => e.variant === v.name,
      );
      const variantUsers = new Set(variantExposures.map((e) => e.userId));
      const variantConversions = expConversions.filter((c) =>
        variantUsers.has(c.userId),
      );
      const uniqueConverted = new Set(variantConversions.map((c) => c.userId));

      return {
        name: v.name,
        exposures: variantUsers.size,
        conversions: uniqueConverted.size,
        conversionRate:
          variantUsers.size > 0
            ? Math.round((uniqueConverted.size / variantUsers.size) * 10000) /
              100
            : 0,
        totalValue: variantConversions.reduce((sum, c) => sum + c.value, 0),
      };
    });

    return { experiment, variants };
  }

  /**
   * CRUD Operations
   */
  createExperiment(experiment: Experiment): Experiment {
    this.experiments.set(experiment.id, experiment);
    this.logger.log(`Experiment "${experiment.name}" created`);
    return experiment;
  }

  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  getAllExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  updateStatus(
    id: string,
    status: Experiment['status'],
  ): Experiment | undefined {
    const exp = this.experiments.get(id);
    if (!exp) return undefined;
    exp.status = status;
    this.experiments.set(id, exp);
    this.logger.log(`Experiment "${exp.name}" status → ${status}`);
    return exp;
  }

  private initSampleExperiments(): void {
    this.createExperiment({
      id: 'exp-booking-flow',
      name: 'تدفق الحجز الجديد',
      description: 'مقارنة تدفق الحجز الحالي مع التدفق المُعاد تصميمه',
      status: 'DRAFT',
      variants: [
        { name: 'control', percentage: 50, description: 'التدفق الحالي' },
        { name: 'variant-a', percentage: 50, description: 'تدفق جديد مع timeline' },
      ],
    });

    this.createExperiment({
      id: 'exp-pricing-page',
      name: 'صفحة الأسعار',
      description: 'اختبار عرض الخطط السنوية أولاً vs الشهرية',
      status: 'DRAFT',
      variants: [
        { name: 'control', percentage: 50, description: 'الشهري أولاً' },
        { name: 'annual-first', percentage: 50, description: 'السنوي أولاً' },
      ],
    });
  }
}
