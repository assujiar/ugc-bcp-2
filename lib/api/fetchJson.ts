// lib/api/fetchJson.ts
// Client-side fetch wrapper with standardized error handling and toast notifications

import { toastError, toastSuccess } from "@/lib/hooks/use-toast";
import type { ApiErrorBody, ApiSuccessBody, PaginationMeta } from "./error";

// ==========================================
// Types
// ==========================================

export interface FetchJsonOptions<T = unknown> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: T;
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Show toast on success (default: false for GET, true for mutations) */
  showSuccessToast?: boolean;
  /** Custom success message */
  successMessage?: string;
  /** Show toast on error (default: true) */
  showErrorToast?: boolean;
  /** Custom error message (overrides API error message) */
  errorMessage?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

export interface FetchJsonResult<T> {
  success: true;
  data: T;
  pagination?: PaginationMeta;
  meta?: Record<string, unknown>;
  correlationId: string;
}

export interface FetchJsonError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId: string;
}

export type FetchJsonResponse<T> = FetchJsonResult<T> | FetchJsonError;

// ==========================================
// Core Fetch Function
// ==========================================

/**
 * Standardized fetch wrapper that:
 * - Parses API error contract
 * - Auto-shows toast notifications
 * - Logs correlation_id in dev
 *
 * @example
 * // Simple GET
 * const result = await fetchJson<Account[]>("/api/crm/accounts");
 * if (result.success) {
 *   setAccounts(result.data);
 * }
 *
 * @example
 * // POST with success toast
 * const result = await fetchJson<{ lead: Lead }>("/api/crm/leads", {
 *   method: "POST",
 *   body: leadData,
 *   successMessage: "Lead created successfully",
 * });
 *
 * @example
 * // With query params
 * const result = await fetchJson<PaginatedResponse<Lead>>("/api/crm/leads", {
 *   params: { page: 1, pageSize: 20, status: "new" },
 * });
 */
export async function fetchJson<T>(
  endpoint: string,
  options: FetchJsonOptions = {}
): Promise<FetchJsonResponse<T>> {
  const {
    method = "GET",
    body,
    params,
    showSuccessToast,
    successMessage,
    showErrorToast = true,
    errorMessage,
    headers: customHeaders,
  } = options;

  // Build URL with query params
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Build fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...customHeaders,
    },
  };

  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const correlationId = response.headers.get("x-correlation-id") || "unknown";

    // Try to parse JSON response
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      // Response is not JSON
      if (!response.ok) {
        const error: FetchJsonError = {
          success: false,
          error: {
            code: "PARSE_ERROR",
            message: "Failed to parse server response",
          },
          correlationId,
        };
        if (showErrorToast) {
          toastError("Error", errorMessage || "Failed to parse server response", correlationId);
        }
        return error;
      }
      // Success but no JSON body
      return {
        success: true,
        data: null as T,
        correlationId,
      };
    }

    // Check if response matches our error contract
    if (!response.ok) {
      const apiError = data as ApiErrorBody;

      // Handle standardized error response
      if (apiError && apiError.success === false && apiError.error) {
        const error: FetchJsonError = {
          success: false,
          error: apiError.error,
          correlationId: apiError.correlation_id || correlationId,
        };

        if (showErrorToast) {
          toastError(
            apiError.error.code || "Error",
            errorMessage || apiError.error.message,
            apiError.correlation_id || correlationId
          );
        }

        // Log in dev mode
        if (process.env.NODE_ENV === "development") {
          console.error(
            `[fetchJson Error] ${apiError.correlation_id || correlationId}`,
            apiError.error
          );
        }

        return error;
      }

      // Handle legacy error format { error: "message" }
      const legacyError = data as { error?: string; details?: unknown };
      const error: FetchJsonError = {
        success: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: legacyError?.error || "An error occurred",
          details: legacyError?.details,
        },
        correlationId,
      };

      if (showErrorToast) {
        toastError("Error", errorMessage || legacyError?.error || "An error occurred", correlationId);
      }

      return error;
    }

    // Success response
    const apiSuccess = data as ApiSuccessBody<T>;

    // Handle standardized success response
    if (apiSuccess && apiSuccess.success === true) {
      const result: FetchJsonResult<T> = {
        success: true,
        data: apiSuccess.data,
        correlationId: apiSuccess.correlation_id || correlationId,
        ...(apiSuccess.pagination && { pagination: apiSuccess.pagination }),
        ...(apiSuccess.meta && { meta: apiSuccess.meta }),
      };

      // Show success toast for mutations by default
      const shouldShowSuccess = showSuccessToast ?? (method !== "GET");
      if (shouldShowSuccess && successMessage) {
        toastSuccess("Success", successMessage, apiSuccess.correlation_id || correlationId);
      }

      return result;
    }

    // Handle legacy success format (direct data)
    // This supports backwards compatibility with existing APIs that return { data: ..., pagination: ... }
    const legacyData = data as { data?: T; pagination?: PaginationMeta } & T;
    const result: FetchJsonResult<T> = {
      success: true,
      // If response has a 'data' property, use it; otherwise use the whole response as data
      data: (legacyData?.data !== undefined ? legacyData.data : legacyData) as T,
      correlationId,
      ...(legacyData?.pagination && { pagination: legacyData.pagination }),
    };

    const shouldShowSuccess = showSuccessToast ?? (method !== "GET");
    if (shouldShowSuccess && successMessage) {
      toastSuccess("Success", successMessage, correlationId);
    }

    return result;
  } catch (err) {
    // Network or other errors
    const errorMsg = err instanceof Error ? err.message : "Network error";
    const correlationId = "client-error";

    if (process.env.NODE_ENV === "development") {
      console.error("[fetchJson Network Error]", err);
    }

    if (showErrorToast) {
      toastError("Connection Error", errorMessage || errorMsg, correlationId);
    }

    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: errorMsg,
      },
      correlationId,
    };
  }
}

// ==========================================
// Type Guards
// ==========================================

export function isSuccess<T>(response: FetchJsonResponse<T>): response is FetchJsonResult<T> {
  return response.success === true;
}

export function isError<T>(response: FetchJsonResponse<T>): response is FetchJsonError {
  return response.success === false;
}
