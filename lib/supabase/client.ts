/**
 * Supabase Browser Client
 * 
 * Use this client for:
 * - Client Components (use client)
 * - Direct reads with RLS
 * 
 * DO NOT use for mutations - use Route Handlers instead
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
