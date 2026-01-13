"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastIcon,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/lib/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, fieldErrors, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex gap-3">
              <ToastIcon variant={variant} />
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
                {/* Field-level errors for validation */}
                {fieldErrors && fieldErrors.length > 0 && (
                  <div className="mt-2 text-sm space-y-1">
                    {fieldErrors.map((err, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="font-medium">{err.field}:</span>
                        <span className="opacity-90">{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
