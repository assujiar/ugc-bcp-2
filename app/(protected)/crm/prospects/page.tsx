"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Prospects Redirect Page
 *
 * This page redirects to /crm/pipeline since the old prospects table
 * has been deprecated in favor of the new opportunities/pipeline system.
 *
 * Per the CRM Target-State Architecture:
 * - "Prospects" are now managed as "Opportunities" in the Pipeline
 * - Prospecting Targets are a separate entity for pre-lead records
 * - This page avoids confusion between old and new terminology
 */
export default function ProspectsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to /crm/pipeline - the new home for sales opportunities
    router.replace("/crm/pipeline");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Pipeline...</p>
        <p className="text-sm text-muted-foreground mt-2">
          Prospects are now managed as Opportunities
        </p>
      </div>
    </div>
  );
}
