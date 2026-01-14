"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gauge,
  Users,
  Ticket,
  Clock,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navLabels } from "@/lib/terminology/labels";

interface NavItem {
  id: string;  // Used for allowedMenus filtering (keeps legacy values)
  label: string;  // Display label (uses new terminology)
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
}

interface SidebarProps {
  allowedMenus: string[];
  isOpen: boolean;
  onClose: () => void;
}

/*
 * Base navigation definition. Children are left empty and will be
 * populated dynamically from the file system via the `/api/nav` API. The
 * `id` values here reflect legacy menu identifiers used for RBAC
 * filtering (allowedMenus).
 */
const baseNavItems: NavItem[] = [
  {
    id: "Dashboard",
    label: navLabels.dashboard,
    href: "/dashboard",
    icon: LayoutDashboard,
    children: [],
  },
  {
    id: "KPI",
    label: navLabels.performance,
    href: "/kpi",
    icon: Gauge,
    children: [],
  },
  {
    id: "CRM",
    label: navLabels.crm,
    href: "/crm",
    icon: Users,
    children: [],
  },
  {
    id: "Ticketing",
    label: navLabels.ticketing,
    href: "/ticketing",
    icon: Ticket,
    children: [],
  },
  {
    id: "DSO",
    label: navLabels.arDso,
    href: "/dso",
    icon: Clock,
    children: [],
  },
];

export function Sidebar({ allowedMenus, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const [repoNav, setRepoNav] = React.useState<
    | {
        ok: boolean;
        modules: Record<string, { children: { href: string; label: string }[] }>;
      }
    | null
  >(null);

  // Fetch menu data from the API when the component mounts. We disable
  // caching so that newly added routes show up without requiring a
  // full reload.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/nav", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.ok) {
          setRepoNav(json);
        }
      } catch {
        // silently ignore errors; the sidebar will fall back to baseNavItems
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge the base nav with children from the API. Use useMemo to avoid
  // recalculating on every render.
  const navItems: NavItem[] = React.useMemo(() => {
    const filtered = baseNavItems.filter((item) => allowedMenus.includes(item.id));
    if (!repoNav?.ok) {
      return filtered;
    }
    const result: NavItem[] = [];
    filtered.forEach((item) => {
      const key =
        item.id === "Dashboard"
          ? "dashboard"
          : item.id === "KPI"
          ? "kpi"
          : item.id === "CRM"
          ? "crm"
          : item.id === "Ticketing"
          ? "ticketing"
          : item.id === "DSO"
          ? "dso"
          : null;
      if (!key) {
        result.push(item);
        return;
      }
      const children = repoNav.modules[key]?.children ?? [];
      result.push({ ...item, children });
    });
    return result;
  }, [allowedMenus, repoNav]);

  // Function to determine if a link or its descendants are active.
  const isActive = React.useCallback(
    (href: string) => {
      if (href === "/dashboard") return pathname === "/dashboard";
      return pathname.startsWith(href);
    },
    [pathname],
  );

  // Automatically expand menu sections that contain the current route.
  React.useEffect(() => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      navItems.forEach((item) => {
        if (!item.children || item.children.length === 0) return;
        const activeChild = item.children.some((child) => pathname.startsWith(child.href));
        if (activeChild) next.add(item.id);
      });
      return Array.from(next);
    });
  }, [pathname, navItems]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id],
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      {/* Sidebar */}
      <aside
        className={cn(
          "sidebar fixed left-0 top-0 z-50 h-screen w-[280px] transition-transform duration-300",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">UGC Logistics</h1>
            <p className="text-xs text-muted-foreground">Integrated Dashboard</p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost btn-icon lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Navigation */}
        <nav className="sidebar-nav scrollbar-thin">
          <div className="nav-group-title">Main Menu</div>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.id}>
                {item.children && item.children.length > 0 ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className={cn(
                        "w-full",
                        isActive(item.href) ? "nav-item-active" : "nav-item",
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {expandedItems.includes(item.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {expandedItems.includes(item.id) && (
                      <ul className="mt-1 ml-4 space-y-1 border-l border-border pl-4">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onClose}
                              className={cn(
                                "block rounded-lg px-3 py-2 text-sm transition-colors",
                                isActive(child.href)
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={isActive(item.href) ? "nav-item-active" : "nav-item"}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        {/* Footer */}
        <div className="sidebar-footer">
          <div className="rounded-lg bg-primary/5 p-3 dark:bg-primary/10">
            <p className="text-xs font-medium text-primary">Need Help?</p>
            <p className="text-xs text-muted-foreground mt-1">Contact support for assistance</p>
          </div>
        </div>
      </aside>
    </>
  );
}

// Sidebar toggle button for topbar
export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn-ghost btn-icon lg:hidden"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
