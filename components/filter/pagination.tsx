"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  totalItems: number;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSize?: boolean;
  showInfo?: boolean;
  className?: string;
}

export function Pagination({
  totalItems,
  pageSize: controlledPageSize,
  currentPage: controlledPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSize = true,
  showInfo = true,
  className,
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get page and pageSize from URL or props
  const urlPage = parseInt(searchParams.get("page") || "1", 10);
  const urlPageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  const currentPage = controlledPage ?? urlPage;
  const pageSize = controlledPageSize ?? urlPageSize;

  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Update URL with pagination params
  const updateURL = React.useCallback(
    (page: number, size: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", page.toString());
      params.set("pageSize", size.toString());
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    if (onPageChange) {
      onPageChange(page);
    } else {
      updateURL(page, pageSize);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(size);
    } else {
      updateURL(1, size); // Reset to page 1 when changing page size
    }
  };

  // Generate page numbers to display
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near start
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
      } else if (currentPage >= totalPages - 2) {
        // Near end
        pages.push("ellipsis");
        for (let i = totalPages - 3; i < totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Middle
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 flex-wrap py-4",
        className
      )}
    >
      {/* Info & Page Size */}
      <div className="flex items-center gap-4">
        {showInfo && (
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{startItem}</span> to{" "}
            <span className="font-medium text-foreground">{endItem}</span> of{" "}
            <span className="font-medium text-foreground">{totalItems}</span> results
          </p>
        )}
        {showPageSize && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
              className="h-8 px-2 pr-6 rounded-[10px] border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className={cn(
            "h-9 w-9 rounded-[10px] flex items-center justify-center transition-colors",
            currentPage === 1
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            "h-9 w-9 rounded-[10px] flex items-center justify-center transition-colors",
            currentPage === 1
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === "ellipsis" ? (
                <span className="h-9 w-9 flex items-center justify-center text-muted-foreground">
                  ...
                </span>
              ) : (
                <button
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    "h-9 min-w-[36px] px-2 rounded-[10px] text-sm font-medium transition-colors",
                    currentPage === page
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Next Page */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            "h-9 w-9 rounded-[10px] flex items-center justify-center transition-colors",
            currentPage === totalPages
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={cn(
            "h-9 w-9 rounded-[10px] flex items-center justify-center transition-colors",
            currentPage === totalPages
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
