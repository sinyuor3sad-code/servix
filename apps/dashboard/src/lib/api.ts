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

  // Handle 204 No Content (empty body)
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  const json = JSON.parse(text) as ApiSuccessResponse<T>;
  return json.data;
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
