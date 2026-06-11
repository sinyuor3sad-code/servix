import { api } from '@/lib/api';

export interface WeeklyStats {
  totalConversations: number;
  totalBookings: number;
  conversionRate: number;
  avgResponseTimeMs: number;
  voiceMessages: number;
  escalations: number;
  cachedHits: number;
  topService: { name: string; count: number } | null;
  topTimeWindow: { label: string; count: number } | null;
  topRepeatedQuestion: { intent: string; count: number } | null;
  estimatedCostSar: number;
  windowStart: string;
  windowEnd: string;
}

const DEV_STATS: WeeklyStats = {
  totalConversations: 0,
  totalBookings: 0,
  conversionRate: 0,
  avgResponseTimeMs: 0,
  voiceMessages: 0,
  escalations: 0,
  cachedHits: 0,
  topService: null,
  topTimeWindow: null,
  topRepeatedQuestion: null,
  estimatedCostSar: 0,
  windowStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  windowEnd: new Date().toISOString(),
};

export const aiReceptionService = {
  getStats: (token: string): Promise<WeeklyStats> => {
    if (token?.startsWith('dev-access-token-')) {
      return Promise.resolve(DEV_STATS);
    }
    return api.get<WeeklyStats>('/salon/ai-reception/stats', token);
  },
};
