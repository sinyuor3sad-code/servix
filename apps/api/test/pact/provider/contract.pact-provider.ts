/**
 * Pact provider verification (lightweight, source-scan based)
 *
 * Goal: catch the common regression where a consumer contract references a
 * route the API no longer exposes (rename refactor, removed endpoint).
 *
 * We avoid booting NestJS/AppModule here because doing so drags in Redis,
 * BullMQ, Prisma and the full DI graph — too slow and flaky for a contract
 * smoke test. Instead we parse controller decorators directly from source.
 *
 * Full behavioural verification (mocked Prisma, real HTTP loopback, state
 * handlers) is tracked in tooling/BACKLOG.md.
 */
import * as fs from 'fs';
import * as path from 'path';

function findControllerFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'generated') continue;
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
        out.push(full);
      }
    }
  }
  return out;
}

type Interaction = {
  description: string;
  request: { method: string; path: string };
  response: { status: number };
};

const PACT_FILE = path.resolve(
  __dirname,
  '../../../../../pacts/ServixDashboard-ServixAPI.json',
);

const SRC_ROOT = path.resolve(__dirname, '../../../src');
const GLOBAL_PREFIX = '/api';

const METHOD_DECORATORS = ['Get', 'Post', 'Put', 'Patch', 'Delete'] as const;

/** Matches `@Controller({ ... })` — we then pull `path` and `version` keys out separately. */
const CONTROLLER_OBJ_RE = /@Controller\(\s*\{([^}]*)\}\s*\)/;
const CONTROLLER_STR_RE = /@Controller\(\s*['"]([^'"]+)['"]\s*\)/;
const CONTROLLER_EMPTY_RE = /@Controller\(\s*\)/;
const OBJ_PATH_RE = /path\s*:\s*['"]([^'"]+)['"]/;
const OBJ_VERSION_RE = /version\s*:\s*['"]([^'"]+)['"]/;

function buildRouteIndex(): Set<string> {
  const routes = new Set<string>();
  const files = findControllerFiles(SRC_ROOT);

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    let basePath = '';
    let version: string | null = null;

    const objMatch = src.match(CONTROLLER_OBJ_RE);
    if (objMatch) {
      const body = objMatch[1];
      const p = body.match(OBJ_PATH_RE);
      const v = body.match(OBJ_VERSION_RE);
      if (p) basePath = p[1];
      if (v) version = v[1];
    } else {
      const strMatch = src.match(CONTROLLER_STR_RE);
      if (strMatch) basePath = strMatch[1];
    }

    if (!basePath && !CONTROLLER_EMPTY_RE.test(src) && !objMatch) continue;

    // Scan method decorators. We deliberately use a single regex per file and
    // walk matches; we don't try to parse TS fully — good enough for a smoke
    // check and keeps the test a few ms per file.
    for (const m of METHOD_DECORATORS) {
      const re = new RegExp(`@${m}\\(\\s*(?:['"]([^'"]*)['"])?\\s*\\)`, 'g');
      let match: RegExpExecArray | null;
      while ((match = re.exec(src)) !== null) {
        const subPath = match[1] ?? '';
        const parts = [GLOBAL_PREFIX];
        if (version) parts.push(`v${version}`);
        if (basePath) parts.push(basePath);
        if (subPath) parts.push(subPath);
        const full = parts
          .join('/')
          .replace(/\/+/g, '/')
          .replace(/\/$/, '');
        routes.add(`${m.toUpperCase()} ${full || '/'}`);
      }
    }
  }

  return routes;
}

/**
 * Checks whether an interaction path (e.g. `/api/v1/appointments/abc-123`)
 * matches a registered route template (e.g. `/api/v1/appointments/:id`).
 */
function pathMatchesTemplate(requestPath: string, template: string): boolean {
  const reqParts = requestPath.split('?')[0].split('/').filter(Boolean);
  const tmplParts = template.split('/').filter(Boolean);
  if (reqParts.length !== tmplParts.length) return false;
  for (let i = 0; i < tmplParts.length; i++) {
    const t = tmplParts[i];
    if (t.startsWith(':')) continue;
    if (t !== reqParts[i]) return false;
  }
  return true;
}

describe('Pact provider contract', () => {
  let registeredRoutes: Set<string>;

  beforeAll(() => {
    registeredRoutes = buildRouteIndex();
  });

  it('pact file is present and well-formed', () => {
    expect(fs.existsSync(PACT_FILE)).toBe(true);
    const json = JSON.parse(fs.readFileSync(PACT_FILE, 'utf8'));
    expect(json.consumer.name).toBe('ServixDashboard');
    expect(json.provider.name).toBe('ServixAPI');
    expect(Array.isArray(json.interactions)).toBe(true);
    expect(json.interactions.length).toBeGreaterThan(0);
  });

  it('API source declares at least one route', () => {
    expect(registeredRoutes.size).toBeGreaterThan(0);
  });

  it('every interaction targets a route declared by a controller', () => {
    const json = JSON.parse(fs.readFileSync(PACT_FILE, 'utf8'));
    const missing: string[] = [];

    for (const it of json.interactions as Interaction[]) {
      const method = it.request.method.toUpperCase();
      const matched = [...registeredRoutes].some((entry) => {
        const [routeMethod, routePath] = entry.split(' ');
        return (
          routeMethod === method &&
          pathMatchesTemplate(it.request.path, routePath)
        );
      });
      if (!matched) missing.push(`${method} ${it.request.path}`);
    }

    if (missing.length) {
      // eslint-disable-next-line no-console
      console.error('Unregistered pact interactions:', missing);
      // eslint-disable-next-line no-console
      console.error(
        'Declared routes sample:',
        [...registeredRoutes].slice(0, 20),
      );
    }
    expect(missing).toEqual([]);
  });
});
