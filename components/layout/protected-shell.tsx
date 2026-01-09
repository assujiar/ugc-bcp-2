"use client";

import { useUser } from "@/lib/contexts/user-context";
import { AppShell } from "@/components/layout/app-shell";
import { getAllowedMenus } from "@/lib/rbac";

interface ProtectedShellProps {
  children: React.ReactNode;
}

export function ProtectedShell({ children }: ProtectedShellProps) {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Cast role_name to the expected type
  const allowedMenus = getAllowedMenus(user.role_name as Parameters<typeof getAllowedMenus>[0]);

  return (
    <AppShell
      user={{
        full_name: user.full_name,
        role_name: user.role_name,
        user_code: user.user_code,
      }}
      allowedMenus={allowedMenus}
    >
      {children}
    </AppShell>
  );
}
