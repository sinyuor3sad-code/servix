/**
 * Subscription lifecycle per CLAUDE.md:
 * Day 0: expired — banner, notifications
 * Day 1-7: READ-ONLY (grace period)
 * Day 8-14: LOCKED (renewal only)
 * Day 15: final warning
 * Day 60: DATA DELETION
 */
export type SubscriptionPhase =
  | 'active'
  | 'trial'
  | 'expired_grace'   // Day 1-7: read-only
  | 'expired_locked'  // Day 8+: locked
  | 'deleted';

const GRACE_DAYS = 7;
const LOCKED_DAYS = 14; // Day 8-14 from expiry
const DELETION_DAYS = 60;

export interface SubscriptionStatus {
  phase: SubscriptionPhase;
  currentPeriodEnd: Date;
  daysSinceExpiry: number;
  daysUntilDeletion: number | null;
  canRead: boolean;
  canWrite: boolean;
  canAccessDashboard: boolean;
}

export function computeSubscriptionStatus(
  currentPeriodEnd: Date,
  status: string,
): SubscriptionStatus {
  const now = new Date();
  const isExpired = currentPeriodEnd < now;
  const daysSinceExpiry = isExpired
    ? Math.floor((now.getTime() - currentPeriodEnd.getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  const deletionDate = new Date(currentPeriodEnd);
  deletionDate.setDate(deletionDate.getDate() + DELETION_DAYS);
  const daysUntilDeletion = isExpired
    ? Math.max(0, Math.floor((deletionDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  if (!isExpired && (status === 'active' || status === 'trial')) {
    return {
      phase: status === 'trial' ? 'trial' : 'active',
      currentPeriodEnd,
      daysSinceExpiry: 0,
      daysUntilDeletion: null,
      canRead: true,
      canWrite: true,
      canAccessDashboard: true,
    };
  }

  if (daysSinceExpiry <= GRACE_DAYS) {
    return {
      phase: 'expired_grace',
      currentPeriodEnd,
      daysSinceExpiry,
      daysUntilDeletion,
      canRead: true,
      canWrite: false,
      canAccessDashboard: true,
    };
  }

  if (daysSinceExpiry <= DELETION_DAYS) {
    return {
      phase: 'expired_locked',
      currentPeriodEnd,
      daysSinceExpiry,
      daysUntilDeletion,
      canRead: false,
      canWrite: false,
      canAccessDashboard: false,
    };
  }

  return {
    phase: 'deleted',
    currentPeriodEnd,
    daysSinceExpiry,
    daysUntilDeletion: 0,
    canRead: false,
    canWrite: false,
    canAccessDashboard: false,
  };
}
