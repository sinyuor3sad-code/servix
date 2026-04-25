/**
 * Single source of truth for the Evolution API webhook path.
 *
 * Both the controller decorator and the URL builder import from here
 * to guarantee they never drift. The path is intentionally version-neutral
 * (see @Controller config) so Evolution's registered URL survives any
 * future API versioning change.
 */
export const EVOLUTION_WEBHOOK_BASE = 'webhooks/evolution';
export const EVOLUTION_WEBHOOK_FULL_PATH = `/api/${EVOLUTION_WEBHOOK_BASE}`;
