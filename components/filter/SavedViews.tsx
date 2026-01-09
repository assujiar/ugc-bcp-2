"use client";

import * as React from "react";
import { useUser } from "@/lib/contexts/user-context";
import {
  Bookmark,
  Plus,
  Star,
  Trash2,
  Edit2,
  Loader2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SavedView {
  view_id: number;
  module: string;
  view_name: string;
  filter_json: Record<string, unknown>;
  is_default: boolean;
  created_by: string;
  created_at: string;
}

interface SavedViewsProps {
  module: string;
  currentFilters: Record<string, unknown>;
  onApplyView: (filters: Record<string, unknown>) => void;
}

export function SavedViews({ module, currentFilters, onApplyView }: SavedViewsProps) {
  const { user } = useUser();
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState("");
  const [editingView, setEditingView] = React.useState<SavedView | null>(null);
  const [editName, setEditName] = React.useState("");

  // Fetch saved views
  const fetchViews = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/saved-views?module=${module}`);
      const data = await response.json();
      if (data.data) {
        setViews(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch saved views:", err);
    } finally {
      setLoading(false);
    }
  }, [module]);

  React.useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  // Create new view
  const handleCreate = async () => {
    if (!newViewName.trim()) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          view_name: newViewName,
          filter_json: currentFilters,
        }),
      });
      
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNewViewName("");
        setShowCreateModal(false);
        fetchViews();
      }
    } catch (err) {
      setError("Failed to save view");
    } finally {
      setSaving(false);
    }
  };

  // Update view name
  const handleUpdate = async (view: SavedView) => {
    if (!editName.trim()) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/saved-views/${view.view_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view_name: editName }),
      });
      
      if (response.ok) {
        setEditingView(null);
        fetchViews();
      }
    } catch (err) {
      console.error("Failed to update view:", err);
    } finally {
      setSaving(false);
    }
  };

  // Set as default
  const handleSetDefault = async (view: SavedView) => {
    try {
      await fetch(`/api/saved-views/${view.view_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      fetchViews();
    } catch (err) {
      console.error("Failed to set default:", err);
    }
  };

  // Delete view
  const handleDelete = async (view: SavedView) => {
    if (!confirm(`Delete view "${view.view_name}"?`)) return;
    
    try {
      await fetch(`/api/saved-views/${view.view_id}`, {
        method: "DELETE",
      });
      fetchViews();
    } catch (err) {
      console.error("Failed to delete view:", err);
    }
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <div className="flex items-center gap-2">
        <div className="relative group">
          <button className="btn-outline inline-flex items-center gap-2 text-sm">
            <Bookmark className="h-4 w-4" />
            Saved Views
          </button>
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-[14px] shadow-lg z-50 hidden group-hover:block hover:block">
            <div className="p-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : views.length > 0 ? (
                <div className="space-y-1">
                  {views.map((view) => (
                    <div
                      key={view.view_id}
                      className="flex items-center gap-2 p-2 rounded-[10px] hover:bg-muted group/item"
                    >
                      {editingView?.view_id === view.view_id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="input text-sm flex-1 py-1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdate(view)}
                            className="p-1 text-success hover:bg-success/10 rounded"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setEditingView(null)}
                            className="p-1 text-muted-foreground hover:bg-muted rounded"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => onApplyView(view.filter_json)}
                            className="flex-1 text-left text-sm text-foreground truncate"
                          >
                            {view.view_name}
                          </button>
                          {view.is_default && (
                            <Star className="h-3 w-3 text-warning fill-warning" />
                          )}
                          <div className="hidden group-hover/item:flex items-center gap-1">
                            {!view.is_default && (
                              <button
                                onClick={() => handleSetDefault(view)}
                                className="p-1 text-muted-foreground hover:text-warning"
                                title="Set as default"
                              >
                                <Star className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingView(view);
                                setEditName(view.view_name);
                              }}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(view)}
                              className="p-1 text-muted-foreground hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No saved views
                </p>
              )}
              
              <div className="border-t border-border mt-2 pt-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center gap-2 p-2 text-sm text-primary hover:bg-primary/10 rounded-[10px]"
                >
                  <Plus className="h-4 w-4" />
                  Save Current View
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-[16px] p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Save Current View
            </h3>
            
            {error && (
              <div className="mb-4 p-3 rounded-[10px] bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="View name..."
              className="input w-full mb-4"
              autoFocus
            />
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewViewName("");
                  setError(null);
                }}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newViewName.trim() || saving}
                className="btn-primary"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SavedViews;
