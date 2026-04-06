const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
  skipAuth?: boolean;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

interface ApiErrorBody {
  success: false;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Token helpers ──

function getStoredAuth(): { accessToken?: string; refreshToken?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('servix-admin-auth');
    if (!stored) return {};
    const parsed = JSON.parse(stored) as { state?: { accessToken?: string; refreshToken?: string } };
    return {
      accessToken: parsed.state?.accessToken ?? undefined,
      refreshToken: parsed.state?.refreshToken ?? undefined,
    };
  } catch {
    return {};
  }
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE}/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const json = (await response.json()) as ApiSuccessResponse<{ accessToken: string; refreshToken: string }>;
    const { accessToken: newAccess, refreshToken: newRefresh } = json.data;

    // Update Zustand store in localStorage
    const stored = localStorage.getItem('servix-admin-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.state.accessToken = newAccess;
      parsed.state.refreshToken = newRefresh;
      localStorage.setItem('servix-admin-auth', JSON.stringify(parsed));
    }

    // Update cookie for middleware
    const cookieValue = JSON.stringify({ state: { accessToken: newAccess, user: JSON.parse(stored || '{}')?.state?.user } });
    document.cookie = `servix-admin-auth=${encodeURIComponent(cookieValue)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

    return newAccess;
  } catch {
    return null;
  }
}

async function getValidToken(): Promise<string | null> {
  const { accessToken } = getStoredAuth();
  return accessToken ?? null;
}

function forceLogout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('servix-admin-auth');
  document.cookie = 'servix-admin-auth=; path=/; max-age=0';
  window.location.href = '/login';
}

// ── Core fetch ──

async function apiRaw<T>(endpoint: string, options: ApiOptions = {}): Promise<ApiSuccessResponse<T>> {
  const { method = 'GET', body, headers = {}, token, skipAuth } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const authToken = token ?? (skipAuth ? undefined : await getValidToken());
  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }

    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    } else {
      forceLogout();
      throw new ApiError('انتهت صلاحية الجلسة — سجّل دخولك مرة أخرى', 401);
    }
  }

  if (!response.ok) {
    let errorBody: ApiErrorBody | undefined;
    try {
      errorBody = (await response.json()) as ApiErrorBody;
    } catch {
      // response wasn't JSON
    }
    throw new ApiError(
      errorBody?.message || `خطأ في الطلب (${response.status})`,
      response.status,
      errorBody?.errors,
    );
  }

  return (await response.json()) as ApiSuccessResponse<T>;
}

async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const json = await apiRaw<T>(endpoint, options);
  return json.data;
}

async function apiPaginated<T>(endpoint: string, options: ApiOptions = {}): Promise<PaginatedResult<T>> {
  const json = await apiRaw<{ data: T[] }>(endpoint, options);
  return {
    data: json.data?.data ?? [],
    meta: json.meta ?? { page: 1, perPage: 20, total: 0, totalPages: 0 },
  };
}

export const api = {
  get: <T>(endpoint: string, token?: string): Promise<T> =>
    apiClient<T>(endpoint, { token }),

  getPaginated: <T>(endpoint: string, token?: string): Promise<PaginatedResult<T>> =>
    apiPaginated<T>(endpoint, { token }),

  post: <T>(endpoint: string, body: unknown, token?: string): Promise<T> =>
    apiClient<T>(endpoint, { method: 'POST', body, token }),

  postPublic: <T>(endpoint: string, body: unknown): Promise<T> =>
    apiClient<T>(endpoint, { method: 'POST', body, skipAuth: true }),

  put: <T>(endpoint: string, body: unknown, token?: string): Promise<T> =>
    apiClient<T>(endpoint, { method: 'PUT', body, token }),

  patch: <T>(endpoint: string, body: unknown, token?: string): Promise<T> =>
    apiClient<T>(endpoint, { method: 'PATCH', body, token }),

  delete: <T>(endpoint: string, token?: string): Promise<T> =>
    apiClient<T>(endpoint, { method: 'DELETE', token }),
};
