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

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
}

interface SidebarProps {
  allowedMenus: string[];
  isOpen: boolean;
  onClose: () => void;
}

const allNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "KPI",
    href: "/kpi",
    icon: Gauge,
    children: [
      { label: "Overview", href: "/kpi" },
      { label: "My KPI", href: "/kpi/my" },
      { label: "Team KPI", href: "/kpi/team" },
      { label: "Targets", href: "/kpi/targets" },
      { label: "Input", href: "/kpi/input" },
    ],
  },
  {
    label: "CRM",
    href: "/crm",
    icon: Users,
    children: [
      { label: "Leads", href: "/crm/leads" },
      { label: "Customers", href: "/crm/customers" },
      { label: "Prospects", href: "/crm/prospects" },
    ],
  },
  {
    label: "Ticketing",
    href: "/ticketing",
    icon: Ticket,
    children: [
      { label: "All Tickets", href: "/ticketing" },
      { label: "Create Ticket", href: "/ticketing/create" },
    ],
  },
  {
    label: "DSO",
    href: "/dso",
    icon: Clock,
    children: [
      { label: "Overview", href: "/dso" },
      { label: "Invoices", href: "/dso/invoices" },
      { label: "Payments", href: "/dso/payments" },
    ],
  },
];

export function Sidebar({ allowedMenus, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  // Filter nav items based on allowed menus
  const navItems = allNavItems.filter((item) => allowedMenus.includes(item.label));

  // Auto-expand active parent
  React.useEffect(() => {
    navItems.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some((child) => pathname.startsWith(child.href));
        if (isChildActive && !expandedItems.includes(item.label)) {
          setExpandedItems((prev) => [...prev, item.label]);
        }
      }
    });
  }, [pathname, navItems, expandedItems]);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
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
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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
              <li key={item.label}>
                {item.children ? (
                  // Expandable item
                  <div>
                    <button
                      onClick={() => toggleExpand(item.label)}
                      className={cn(
                        "w-full",
                        isActive(item.href) ? "nav-item-active" : "nav-item"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {expandedItems.includes(item.label) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {expandedItems.includes(item.label) && (
                      <ul className="mt-1 ml-4 space-y-1 border-l border-border pl-4">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onClose}
                              className={cn(
                                "block rounded-lg px-3 py-2 text-sm transition-colors",
                                pathname === child.href
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground"
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
                  // Simple link
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
            <p className="text-xs text-muted-foreground mt-1">
              Contact support for assistance
            </p>
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
