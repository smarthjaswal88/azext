/**
 * Server-only Supabase access.
 *
 * The service-role key bypasses row-level security, so it must never reach the
 * browser. Nothing in this file is importable from a client component: it reads
 * process.env at call time and is only used from route handlers and server
 * components.
 *
 * When the environment is not configured we say so. We never fall back to
 * in-memory storage — an order that silently vanishes on restart is worse than
 * an order that was honestly refused.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export function readSupabaseConfig(): SupabaseConfig | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return undefined;
  return { url, serviceRoleKey };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig() !== undefined;
}

/** Which variables are missing, for an honest message in the UI. Names only —
 *  never values. */
export function missingSupabaseVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

let cached: SupabaseClient | undefined;

/** Returns undefined rather than throwing when unconfigured, so callers are
 *  forced to handle the case explicitly. */
export function getServiceClient(): SupabaseClient | undefined {
  const config = readSupabaseConfig();
  if (!config) return undefined;
  if (!cached) {
    cached = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
