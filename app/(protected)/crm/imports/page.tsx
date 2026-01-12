"use client";

import { useUser } from "@/lib/contexts/user-context";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";

export default function CRMImportsPage() {
  const { user, isSuperAdmin } = useUser();
  
  // Only sales support and super admin can access imports
  const canImport = isSuperAdmin || user?.role_name === "sales support";

  if (!canImport) {
    return (
      <div className="card">
        <div className="h-64 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-16 w-16 text-destructive/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
          <p className="text-muted-foreground max-w-md">
            You don&apos;t have permission to access the import center. 
            This feature is available for Sales Support and Super Admin only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM - Import Center</h1>
          <p className="text-muted-foreground">Bulk import leads and customer data</p>
        </div>
      </div>

      {/* Upload Card */}
      <div className="card mb-6">
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
          <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Upload File</h3>
          <p className="text-muted-foreground mb-4">
            Drag and drop your CSV or Excel file here, or click to browse
          </p>
          <button className="btn-primary">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Select File
          </button>
          <p className="text-xs text-muted-foreground mt-4">
            Supported formats: .csv, .xlsx, .xls (max 10MB)
          </p>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="card">
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Import History</h3>
          <p className="text-muted-foreground max-w-md">
            Import functionality will be implemented in STEP 8. 
            This page will show import history, validation results, 
            and error tracking.
          </p>
        </div>
      </div>
    </>
  );
}

