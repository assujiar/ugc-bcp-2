"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  label?: string;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  cell?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  sortState?: SortState;
  onSort?: (state: SortState) => void;
  rowActions?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyMessage = "No data found",
  onRowClick,
  getRowId,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  sortState,
  onSort,
  rowActions,
}: DataTableProps<T>) {
  const totalPages = total ? Math.ceil(total / pageSize) : 1;

  const getValue = (row: T, key: string): unknown => {
    const keys = key.split(".");
    let value: unknown = row;
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }
    return value;
  };

  const handleSort = (col: Column<T>) => {
    if (!col.sortable || !onSort) return;
    const key = String(col.key);
    const direction = sortState?.key === key && sortState.direction === "asc" ? "desc" : "asc";
    onSort({ key, direction });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => handleSort(col)}
                  className={cn(
                    "py-3 px-4 text-sm font-medium text-muted-foreground",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    col.align !== "center" && col.align !== "right" && "text-left",
                    col.sortable && "cursor-pointer hover:text-foreground",
                    col.className
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label || col.header}
                    {col.sortable && sortState?.key === String(col.key) && (
                      sortState.direction === "asc" 
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                    )}
                  </span>
                </th>
              ))}
              {rowActions && <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={getRowId?.(row) || rowIndex}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-border/50 hover:bg-muted/30 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((col) => {
                  const value = getValue(row, String(col.key));
                  return (
                    <td
                      key={String(col.key)}
                      className={cn(
                        "py-3 px-4",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right",
                        col.className
                      )}
                    >
                      {col.cell 
                        ? col.cell(row)
                        : col.render
                          ? col.render(value, row, rowIndex)
                          : (value as React.ReactNode) ?? "-"}
                    </td>
                  );
                })}
                {rowActions && (
                  <td className="py-3 px-4 text-right">
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
            {total && ` (${total} total)`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="btn-outline p-2 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="btn-outline p-2 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
