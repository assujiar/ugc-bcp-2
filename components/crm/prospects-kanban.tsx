"use client";

import * as React from "react";
import Link from "next/link";
import { Prospect } from "@/lib/api";
import { Building2, User, Calendar, Activity, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  title: string;
  stage: string;
  prospects: Prospect[];
  color: string;
  onDrop?: (prospectId: string, newStage: string) => void;
}

function KanbanColumn({ title, stage, prospects, color, onDrop }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const prospectId = e.dataTransfer.getData("prospect_id");
    if (prospectId && onDrop) {
      onDrop(prospectId, stage);
    }
  };

  return (
    <div
      className={cn(
        "flex-shrink-0 w-72 bg-muted/30 rounded-[14px] p-3",
        isDragOver && "ring-2 ring-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", color)} />
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {prospects.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2 min-h-[200px]">
        {prospects.map((prospect) => (
          <KanbanCard key={prospect.prospect_id} prospect={prospect} />
        ))}
        {prospects.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No prospects
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCard({ prospect }: { prospect: Prospect }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("prospect_id", prospect.prospect_id);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="bg-card border border-border rounded-[12px] p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
    >
      {/* Company Name */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary/10 text-primary text-sm font-medium">
            {prospect.customer?.company_name?.charAt(0) || "?"}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm truncate max-w-[150px]">
              {prospect.customer?.company_name || "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground">{prospect.prospect_id}</p>
          </div>
        </div>
        <button className="p-1 hover:bg-muted rounded-[6px] transition-colors">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Contact */}
      {prospect.customer?.pic_name && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <User className="h-3 w-3" />
          <span className="truncate">{prospect.customer.pic_name}</span>
        </div>
      )}

      {/* Owner */}
      {prospect.owner?.full_name && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Activity className="h-3 w-3" />
          <span className="truncate">{prospect.owner.full_name}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(prospect.created_at).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
          })}
        </div>
        <Link
          href={`/crm/activities/new?prospect_id=${prospect.prospect_id}`}
          className="text-xs text-primary hover:underline"
        >
          Log Activity
        </Link>
      </div>
    </div>
  );
}

interface ProspectsKanbanProps {
  prospects: Prospect[];
  onStageChange?: (prospectId: string, newStage: string) => void;
}

const KANBAN_STAGES = [
  { key: "Prospect Created", title: "New", color: "bg-info" },
  { key: "Initial Contact", title: "Initial Contact", color: "bg-info" },
  { key: "Need Analysis", title: "Need Analysis", color: "bg-warning" },
  { key: "Proposal Sent", title: "Proposal", color: "bg-primary" },
  { key: "Negotiation", title: "Negotiation", color: "bg-primary" },
  { key: "Closed Won", title: "Won", color: "bg-success" },
  { key: "Closed Lost", title: "Lost", color: "bg-destructive" },
  { key: "Nurturing", title: "Nurturing", color: "bg-secondary" },
];

export function ProspectsKanban({ prospects, onStageChange }: ProspectsKanbanProps) {
  // Group prospects by stage
  const prospectsByStage = React.useMemo(() => {
    const grouped: Record<string, Prospect[]> = {};
    KANBAN_STAGES.forEach((stage) => {
      grouped[stage.key] = [];
    });
    prospects.forEach((prospect) => {
      if (grouped[prospect.current_stage]) {
        grouped[prospect.current_stage].push(prospect);
      }
    });
    return grouped;
  }, [prospects]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_STAGES.map((stage) => (
        <KanbanColumn
          key={stage.key}
          title={stage.title}
          stage={stage.key}
          prospects={prospectsByStage[stage.key] || []}
          color={stage.color}
          onDrop={onStageChange}
        />
      ))}
    </div>
  );
}
