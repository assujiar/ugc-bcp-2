"use client";

import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";
import type { ApiError, ApiErrorDetails } from "@/lib/api/error";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

type ToastVariant = "default" | "success" | "warning" | "error" | "info";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: ToastVariant;
  correlationId?: string;
  fieldErrors?: ApiErrorDetails[];
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

// ==========================================
// Convenience functions for common toasts
// ==========================================

function toastSuccess(title: string, description?: string) {
  return toast({
    title,
    description,
    variant: "success",
  });
}

function toastError(title: string, description?: string, correlationId?: string) {
  return toast({
    title,
    description: correlationId
      ? `${description || ""}\n\nRef: ${correlationId}`
      : description,
    variant: "error",
    correlationId,
  });
}

function toastWarning(title: string, description?: string) {
  return toast({
    title,
    description,
    variant: "warning",
  });
}

function toastInfo(title: string, description?: string) {
  return toast({
    title,
    description,
    variant: "info",
  });
}

/**
 * Handles API error responses and shows appropriate toast
 * @param error - The API error object
 * @param fallbackMessage - Fallback message if error doesn't have a message
 */
function toastApiError(error: ApiError, fallbackMessage: string = "An error occurred") {
  const message = error.message || fallbackMessage;

  // For 5xx errors, always show correlation ID
  const showCorrelationId = error.code === "INTERNAL_ERROR" ||
    error.code === "DATABASE_ERROR" ||
    error.code === "RPC_ERROR";

  return toast({
    title: "Error",
    description: showCorrelationId
      ? `${message}\n\nReference: ${error.correlation_id}`
      : message,
    variant: "error",
    correlationId: error.correlation_id,
    fieldErrors: error.details,
  });
}

/**
 * Parses fetch response and shows toast for errors
 * Returns the parsed data if successful, null if error
 */
async function handleApiResponse<T>(
  response: Response,
  successMessage?: string
): Promise<{ data: T | null; error: ApiError | null }> {
  const data = await response.json();

  if (!response.ok) {
    const error = data.error as ApiError;
    toastApiError(error, "Request failed");
    return { data: null, error };
  }

  if (successMessage) {
    toastSuccess(successMessage);
  }

  return { data: data as T, error: null };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    toastSuccess,
    toastError,
    toastWarning,
    toastInfo,
    toastApiError,
    handleApiResponse,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast, toastSuccess, toastError, toastWarning, toastInfo, toastApiError, handleApiResponse };
