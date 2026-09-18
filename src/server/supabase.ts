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

/** The secret key, under either accepted name. */
function readSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

/**
 * Catches the mistake that would otherwise be silent: a publishable key in the
 * secret slot. It is a valid key, so `createClient` succeeds and requests go
 * through — but it does not bypass RLS, and since the orders tables have no
 * policies every read returns nothing and every write is refused. That looks
 * like "the order vanished" rather than "the wrong key". Better to refuse to
 * start.
 */
export function secretKeyProblem(): string | undefined {
  const key = readSecretKey();
  if (!key) return undefined;
  if (key.startsWith("sb_publishable_")) {
    return "a publishable key was supplied where the secret key is required";
  }
  return undefined;
}

export function readSupabaseConfig(): SupabaseConfig | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = readSecretKey();
  if (!url || !serviceRoleKey) return undefined;
  if (secretKeyProblem()) return undefined;
  return { url, serviceRoleKey };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig() !== undefined;
}

/** Which variables are missing. Names only, never values. This is for **server
 *  diagnostics** — the operator's logs and the README. It is deliberately not
 *  shown to shoppers, who cannot act on it and should not be reading our
 *  deployment configuration off a checkout page. */
export function missingSupabaseVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!readSecretKey()) missing.push("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  return missing;
}

let warned = false;

/** Logs once per process, server-side, so an operator can see why checkout is
 *  disabled without the reason appearing in the UI. */
export function warnIfUnconfigured(): void {
  if (warned || isSupabaseConfigured()) return;
  warned = true;

  const problem = secretKeyProblem();
  if (problem) {
    // Names and shapes only. No key value is ever logged.
    console.warn(
      `[orders] Supabase key rejected — ${problem}. Set SUPABASE_SECRET_KEY to a value ` +
        "beginning sb_secret_ (or a legacy service_role JWT). Checkout is disabled.",
    );
    return;
  }

  console.warn(
    `[orders] Supabase is not configured — checkout is disabled. Missing: ${missingSupabaseVars().join(", ")}. ` +
      "See \"Supabase setup\" in README.md and apply supabase/migrations/.",
  );
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
