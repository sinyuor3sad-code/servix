export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}
