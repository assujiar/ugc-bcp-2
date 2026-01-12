"use client";

import * as React from "react";
import { useUser } from "@/lib/contexts/user-context";
import {
  FileText,
  Search,
  Filter,
  Loader2,
  Shield,
  Calendar,
  User,
  Database,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: number;
  table_name: string;
  record_id: string | null;
  action: string;
  changed_by: string;
  changed_at: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  changer?: {
    full_name: string;
    role_name: string;
  };
}

const ACTION_BADGES: Record<string, string> = {
  INSERT: "badge-success",
  UPDATE: "badge-warning",
  DELETE: "badge-destructive",
};

export default function AuditLogsPage() {
  const { user } = useUser();
  const [loading, setLoading] = React.useState(true);
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [search, setSearch] = React.useState("");
  const [tableFilter, setTableFilter] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

  const isSuperAdmin = user?.role_name === "super admin";

  // Load audit logs
  React.useEffect(() => {
    async function loadLogs() {
      if (!isSuperAdmin) return;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("page", page.toString());
        params.append("pageSize", "50");
        if (tableFilter) params.append("table_name", tableFilter);
        if (actionFilter) params.append("action", actionFilter);
        if (search) params.append("search", search);

        const response = await fetch(`/api/audit-logs?${params.toString()}`);
        const data = await response.json();
        if (data.data) {
          setLogs(data.data);
          setHasMore(data.data.length === 50);
        }
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [isSuperAdmin, page, tableFilter, actionFilter, search]);

  // Get unique tables from logs
  const tables = React.useMemo(() => {
    const uniqueTables = new Set(logs.map((l) => l.table_name));
    return Array.from(uniqueTables).sort();
  }, [logs]);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground">
          Only Super Admin can view audit logs.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground">Track all system changes and user activities</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by record ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input w-full pl-10"
            />
          </div>
          <select
            value={tableFilter}
            onChange={(e) => {
              setTableFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full sm:w-48"
          >
            <option value="">All Tables</option>
            {tables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full sm:w-40"
          >
            <option value="">All Actions</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{logs.length}</p>
              <p className="text-xs text-muted-foreground">Total Logs</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-success/10">
              <Database className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {logs.filter((l) => l.action === "INSERT").length}
              </p>
              <p className="text-xs text-muted-foreground">Inserts</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-warning/10">
              <Database className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {logs.filter((l) => l.action === "UPDATE").length}
              </p>
              <p className="text-xs text-muted-foreground">Updates</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-destructive/10">
              <Database className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {logs.filter((l) => l.action === "DELETE").length}
              </p>
              <p className="text-xs text-muted-foreground">Deletes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-10"></th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Timestamp
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Table
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Action
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Record
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    User
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className={cn(
                        "border-b border-border/50 hover:bg-muted/30 cursor-pointer",
                        expandedId === log.id && "bg-muted/50"
                      )}
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="py-3 px-4">
                        {expandedId === log.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">
                            {new Date(log.changed_at).toLocaleString("id-ID")}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono text-muted-foreground">
                          {log.table_name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn("badge", ACTION_BADGES[log.action] || "badge")}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono text-foreground">
                          {log.record_id || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">
                            {log.changer?.full_name || log.changed_by.slice(0, 8) + "..."}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr className="bg-muted/30">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {log.before_data && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  Before
                                </p>
                                <pre className="text-xs bg-card p-3 rounded-[10px] overflow-x-auto">
                                  {JSON.stringify(log.before_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.after_data && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  After
                                </p>
                                <pre className="text-xs bg-card p-3 rounded-[10px] overflow-x-auto">
                                  {JSON.stringify(log.after_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          {(log.ip_address || log.user_agent) && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <p className="text-xs text-muted-foreground">
                                {log.ip_address && `IP: ${log.ip_address}`}
                                {log.ip_address && log.user_agent && " • "}
                                {log.user_agent && `UA: ${log.user_agent.slice(0, 50)}...`}
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No audit logs found</p>
          </div>
        )}

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-outline text-sm"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="btn-outline text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
