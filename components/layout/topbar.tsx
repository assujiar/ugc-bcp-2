"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  Bell,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Users,
  Ticket,
  FileText,
  Building2,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopbarProps {
  user: {
    full_name: string;
    role_name: string;
    email?: string;
  };
  onMenuClick?: () => void;
}

interface SearchResult {
  type: "lead" | "customer" | "ticket" | "invoice";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

interface Notification {
  id: string;
  type: "lead" | "ticket" | "invoice" | "system";
  title: string;
  message: string;
  href?: string;
  read: boolean;
  created_at: string;
}

export function Topbar({ user, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loadingNotifications, setLoadingNotifications] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Prevent hydration mismatch - wait for client mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch notifications
  const fetchNotifications = React.useCallback(async () => {
    if (!mounted) return;
    setLoadingNotifications(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoadingNotifications(false);
    }
  }, [mounted]);

  // Initial fetch after mount
  React.useEffect(() => {
    if (mounted) {
      fetchNotifications();
      // Refresh every 2 minutes
      const interval = setInterval(fetchNotifications, 120000);
      return () => clearInterval(interval);
    }
  }, [mounted, fetchNotifications]);

  // Search debounce
  React.useEffect(() => {
    if (!mounted) return;
    
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.results || []);
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, mounted]);

  // Close search on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd/Ctrl + K)
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSearchSelect = (result: SearchResult) => {
    router.push(result.href);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleMarkAllRead = async () => {
    try {
      const ids = notifications.filter(n => !n.read).map(n => n.id);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_ids: ids }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "lead":
        return <Users className="h-4 w-4 text-primary" />;
      case "ticket":
        return <Ticket className="h-4 w-4 text-info" />;
      case "invoice":
        return <FileText className="h-4 w-4 text-warning" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSearchResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "lead":
        return <Users className="h-4 w-4 text-primary" />;
      case "customer":
        return <Building2 className="h-4 w-4 text-success" />;
      case "ticket":
        return <Ticket className="h-4 w-4 text-info" />;
      case "invoice":
        return <FileText className="h-4 w-4 text-warning" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6">
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden btn-ghost h-10 w-10 p-0"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search */}
        <div ref={searchRef} className="relative">
          <button
            onClick={() => {
              setShowSearch(true);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-muted/50 hover:bg-muted border border-border text-muted-foreground transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Search...</span>
            <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-xs text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          {/* Search Modal */}
          {showSearch && (
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-background/80 backdrop-blur-sm">
              <div className="w-full max-w-xl bg-card rounded-xl shadow-2xl border border-border overflow-hidden">
                <div className="flex items-center gap-3 px-4 border-b border-border">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search leads, customers, tickets, invoices..."
                    className="flex-1 h-14 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <button onClick={() => setShowSearch(false)} className="btn-ghost h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-80 overflow-y-auto p-2">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSearchSelect(result)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                          {getSearchResultIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">{result.type}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No results found for &quot;{searchQuery}&quot;</p>
                  </div>
                )}

                {searchQuery.length < 2 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <p>Type at least 2 characters to search</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Theme Toggle + Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle - Only render after mount to avoid hydration mismatch */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="btn-ghost h-10 w-10 p-0"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        )}

        {/* Notifications - Only render dropdown after mount */}
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative btn-ghost h-10 w-10 p-0">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-4 py-2">
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                {loadingNotifications ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      asChild
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 cursor-pointer",
                        !notification.read && "bg-primary/5"
                      )}
                    >
                      <Link href={notification.href || "#"}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm truncate",
                            !notification.read ? "font-medium text-foreground" : "text-muted-foreground"
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="justify-center">
                <button
                  onClick={fetchNotifications}
                  className="w-full text-center text-sm text-primary"
                >
                  Refresh
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button className="relative btn-ghost h-10 w-10 p-0">
            <Bell className="h-5 w-5" />
          </button>
        )}

        {/* User Menu - Only render dropdown after mount */}
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 h-10 px-3 rounded-xl hover:bg-muted transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-foreground leading-none">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground leading-none mt-1">
                    {user.role_name}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground font-normal">{user.role_name}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button className="flex items-center gap-2 h-10 px-3 rounded-xl hover:bg-muted transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-foreground leading-none">
                {user.full_name}
              </p>
              <p className="text-xs text-muted-foreground leading-none mt-1">
                {user.role_name}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
          </button>
        )}
      </div>
    </header>
  );
}
