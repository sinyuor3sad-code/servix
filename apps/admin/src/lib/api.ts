const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
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

async function apiRaw<T>(endpoint: string, options: ApiOptions = {}): Promise<ApiSuccessResponse<T>> {
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

/**
 * For paginated endpoints where the ResponseTransformInterceptor extracts meta.
 * Backend returns: { data: [...], meta: {...} }
 * Interceptor transforms to: { success: true, data: { data: [...] }, meta: {...} }
 * This function reassembles { data: [...], meta: {...} } for the frontend.
 */
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

  put: <T>(endpoint: string, body: unknown, token?: string): Promise<T> =>
    apiClient<T>(endpoint, { method: 'PUT', body, token }),

  patch: <T>(endpoint: string, body: unknown, token?: string): Promise<T> =>
    apiClient<T>(endpoint, { method: 'PATCH', body, token }),

  delete: <T>(endpoint: string, token?: string): Promise<T> =>
    apiClient<T>(endpoint, { method: 'DELETE', token }),
};
