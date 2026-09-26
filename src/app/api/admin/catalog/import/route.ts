import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { describeOutputFields, previewImport, resumeImport, startImport } from "@/server/catalog-import";

/**
 * Operator-only catalog import. Not linked from anywhere in the app.
 *
 * Disabled — it answers 404 — unless CATALOG_IMPORT_SECRET is set to at least
 * 32 characters, and in a production build unless CATALOG_IMPORT_ALLOW_PRODUCTION
 * is "true" as well, so a deployment without those variables has no import
 * endpoint at all. Every request must carry `Authorization: Bearer <secret>`.
 *
 * Body: {"action": "fields"}      free schema check against the dataset metadata
 *       {"action": "preview"}
 *       {"action": "start", "confirm": "IMPORT_MAX_24_PRODUCTS",
 *        "authorizeAdditionalPaidRun"?: "<id of the earlier paid or unknown run>"}
 *       {"action": "resume", "runId": "<uuid>", "reimport"?: true, "snapshotId"?: "<id>"}
 *
 * Run it with scripts/catalog-import.mjs (npm run catalog:preview, etc.).
 */

export const maxDuration = 60;

const NO_STORE = { "cache-control": "no-store" };
const MAX_BODY_CHARS = 2_000;

function importSecret(): string | undefined {
  const secret = process.env.CATALOG_IMPORT_SECRET?.trim();
  if (!secret || secret.length < 32) return undefined;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CATALOG_IMPORT_ALLOW_PRODUCTION !== "true"
  ) {
    return undefined;
  }
  return secret;
}

/** Constant-time comparison of digests, so neither length nor content leaks
 *  through timing. */
function authorized(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const given = createHash("sha256").update(header.slice("Bearer ".length).trim()).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const secret = importSecret();
  if (!secret) return json(404, { error: "not_found" });
  if (!authorized(request.headers.get("authorization"), secret)) {
    return json(401, { error: "unauthorized" });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return json(413, { error: "body_too_large" });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  try {
    const outcome =
      body.action === "fields"
        ? await describeOutputFields()
        : body.action === "preview"
        ? await previewImport({ authorizeAdditionalPaidRun: body.authorizeAdditionalPaidRun })
        : body.action === "start"
          ? await startImport({
              confirm: body.confirm,
              authorizeAdditionalPaidRun: body.authorizeAdditionalPaidRun,
            })
          : body.action === "resume"
            ? await resumeImport({
                runId: body.runId,
                reimport: body.reimport,
                snapshotId: body.snapshotId,
              })
            : undefined;

    if (!outcome) {
      return json(400, { error: "invalid_action", message: 'action must be "fields", "preview", "start" or "resume".' });
    }
    return json(outcome.httpStatus, outcome.body);
  } catch (cause) {
    // The detail goes to the server log only, with every configured secret
    // redacted; the response carries our own message.
    console.error(`[catalog-import] unexpected failure: ${describeForLog(cause)}`);
    return json(500, { error: "import_failed", message: "The import failed unexpectedly. See the server log." });
  }
}

const SECRET_VARIABLES = [
  "BRIGHT_DATA_API_TOKEN",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CATALOG_IMPORT_SECRET",
  "DEEPSEEK_API_KEY",
];

function describeForLog(cause: unknown): string {
  const text =
    cause instanceof Error
      ? [`${cause.name}: ${cause.message}`, ...(cause.stack?.split("\n").slice(1, 4) ?? [])].join(" | ")
      : "non-error thrown";
  let redacted = text.slice(0, 600);
  for (const name of SECRET_VARIABLES) {
    const value = process.env[name]?.trim();
    if (value && value.length >= 8) redacted = redacted.split(value).join("[redacted]");
  }
  return redacted;
}
