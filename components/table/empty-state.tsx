"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  FileX,
  Search,
  Inbox,
  FolderOpen,
  AlertCircle,
  Plus,
} from "lucide-react";

type EmptyStateVariant = "default" | "search" | "filter" | "error" | "no-data";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: React.ReactNode; title: string; description: string }
> = {
  default: {
    icon: <Inbox className="h-12 w-12" />,
    title: "No data available",
    description: "There are no items to display at the moment.",
  },
  search: {
    icon: <Search className="h-12 w-12" />,
    title: "No results found",
    description: "Try adjusting your search terms or filters.",
  },
  filter: {
    icon: <FolderOpen className="h-12 w-12" />,
    title: "No matching items",
    description: "No items match the current filter criteria. Try adjusting or clearing filters.",
  },
  error: {
    icon: <AlertCircle className="h-12 w-12" />,
    title: "Failed to load data",
    description: "An error occurred while loading. Please try again.",
  },
  "no-data": {
    icon: <FileX className="h-12 w-12" />,
    title: "No data yet",
    description: "Get started by creating your first item.",
  },
};

export function EmptyState({
  variant = "default",
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 text-muted-foreground mb-4">
        {icon || config.icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title || config.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description || config.description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {action.label}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
