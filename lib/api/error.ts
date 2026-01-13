// lib/api/error.ts
// Standardized API error/success contract with correlation ID

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// ==========================================
// Types
// ==========================================

export interface ApiErrorBody {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  correlation_id: string;
}

export interface ApiSuccessBody<T = unknown> {
  success: true;
  data: T;
  correlation_id: string;
  pagination?: PaginationMeta;
  meta?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Standard error codes
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE";

// HTTP status mapping
const ERROR_CODE_TO_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  BAD_REQUEST: 400,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
};

// ==========================================
// Error Response Builder
// ==========================================

/**
 * Creates a standardized error response with correlation ID
 *
 * @example
 * return apiError("UNAUTHORIZED", "Authentication required");
 * return apiError("VALIDATION_ERROR", "Invalid payload", { field: "email", issue: "invalid format" });
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown
): NextResponse<ApiErrorBody> {
  const correlationId = uuidv4();
  const status = ERROR_CODE_TO_STATUS[code];

  const body: ApiErrorBody = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
    correlation_id: correlationId,
  };

  // Log error for debugging (server-side)
  console.error(`[API Error] ${correlationId} | ${code} | ${message}`, details ? JSON.stringify(details) : "");

  return NextResponse.json(body, {
    status,
    headers: {
      "x-correlation-id": correlationId,
    },
  });
}

// ==========================================
// Success Response Builder
// ==========================================

interface SuccessOptions<T> {
  data: T;
  pagination?: PaginationMeta;
  meta?: Record<string, unknown>;
  status?: 200 | 201;
}

/**
 * Creates a standardized success response with correlation ID
 *
 * @example
 * return apiSuccess({ data: account });
 * return apiSuccess({ data: leads, pagination: { page: 1, pageSize: 20, total: 100, totalPages: 5 } });
 * return apiSuccess({ data: newLead, status: 201 });
 */
export function apiSuccess<T>(options: SuccessOptions<T>): NextResponse<ApiSuccessBody<T>> {
  const { data, pagination, meta, status = 200 } = options;
  const correlationId = uuidv4();

  const body: ApiSuccessBody<T> = {
    success: true,
    data,
    correlation_id: correlationId,
    ...(pagination && { pagination }),
    ...(meta && { meta }),
  };

  return NextResponse.json(body, {
    status,
    headers: {
      "x-correlation-id": correlationId,
    },
  });
}

// ==========================================
// Common Error Shortcuts
// ==========================================

export const apiErrors = {
  /** 401 - User not authenticated */
  unauthorized: (message = "Authentication required") =>
    apiError("UNAUTHORIZED", message),

  /** 403 - User lacks permission */
  forbidden: (message = "Access denied") =>
    apiError("FORBIDDEN", message),

  /** 404 - Resource not found */
  notFound: (resource = "Resource") =>
    apiError("NOT_FOUND", `${resource} not found`),

  /** 400 - Validation failed */
  validation: (message: string, details?: unknown) =>
    apiError("VALIDATION_ERROR", message, details),

  /** 409 - Conflict (duplicate, already claimed, etc.) */
  conflict: (message: string) =>
    apiError("CONFLICT", message),

  /** 500 - Internal server error */
  internal: (message = "An unexpected error occurred") =>
    apiError("INTERNAL_ERROR", message),

  /** 400 - Bad request */
  badRequest: (message: string) =>
    apiError("BAD_REQUEST", message),
};
