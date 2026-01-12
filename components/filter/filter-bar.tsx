"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Calendar,
  RefreshCw,
  Bookmark,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Filter option type
export interface FilterOption {
  value: string;
  label: string;
}

// Filter field definition
export interface FilterField {
  key: string;
  label: string;
  type: "select" | "date" | "daterange" | "search" | "multi-select";
  options?: FilterOption[];
  placeholder?: string;
  defaultValue?: string;
}

// Filter values type
export type FilterValues = Record<string, string | string[]>;

interface FilterBarProps {
  fields: FilterField[];
  onFilterChange?: (filters: FilterValues) => void;
  onReset?: () => void;
  showSavedViews?: boolean;
  onSaveView?: (name: string, filters: FilterValues) => void;
  savedViews?: { id: string; name: string; filters: FilterValues }[];
  onLoadView?: (viewId: string) => void;
  className?: string;
}

export function FilterBar({
  fields,
  onFilterChange,
  onReset,
  showSavedViews = false,
  savedViews = [],
  onLoadView,
  onSaveView,
  className,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize filters from URL params
  const [filters, setFilters] = React.useState<FilterValues>(() => {
    const initial: FilterValues = {};
    fields.forEach((field) => {
      const paramValue = searchParams.get(field.key);
      if (paramValue) {
        initial[field.key] = paramValue;
      } else if (field.defaultValue) {
        initial[field.key] = field.defaultValue;
      }
    });
    return initial;
  });

  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [viewName, setViewName] = React.useState("");

  // Sync URL with filters
  const updateURL = React.useCallback(
    (newFilters: FilterValues) => {
      const params = new URLSearchParams();
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value && value !== "" && (!Array.isArray(value) || value.length > 0)) {
          if (Array.isArray(value)) {
            params.set(key, value.join(","));
          } else {
            params.set(key, value);
          }
        }
      });
      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, router]
  );

  // Handle filter change
  const handleFilterChange = (key: string, value: string | string[]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    updateURL(newFilters);
    onFilterChange?.(newFilters);
  };

  // Handle reset
  const handleReset = () => {
    const defaultFilters: FilterValues = {};
    fields.forEach((field) => {
      if (field.defaultValue) {
        defaultFilters[field.key] = field.defaultValue;
      }
    });
    setFilters(defaultFilters);
    updateURL(defaultFilters);
    onReset?.();
    onFilterChange?.(defaultFilters);
  };

  // Handle save view
  const handleSaveView = () => {
    if (viewName.trim() && onSaveView) {
      onSaveView(viewName.trim(), filters);
      setViewName("");
      setShowSaveModal(false);
    }
  };

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(
    (v) => v && v !== "" && (!Array.isArray(v) || v.length > 0)
  ).length;

  // Separate search field from others
  const searchField = fields.find((f) => f.type === "search");
  const otherFields = fields.filter((f) => f.type !== "search");

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search Input */}
        {searchField && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchField.placeholder || "Search..."}
              value={(filters[searchField.key] as string) || ""}
              onChange={(e) => handleFilterChange(searchField.key, e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-[14px] border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            {filters[searchField.key] && (
              <button
                onClick={() => handleFilterChange(searchField.key, "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Quick Filters (first 2-3 select fields) */}
        {otherFields.slice(0, 3).map((field) => (
          <div key={field.key} className="relative">
            {field.type === "select" && (
              <select
                value={(filters[field.key] as string) || ""}
                onChange={(e) => handleFilterChange(field.key, e.target.value)}
                className="h-10 pl-3 pr-8 rounded-[14px] border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 min-w-[140px]"
              >
                <option value="">{field.placeholder || `All ${field.label}`}</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            {field.type === "date" && (
              <input
                type="date"
                value={(filters[field.key] as string) || ""}
                onChange={(e) => handleFilterChange(field.key, e.target.value)}
                className="h-10 px-3 rounded-[14px] border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              />
            )}
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        ))}

        {/* More Filters Button */}
        {otherFields.length > 3 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "h-10 px-4 rounded-[14px] border text-sm font-medium transition-colors inline-flex items-center gap-2",
              isExpanded
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-background text-foreground hover:bg-muted"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            More Filters
            {activeFilterCount > 3 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                {activeFilterCount - 3}
              </span>
            )}
          </button>
        )}

        {/* Saved Views Dropdown */}
        {showSavedViews && savedViews.length > 0 && (
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value && onLoadView) {
                  onLoadView(e.target.value);
                }
              }}
              className="h-10 pl-3 pr-8 rounded-[14px] border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              defaultValue=""
            >
              <option value="" disabled>
                Saved Views
              </option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
            <Bookmark className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          {activeFilterCount > 0 && (
            <button
              onClick={handleReset}
              className="h-10 px-4 rounded-[14px] border border-input bg-background text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </button>
          )}
          {showSavedViews && activeFilterCount > 0 && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="h-10 px-4 rounded-[14px] border border-primary bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors inline-flex items-center gap-2"
            >
              <Bookmark className="h-4 w-4" />
              Save View
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && otherFields.length > 3 && (
        <div className="p-4 rounded-[14px] border border-input bg-muted/30 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {otherFields.slice(3).map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {field.label}
                </label>
                {field.type === "select" && (
                  <select
                    value={(filters[field.key] as string) || ""}
                    onChange={(e) => handleFilterChange(field.key, e.target.value)}
                    className="w-full h-10 pl-3 pr-8 rounded-[12px] border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">{field.placeholder || `All`}</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === "date" && (
                  <input
                    type="date"
                    value={(filters[field.key] as string) || ""}
                    onChange={(e) => handleFilterChange(field.key, e.target.value)}
                    className="w-full h-10 px-3 rounded-[12px] border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
                {field.type === "daterange" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={(filters[`${field.key}_from`] as string) || ""}
                      onChange={(e) => handleFilterChange(`${field.key}_from`, e.target.value)}
                      className="flex-1 h-10 px-3 rounded-[12px] border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-muted-foreground">-</span>
                    <input
                      type="date"
                      value={(filters[`${field.key}_to`] as string) || ""}
                      onChange={(e) => handleFilterChange(`${field.key}_to`, e.target.value)}
                      className="flex-1 h-10 px-3 rounded-[12px] border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters Pills */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {Object.entries(filters).map(([key, value]) => {
            if (!value || value === "" || (Array.isArray(value) && value.length === 0)) return null;
            const field = fields.find((f) => f.key === key);
            if (!field) return null;

            const displayValue = Array.isArray(value)
              ? value.join(", ")
              : field.options?.find((o) => o.value === value)?.label || value;

            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                {field.label}: {displayValue}
                <button
                  onClick={() => handleFilterChange(key, "")}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Save View Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-[16px] p-6 w-full max-w-md shadow-xl animate-scale-in">
            <h3 className="text-lg font-semibold mb-4">Save Current View</h3>
            <input
              type="text"
              placeholder="Enter view name..."
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="w-full h-10 px-4 rounded-[14px] border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-[14px] text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveView}
                disabled={!viewName.trim()}
                className="px-4 py-2 rounded-[14px] bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterBar;
