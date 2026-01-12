"use client";
import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    full_name: string;
    role_name: string;
    user_code: string;
  };
  allowedMenus: string[];
}

export function AppShell({ children, user, allowedMenus }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        allowedMenus={allowedMenus}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="lg:pl-[280px]">
        {/* Topbar */}
        <Topbar
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Page content */}
        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
}
