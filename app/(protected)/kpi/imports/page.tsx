"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/lib/contexts/user-context";
import { fetchImports, processImport, ImportRecord, PaginatedResponse } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Upload,
  FileSpreadsheet,
  Clock,
  XCircle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function KpiImportsPage() {
  const { user, isMarketing } = useUser();
  
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [imports, setImports] = React.useState<ImportRecord[]>([]);
  
  // Upload state
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [importType, setImportType] = React.useState("marketing_spend");

  const canImport = isMarketing || user?.role_name === "super admin";

  // Load import history
  React.useEffect(() => {
    async function loadImports() {
      setLoading(true);
      const result = await fetchImports({ module: "kpi", pageSize: 20 });
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setImports((result.data as PaginatedResponse<ImportRecord>).data || []);
      }
      setLoading(false);
    }
    loadImports();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith(".csv") && !file.name.endsWith(".xlsx")) {
        setUploadError("Please upload a CSV or Excel file");
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // Read file content
      const text = await selectedFile.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        setUploadError("File is empty or has no data rows");
        setUploading(false);
        return;
      }

      // Parse CSV
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const rows: Record<string, unknown>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        const row: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || "";
        });
        rows.push(row);
      }

      // Process import
      const result = await processImport(importType, selectedFile.name, rows);

      if (result.error) {
        setUploadError(result.error);
      } else if (result.data) {
        const { success_rows, error_rows } = result.data;
        setUploadSuccess(`Import completed: ${success_rows} rows successful, ${error_rows} rows failed`);
        setSelectedFile(null);
        
        // Refresh import list
        const refreshResult = await fetchImports({ module: "kpi", pageSize: 20 });
        if (refreshResult.data) {
          setImports((refreshResult.data as PaginatedResponse<ImportRecord>).data || []);
        }
      }
    } catch (err) {
      setUploadError("Failed to process file");
    }

    setUploading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "PROCESSING":
        return <Clock className="h-4 w-4 text-warning animate-spin" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!canImport) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-warning mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only marketing users can import KPI data</p>
        <Link href="/kpi" className="btn-primary mt-4">
          Back to KPI
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/kpi"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to KPI
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Bulk Import</h1>
        <p className="text-muted-foreground">Import KPI data from CSV or Excel files</p>
      </div>

      {/* Upload Section */}
      <div className="card mb-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-muted-foreground" />
          Upload Data
        </h3>

        {uploadError && (
          <div className="mb-4 p-3 rounded-[10px] bg-destructive/10 border border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{uploadError}</p>
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-4 p-3 rounded-[10px] bg-success/10 border border-success/20 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <p className="text-sm text-success">{uploadSuccess}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Import Type
            </label>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value)}
              className="input w-full"
            >
              <option value="marketing_spend">Marketing Spend</option>
              <option value="marketing_activity">Marketing Activities</option>
              <option value="dgo_metrics">DGO Metrics (Reach/Engagement)</option>
              <option value="vsdo_metrics">VSDO Metrics (TAT/Delivery)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Select File
            </label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="input w-full"
            />
          </div>
        </div>

        {selectedFile && (
          <div className="p-3 rounded-[10px] bg-muted mb-4 flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <a
            href="#"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Download Template
          </a>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="btn-primary"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Process
              </>
            )}
          </button>
        </div>
      </div>

      {/* Import History */}
      <div className="card">
        <h3 className="font-semibold text-foreground mb-4">Import History</h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : imports.length > 0 ? (
          <div className="space-y-3">
            {imports.map((imp) => (
              <div
                key={imp.import_id}
                className="flex items-center justify-between p-3 rounded-[10px] bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(imp.status)}
                  <div>
                    <p className="text-sm font-medium text-foreground">{imp.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(imp.uploaded_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-foreground">
                    {imp.success_rows || 0} / {imp.total_rows || 0} rows
                  </p>
                  <p className={cn(
                    "text-xs",
                    imp.status === "COMPLETED" ? "text-success" :
                    imp.status === "FAILED" ? "text-destructive" :
                    "text-muted-foreground"
                  )}>
                    {imp.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No import history found
          </p>
        )}
      </div>
    </>
  );
}
