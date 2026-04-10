import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { paginate, effectiveLimit } from '../../../shared/helpers/paginate.helper';

interface FeedbackQuery {
  page?: number;
  limit?: number;
  minRating?: number;
  maxRating?: number;
  followUpStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class FeedbackService {
  /* ================================================================
     FIND ALL — paginated list with filters
     ================================================================ */
  async findAll(db: TenantPrismaClient, query: FeedbackQuery) {
    const page = query.page || 1;
    const limit = effectiveLimit(query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Rating filter
    if (query.minRating || query.maxRating) {
      where.rating = {};
      if (query.minRating) (where.rating as Record<string, unknown>).gte = query.minRating;
      if (query.maxRating) (where.rating as Record<string, unknown>).lte = query.maxRating;
    }

    // Follow-up status filter
    if (query.followUpStatus) {
      where.followUpStatus = query.followUpStatus;
    }

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(query.dateFrom);
      if (query.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(query.dateTo + 'T23:59:59.999Z');
    }

    const [items, total] = await Promise.all([
      db.invoiceFeedback.findMany({
        where,
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              selfOrderId: true,
              publicToken: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.invoiceFeedback.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  /* ================================================================
     GET SUMMARY — aggregate stats for dashboard cards
     ================================================================ */
  async getSummary(db: TenantPrismaClient) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // All feedbacks for aggregate stats
    const allFeedbacks = await db.invoiceFeedback.findMany({
      select: {
        rating: true,
        googlePromptShown: true,
        googleClicked: true,
        createdAt: true,
      },
    });

    // Compute stats
    const totalCount = allFeedbacks.length;
    const avgRating = totalCount > 0
      ? allFeedbacks.reduce((s, f) => s + f.rating, 0) / totalCount
      : 0;

    // Star distribution
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allFeedbacks.forEach((f) => {
      distribution[f.rating] = (distribution[f.rating] || 0) + 1;
    });

    // Monthly counts
    const thisMonthCount = allFeedbacks.filter(
      (f) => f.createdAt >= startOfMonth,
    ).length;

    const lastMonthCount = allFeedbacks.filter(
      (f) => f.createdAt >= startOfLastMonth && f.createdAt <= endOfLastMonth,
    ).length;

    // Google stats
    const googlePromptTotal = allFeedbacks.filter((f) => f.googlePromptShown).length;
    const googleClickTotal = allFeedbacks.filter((f) => f.googleClicked).length;
    const googleClickRate = googlePromptTotal > 0
      ? Math.round((googleClickTotal / googlePromptTotal) * 100)
      : 0;

    // Satisfaction rate (4+ stars)
    const satisfiedCount = allFeedbacks.filter((f) => f.rating >= 4).length;
    const satisfactionRate = totalCount > 0
      ? Math.round((satisfiedCount / totalCount) * 100)
      : 0;

    return {
      totalCount,
      avgRating: Math.round(avgRating * 10) / 10,
      thisMonthCount,
      lastMonthCount,
      distribution,
      satisfactionRate,
      googlePromptTotal,
      googleClickTotal,
      googleClickRate,
    };
  }

  /* ================================================================
     UPDATE FOLLOW-UP STATUS
     ================================================================ */
  async updateFollowUp(
    db: TenantPrismaClient,
    feedbackId: string,
    status: string,
  ) {
    const feedback = await db.invoiceFeedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundException('التقييم غير موجود');
    }

    const validStatuses = ['new', 'reviewed', 'contacted'];
    if (!validStatuses.includes(status)) {
      throw new NotFoundException('حالة غير صالحة');
    }

    const updated = await db.invoiceFeedback.update({
      where: { id: feedbackId },
      data: { followUpStatus: status },
    });

    return updated;
  }
}
