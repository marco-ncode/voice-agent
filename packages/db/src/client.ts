import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

let cachedClient: SupabaseClient | null = null;

/**
 * Service-role client for server-side use (apps/api). Bypasses RLS, so all
 * tenant scoping (organization_id filters) must be applied explicitly by
 * callers — never expose this client to untrusted code paths.
 */
export function createServiceClient(config: SupabaseConfig): SupabaseClient {
  cachedClient ??= createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
