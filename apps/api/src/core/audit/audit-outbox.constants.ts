// V-35b — Audit outbox drain tuning + metric names.
// See audit-outbox.processor.ts for the drain/sweeper/poison machinery and
// docs/principal-audit/synthesis-2026-05-14.md (V-35 / A2-18) for rationale.

/** How often the in-process drain tick runs. */
export const AUDIT_OUTBOX_DRAIN_INTERVAL_MS = 5_000;

/** Named handle for the @Interval registration (avoids duplicate-name errors). */
export const AUDIT_OUTBOX_DRAIN_INTERVAL_NAME = 'audit-outbox-drain';

/** Rows claimed per drain tick (FOR UPDATE SKIP LOCKED batch). */
export const AUDIT_OUTBOX_BATCH_SIZE = 100;

/**
 * Max delivery attempts before a row is parked as terminal `failed`
 * (poison-message dead-letter). A poison row (e.g. a dangling user_id that the
 * FK-checked platform_audit_logs insert rejects) must NOT retry forever, or it
 * would inflate the lag gauge and fire a false alert indefinitely.
 */
export const AUDIT_OUTBOX_MAX_ATTEMPTS = 5;

/**
 * A row stuck in `processing` longer than this is assumed orphaned by a crashed
 * worker and is swept back to `pending`. Combined with ON CONFLICT (id) DO
 * NOTHING on the terminal insert, re-drain is exactly-once in effect.
 */
export const AUDIT_OUTBOX_STUCK_PROCESSING_MS = 5 * 60_000;

/** Truncate persisted error text so a huge driver message can't bloat the row. */
export const AUDIT_OUTBOX_LAST_ERROR_MAXLEN = 1_000;

// ── Metric names (E2 supplies the metric; E1 wires the Prometheus alert — V-35d) ──
export const METRIC_AUDIT_OUTBOX_LAG_SECONDS = 'servix_audit_outbox_lag_seconds';
export const METRIC_AUDIT_OUTBOX_FAILED_TOTAL = 'servix_audit_outbox_failed_total';
export const METRIC_AUDIT_OUTBOX_DELIVERED_TOTAL = 'servix_audit_outbox_delivered_total';
