"use client";

import * as React from "react";
import { X, Filter, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterField {
  name: string;
  label: string;
  type: "select" | "date" | "daterange" | "text";
  options?: FilterOption[];
}

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Record<string, string>;
  onFilterChange: (filters: Record<string, string>) => void;
  fields: FilterField[];
  onApply: () => void;
  onReset: () => void;
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  fields,
  onApply,
  onReset,
}: MobileFilterSheetProps) {
  const [localFilters, setLocalFilters] = React.useState(filters);

  React.useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters);
      // Prevent body scroll when sheet is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, filters]);

  const handleChange = (name: string, value: string) => {
    setLocalFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApply = () => {
    onFilterChange(localFilters);
    onApply();
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: Record<string, string> = {};
    fields.forEach((field) => {
      emptyFilters[field.name] = "";
    });
    setLocalFilters(emptyFilters);
    onFilterChange(emptyFilters);
    onReset();
    onClose();
  };

  const activeFilterCount = Object.values(localFilters).filter((v) => v).length;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
          "bg-card rounded-t-[20px] shadow-xl",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ maxHeight: "85vh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[10px] hover:bg-muted text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Fields */}
        <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: "calc(85vh - 180px)" }}>
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-foreground mb-2">
                {field.label}
              </label>
              {field.type === "select" && field.options ? (
                <div className="relative">
                  <select
                    value={localFilters[field.name] || ""}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    className="input w-full appearance-none pr-10"
                  >
                    <option value="">All</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              ) : field.type === "date" ? (
                <input
                  type="date"
                  value={localFilters[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="input w-full"
                />
              ) : field.type === "daterange" ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={localFilters[`${field.name}_from`] || ""}
                    onChange={(e) => handleChange(`${field.name}_from`, e.target.value)}
                    className="input w-full"
                    placeholder="From"
                  />
                  <input
                    type="date"
                    value={localFilters[`${field.name}_to`] || ""}
                    onChange={(e) => handleChange(`${field.name}_to`, e.target.value)}
                    className="input w-full"
                    placeholder="To"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={localFilters[field.name] || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="input w-full"
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <button
            onClick={handleReset}
            className="btn-outline flex-1"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="btn-primary flex-1"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}

// Hook to use mobile filter
export function useMobileFilter(initialFilters: Record<string, string> = {}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [filters, setFilters] = React.useState(initialFilters);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return {
    isOpen,
    open,
    close,
    filters,
    setFilters,
  };
}
