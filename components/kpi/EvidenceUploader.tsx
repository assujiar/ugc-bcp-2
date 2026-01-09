"use client";

import * as React from "react";
import {
  Upload,
  X,
  FileText,
  Image,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

interface EvidenceUploaderProps {
  metricKey: string;
  targetId?: number;
  existingFiles?: UploadedFile[];
  onUploadComplete?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
}

export function EvidenceUploader({
  metricKey,
  targetId,
  existingFiles = [],
  onUploadComplete,
  maxFiles = 5,
  acceptedTypes = ["image/*", "application/pdf", ".xlsx", ".xls", ".csv", ".doc", ".docx"],
}: EvidenceUploaderProps) {
  const [files, setFiles] = React.useState<UploadedFile[]>(existingFiles);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(selectedFiles);
  };

  const handleFiles = async (newFiles: File[]) => {
    if (files.length + newFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (const file of newFiles) {
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError(`File ${file.name} exceeds 10MB limit`);
          continue;
        }

        // Create form data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("metric_key", metricKey);
        if (targetId) formData.append("target_id", targetId.toString());

        // Upload to API
        const response = await fetch("/api/kpi/evidence", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }

        uploadedFiles.push({
          id: data.id || Date.now().toString(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: data.url || URL.createObjectURL(file),
          uploadedAt: new Date().toISOString(),
        });
      }

      const updatedFiles = [...files, ...uploadedFiles];
      setFiles(updatedFiles);
      onUploadComplete?.(updatedFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (fileId: string) => {
    try {
      // Call API to delete
      await fetch(`/api/kpi/evidence/${fileId}`, {
        method: "DELETE",
      });

      const updatedFiles = files.filter((f) => f.id !== fileId);
      setFiles(updatedFiles);
      onUploadComplete?.(updatedFiles);
    } catch (err) {
      setError("Failed to remove file");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return <Image className="h-5 w-5 text-primary" />;
    }
    return <FileText className="h-5 w-5 text-secondary" />;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-[14px] p-6 text-center cursor-pointer transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={handleChange}
          className="hidden"
        />
        
        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground mb-1">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              Supported: Images, PDF, Excel, Word (max {maxFiles} files, 10MB each)
            </p>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[10px] bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-destructive/10 rounded"
          >
            <X className="h-4 w-4 text-destructive" />
          </button>
        </div>
      )}

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Uploaded Files ({files.length}/{maxFiles})
          </p>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-[10px] bg-muted/50 border border-border"
            >
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-[8px] hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </a>
                <button
                  onClick={() => handleRemove(file.id)}
                  className="p-2 rounded-[8px] hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simplified Evidence Display component
interface EvidenceDisplayProps {
  files: UploadedFile[];
}

export function EvidenceDisplay({ files }: EvidenceDisplayProps) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No evidence uploaded</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file) => (
        <a
          key={file.id}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-muted hover:bg-muted/80 text-sm text-foreground transition-colors"
        >
          {file.type.startsWith("image/") ? (
            <Image className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-secondary" />
          )}
          <span className="truncate max-w-[150px]">{file.name}</span>
        </a>
      ))}
    </div>
  );
}
