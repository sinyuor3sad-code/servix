const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

// ── Token Refresh Queue ──
// Prevents multiple concurrent refresh calls when several requests get 401 simultaneously.
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
}

/**
 * Try to refresh the access token using the stored refresh token.
 * Returns the new access token or null if refresh fails.
 * 
 * CRITICAL: Updates BOTH localStorage AND zustand in-memory store.
 * Without updating the in-memory store, zustand would overwrite the
 * new token in localStorage with the old one on the next state change.
 * 
 * Uses a queue pattern: only one refresh request runs at a time.
 * Other callers wait for the result via the failedQueue.
 */
async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // If already refreshing, queue this request
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const raw = localStorage.getItem('servix-auth');
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const refreshToken = stored?.state?.refreshToken;
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      processQueue(new Error('Refresh failed'), null);
      return null;
    }

    const json = await res.json();
    const newAccessToken = json?.data?.accessToken ?? json?.accessToken;
    const newRefreshToken = json?.data?.refreshToken ?? json?.refreshToken ?? refreshToken;

    if (!newAccessToken) {
      processQueue(new Error('No access token in response'), null);
      return null;
    }

    // 1. Update localStorage directly (for next page load)
    stored.state.accessToken = newAccessToken;
    stored.state.refreshToken = newRefreshToken;
    localStorage.setItem('servix-auth', JSON.stringify(stored));

    // 2. Notify zustand store via window event (avoids circular import issues)
    window.dispatchEvent(new CustomEvent('servix:token-refresh', {
      detail: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    }));

    // 3. Process queued requests with the new token
    processQueue(null, newAccessToken);

    return newAccessToken;
  } catch (error) {
    processQueue(error as Error, null);
    return null;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Clear stale auth state from localStorage when token is expired/invalid.
 * This prevents infinite crash loops on pages that use useAuth().
 */
function clearStaleAuth() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('servix-auth');
    } catch {
      // ignore
    }
  }
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorBody {
  success: false;
  message?: string;
  statusCode?: number;
  error?: {
    code?: string;
    message?: string;
    details?: string[];
  };
  errors?: Record<string, string[]>;
}

/** Arabic-friendly fallback messages for common HTTP errors */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'البيانات المرسلة غير صحيحة',
  401: 'يجب تسجيل الدخول أولاً',
  403: 'ليس لديك صلاحية لهذا الإجراء',
  404: 'العنصر المطلوب غير موجود',
  409: 'يوجد تعارض — ربما البيانات مسجلة مسبقاً',
  422: 'البيانات المرسلة غير مكتملة',
  429: 'عدد الطلبات كثير، انتظر قليلاً',
  500: 'حدث خطأ في الخادم، حاول مرة أخرى',
};

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errors?: Record<string, string[]>,
    public details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, token } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    // On 401, try to refresh the token before giving up
    if (response.status === 401 && options.token) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        // Retry the original request with new token
        const retryHeaders: Record<string, string> = {
          ...requestHeaders,
          'Authorization': `Bearer ${newToken}`,
        };
        const retryRes = await fetch(`${API_BASE}${endpoint}`, {
          method,
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (retryRes.ok) {
          if (retryRes.status === 204) return undefined as T;
          const retryText = await retryRes.text();
          if (!retryText) return undefined as T;
          try {
            const retryJson = JSON.parse(retryText) as ApiSuccessResponse<T>;
            return retryJson.data;
          } catch {
            return undefined as T;
          }
        }
      }
      // Refresh failed — DON'T clear localStorage.
      // Only explicit logout should remove auth state.
    }

    let errorBody: ApiErrorBody | undefined;
    try {
      errorBody = (await response.json()) as ApiErrorBody;
    } catch {
      // response wasn't JSON
    }

    // Extract message from either format:
    // Format 1: { error: { message: "..." } }  (GlobalExceptionFilter)
    // Format 2: { message: "..." }              (NestJS default)
    const apiMessage =
      errorBody?.error?.message ||
      errorBody?.message ||
      undefined;

    // Build details from validation errors
    const details = errorBody?.error?.details;

    // Use API message, or friendly status fallback, or generic
    const userMessage =
      apiMessage ||
      STATUS_MESSAGES[response.status] ||
      `حدث خطأ غير متوقع (${response.status})`;

    throw new ApiError(
      userMessage,
      response.status,
      errorBody?.errors,
      details,
    );
  }

  // Handle 204 No Content (empty body)
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    const json = JSON.parse(text) as ApiSuccessResponse<T>;
    return json.data;
  } catch {
    // Response wasn't valid JSON
    return undefined as T;
  }
}

export const api = {
  get: <T>(endpoint: string, token?: string) =>
    apiClient<T>(endpoint, { token }),

  post: <T>(endpoint: string, body: unknown, token?: string) =>
    apiClient<T>(endpoint, { method: 'POST', body, token }),

  put: <T>(endpoint: string, body: unknown, token?: string) =>
    apiClient<T>(endpoint, { method: 'PUT', body, token }),

  patch: <T>(endpoint: string, body: unknown, token?: string) =>
    apiClient<T>(endpoint, { method: 'PATCH', body, token }),

  delete: <T>(endpoint: string, token?: string) =>
    apiClient<T>(endpoint, { method: 'DELETE', token }),
};
