"use client";

import * as React from "react";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  status: "uploading" | "success" | "error";
  error?: string;
}

interface EvidenceUploadProps {
  bucket: "kpi-evidence" | "prospect-evidence" | "ticket-attachments";
  entityId: string;
  entityType: string;
  onUploadComplete?: (files: { url: string; name: string }[]) => void;
  maxFiles?: number;
  accept?: string;
}

export function EvidenceUpload({
  bucket,
  entityId,
  entityType,
  onUploadComplete,
  maxFiles = 5,
  accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx",
}: EvidenceUploadProps) {
  const [files, setFiles] = React.useState<EvidenceFile[]>([]);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList) => {
    const newFiles = Array.from(fileList).slice(0, maxFiles - files.length);
    
    // Add files with uploading status
    const fileEntries: EvidenceFile[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "uploading" as const,
    }));

    setFiles((prev) => [...prev, ...fileEntries]);

    // Upload each file
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const fileEntry = fileEntries[i];

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", bucket);
        formData.append("entity_id", entityId);
        formData.append("entity_type", entityType);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (data.error) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileEntry.id
                ? { ...f, status: "error" as const, error: data.error }
                : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileEntry.id
                ? { ...f, status: "success" as const, url: data.url }
                : f
            )
          );
        }
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileEntry.id
              ? { ...f, status: "error" as const, error: "Upload failed" }
              : f
          )
        );
      }
    }

    // Notify parent of completed uploads
    if (onUploadComplete) {
      const successfulFiles = files
        .filter((f) => f.status === "success" && f.url)
        .map((f) => ({ url: f.url!, name: f.name }));
      onUploadComplete(successfulFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-[14px] p-6 text-center cursor-pointer transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">
          Drop files here or click to upload
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max {maxFiles} files • Images, PDF, Word, Excel
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-[12px] border",
                file.status === "error"
                  ? "bg-destructive/5 border-destructive/20"
                  : file.status === "success"
                  ? "bg-success/5 border-success/20"
                  : "bg-muted border-border"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0",
                  file.status === "error"
                    ? "text-destructive"
                    : file.status === "success"
                    ? "text-success"
                    : "text-muted-foreground"
                )}
              >
                {file.status === "uploading" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : file.status === "success" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : file.status === "error" ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  getFileIcon(file.type)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {file.status === "error"
                    ? file.error
                    : file.status === "uploading"
                    ? "Uploading..."
                    : formatSize(file.size)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {file.status === "success" && file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EvidenceUpload;
