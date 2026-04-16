/**
 * Centralized selectors so tests stay resilient to DOM churn.
 *
 * Prefer role-based queries where possible; attribute selectors are used
 * only where the dashboard UI lacks stable ARIA roles.
 */

export const LOGIN_SELECTORS = {
  emailInput: 'input[autocomplete="email"]',
  passwordInput: 'input[type="password"]',
  submitButton: 'button[type="submit"]',
} as const;

export const COMMON_SELECTORS = {
  toastError: '[data-sonner-toast][data-type="error"], [role="alert"]',
  toastSuccess: '[data-sonner-toast][data-type="success"]',
  dialog: '[role="dialog"], dialog[open]',
  /** Matches any content surface on a dashboard page. */
  pageContent: 'main, [role="main"], #__next',
} as const;
