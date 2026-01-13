// lib/api/error.ts
// Standardized CRM API Error Contract with Correlation ID support

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// ==========================================
// Error Codes (for machine-readable errors)
// ==========================================

export const ERROR_CODES = {
  // 400 - Bad Request
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_UUID: "INVALID_UUID",
  INVALID_DATE: "INVALID_DATE",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FIELD_VALUE: "INVALID_FIELD_VALUE",

  // 401 - Unauthorized
  UNAUTHORIZED: "UNAUTHORIZED",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // 403 - Forbidden
  FORBIDDEN: "FORBIDDEN",
  RBAC_DENY: "RBAC_DENY",
  FIELD_UPDATE_DENIED: "FIELD_UPDATE_DENIED",
  STATE_TRANSITION_DENIED: "STATE_TRANSITION_DENIED",

  // 404 - Not Found
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  // 409 - Conflict
  CONFLICT: "CONFLICT",
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  CONCURRENT_MODIFICATION: "CONCURRENT_MODIFICATION",

  // 422 - Unprocessable Entity
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",

  // 500 - Internal Server Error
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  RPC_ERROR: "RPC_ERROR",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ==========================================
// Error Response Types
// ==========================================

export interface ApiErrorDetails {
  field?: string;
  message: string;
  value?: unknown;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ApiErrorDetails[];
  correlation_id: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}

// ==========================================
// Correlation ID Management
// ==========================================

/**
 * Generates a new correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `crm-${uuidv4().slice(0, 8)}-${Date.now().toString(36)}`;
}

/**
 * Extracts correlation ID from request headers or generates a new one
 */
export function getCorrelationId(request?: Request): string {
  if (request) {
    const existingId = request.headers.get("x-correlation-id");
    if (existingId) return existingId;
  }
  return generateCorrelationId();
}

// ==========================================
// Error Response Builder
// ==========================================

export interface ErrorOptions {
  code: ErrorCode;
  message: string;
  status?: 400 | 401 | 403 | 404 | 409 | 422 | 500;
  details?: ApiErrorDetails[];
  correlationId?: string;
}

/**
 * Creates a standardized API error response with correlation ID
 */
export function apiError(options: ErrorOptions): NextResponse<ApiErrorResponse> {
  const {
    code,
    message,
    status = 500,
    details,
    correlationId = generateCorrelationId()
  } = options;

  const errorBody: ApiErrorResponse = {
    error: {
      code,
      message,
      correlation_id: correlationId,
      ...(details && { details }),
    },
  };

  return NextResponse.json(errorBody, {
    status,
    headers: {
      "x-correlation-id": correlationId,
    },
  });
}

// ==========================================
// Convenience Error Functions
// ==========================================

export function validationError(
  message: string,
  details?: ApiErrorDetails[],
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ERROR_CODES.VALIDATION_ERROR,
    message,
    status: 422,
    details,
    correlationId,
  });
}

export function unauthorizedError(
  message: string = "Authentication required",
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ERROR_CODES.UNAUTHORIZED,
    message,
    status: 401,
    correlationId,
  });
}

export function forbiddenError(
  message: string = "Access denied",
  code: ErrorCode = ERROR_CODES.FORBIDDEN,
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  return apiError({
    code,
    message,
    status: 403,
    correlationId,
  });
}

export function rbacDenyError(
  message: string,
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ERROR_CODES.RBAC_DENY,
    message,
    status: 403,
    correlationId,
  });
}

export function notFoundError(
  resource: string,
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    message: `${resource} not found`,
    status: 404,
    correlationId,
  });
}

export function conflictError(
  message: string,
  code: ErrorCode = ERROR_CODES.CONFLICT,
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  return apiError({
    code,
    message,
    status: 409,
    correlationId,
  });
}

export function internalError(
  message: string = "An internal error occurred",
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ERROR_CODES.INTERNAL_ERROR,
    message,
    status: 500,
    correlationId,
  });
}

export function databaseError(
  message: string,
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  return apiError({
    code: ERROR_CODES.DATABASE_ERROR,
    message: `Database error: ${message}`,
    status: 500,
    correlationId,
  });
}

// ==========================================
// Success Response with Correlation ID
// ==========================================

export interface SuccessOptions<T> {
  data: T;
  status?: 200 | 201;
  correlationId?: string;
}

/**
 * Creates a standardized success response with correlation ID header
 */
export function apiSuccess<T>(options: SuccessOptions<T>): NextResponse<T> {
  const {
    data,
    status = 200,
    correlationId = generateCorrelationId()
  } = options;

  return NextResponse.json(data, {
    status,
    headers: {
      "x-correlation-id": correlationId,
    },
  });
}

// ==========================================
// Zod Error Parser
// ==========================================

import type { ZodError } from "zod";

/**
 * Converts Zod validation errors to API error details
 */
export function parseZodError(zodError: ZodError): ApiErrorDetails[] {
  return zodError.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Creates a validation error response from a Zod error
 */
export function zodValidationError(
  zodError: ZodError,
  correlationId?: string
): NextResponse<ApiErrorResponse> {
  const details = parseZodError(zodError);
  return validationError(
    "Validation failed",
    details,
    correlationId
  );
}

// ==========================================
// Error Handler Wrapper
// ==========================================

type RouteHandler = (
  request: Request,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse>;

/**
 * Wraps a route handler with automatic error handling and correlation ID
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const correlationId = getCorrelationId(request);

    try {
      const response = await handler(request, context);

      // Add correlation ID to response if not already present
      if (!response.headers.get("x-correlation-id")) {
        response.headers.set("x-correlation-id", correlationId);
      }

      return response;
    } catch (error) {
      console.error(`[${correlationId}] Unhandled error:`, error);

      return internalError(
        "An unexpected error occurred. Please try again or contact support.",
        correlationId
      );
    }
  };
}
