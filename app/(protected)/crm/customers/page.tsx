"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CustomersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to /crm/accounts since customers table was renamed to accounts
    router.replace("/crm/accounts");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Accounts...</p>
      </div>
    </div>
  );
}
