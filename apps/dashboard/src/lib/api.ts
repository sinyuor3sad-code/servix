const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
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
    // Auto-clear stale auth on 401 — prevents crash loops
    if (response.status === 401 && options.token) {
      clearStaleAuth();
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
