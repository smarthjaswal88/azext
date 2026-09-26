/**
 * Typed client for the three Bright Data calls the import makes.
 *
 * Server only: the API token is read from process.env at call time and is
 * never logged, returned or included in an error. Upstream error bodies are
 * logged server-side only, truncated and with the token redacted, and never
 * reach an API response.
 */

import { BRIGHT_DATA_API_BASE, buildTriggerRequest, datasetMetadataUrl } from "./config";

export type BrightDataErrorCode =
  | "token_missing"
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "not_found"
  | "snapshot_expired"
  | "rate_limited"
  | "server_error"
  | "network_error"
  | "timeout"
  | "invalid_response";

/**
 * Whether Bright Data may have accepted a trigger request despite the error.
 * "no" only when Bright Data answered with a 4xx refusal; anything else
 * (timeouts, network failures, 5xx, an unreadable success) may have started a
 * billed collection and is treated that way.
 */
export type AcceptanceState = "no" | "unknown";

export class BrightDataError extends Error {
  constructor(
    readonly code: BrightDataErrorCode,
    readonly httpStatus: number | undefined,
    readonly accepted: AcceptanceState,
  ) {
    super(`Bright Data request failed: ${code}${httpStatus ? ` (HTTP ${httpStatus})` : ""}`);
    this.name = "BrightDataError";
  }
}

export type SnapshotStatus = "starting" | "running" | "ready" | "failed" | "canceled" | "unknown";

const SNAPSHOT_ID = /^[A-Za-z0-9_-]{1,100}$/;
/** Twenty-four records are well under a megabyte; anything near this is wrong. */
const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024;

export function hasBrightDataToken(): boolean {
  return Boolean(process.env.BRIGHT_DATA_API_TOKEN?.trim());
}

function readToken(): string {
  const token = process.env.BRIGHT_DATA_API_TOKEN?.trim();
  if (!token) throw new BrightDataError("token_missing", undefined, "no");
  return token;
}

export function isSnapshotId(value: unknown): value is string {
  return typeof value === "string" && SNAPSHOT_ID.test(value);
}

function codeForStatus(status: number): BrightDataErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "bad_request";
}

function redact(text: string, token: string): string {
  return text
    .split(token)
    .join("[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
}

/** Names the failing call and status in the server log. The body is kept to
 *  a short, token-redacted excerpt so a rejected parameter can be diagnosed. */
async function logFailure(context: string, response: Response, token: string): Promise<void> {
  let detail = "";
  try {
    detail = redact((await response.text()).slice(0, 300), token).replace(/\s+/g, " ").trim();
  } catch {
    // The status alone is enough to act on.
  }
  console.warn(
    `[bright-data] ${context} failed with HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
  );
}

async function send(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new BrightDataError(timedOut ? "timeout" : "network_error", undefined, "unknown");
  }
}

/**
 * Starts the keyword discovery collection. This is the only paid call.
 * Returns the snapshot id Bright Data assigns to the collection.
 */
export async function triggerKeywordDiscovery(datasetId: string): Promise<{ snapshotId: string }> {
  const token = readToken();
  const request = buildTriggerRequest(datasetId);

  const response = await send(
    request.url,
    {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    },
    30_000,
  );

  if (!response.ok) {
    await logFailure("trigger", response, token);
    // A 4xx is Bright Data refusing the request, so nothing was collected. A
    // 408 or a 5xx may have been sent after the job was created.
    const refused = response.status >= 400 && response.status < 500 && response.status !== 408;
    throw new BrightDataError(codeForStatus(response.status), response.status, refused ? "no" : "unknown");
  }

  const data = (await response.json().catch(() => undefined)) as { snapshot_id?: unknown } | undefined;
  if (!isSnapshotId(data?.snapshot_id)) {
    throw new BrightDataError("invalid_response", response.status, "unknown");
  }
  return { snapshotId: data.snapshot_id };
}

export async function getSnapshotStatus(snapshotId: string): Promise<SnapshotStatus> {
  if (!isSnapshotId(snapshotId)) throw new BrightDataError("bad_request", undefined, "no");
  const token = readToken();

  const response = await send(
    `${BRIGHT_DATA_API_BASE}/progress/${snapshotId}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    20_000,
  );
  if (!response.ok) {
    await logFailure("progress", response, token);
    throw new BrightDataError(codeForStatus(response.status), response.status, "no");
  }

  const data = (await response.json().catch(() => undefined)) as { status?: unknown } | undefined;
  const status = typeof data?.status === "string" ? data.status.toLowerCase() : "";
  return (["starting", "running", "ready", "failed", "canceled"] as const).find((s) => s === status) ?? "unknown";
}

export interface DatasetField {
  name: string;
  type: string | null;
  /** As reported; null when the metadata does not say. */
  active: boolean | null;
}

const DATASET_ID = /^gd_[a-z0-9]{1,40}$/;

/**
 * The dataset's output schema, from the metadata endpoint. A read of the
 * schema only: it starts no collection and delivers no records.
 */
export async function fetchDatasetFields(datasetId: string): Promise<DatasetField[]> {
  if (!DATASET_ID.test(datasetId)) throw new BrightDataError("bad_request", undefined, "no");
  const token = readToken();

  const response = await send(
    datasetMetadataUrl(datasetId),
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    20_000,
  );
  if (!response.ok) {
    await logFailure("metadata", response, token);
    throw new BrightDataError(codeForStatus(response.status), response.status, "no");
  }

  const data = (await response.json().catch(() => undefined)) as { fields?: unknown } | undefined;
  const fields = data?.fields;
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    throw new BrightDataError("invalid_response", response.status, "no");
  }

  return Object.entries(fields as Record<string, unknown>)
    .filter(([name]) => /^[A-Za-z0-9_.]{1,100}$/.test(name))
    .map(([name, definition]) => {
      const field = (definition ?? {}) as { type?: unknown; active?: unknown };
      return {
        name,
        type: typeof field.type === "string" ? field.type : null,
        active: typeof field.active === "boolean" ? field.active : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type SnapshotDownload = { ready: true; records: unknown[] } | { ready: false };

/** Downloads a ready snapshot as a JSON array. The records are returned to
 *  the caller for normalization and are never stored or logged as received. */
export async function downloadSnapshot(snapshotId: string): Promise<SnapshotDownload> {
  if (!isSnapshotId(snapshotId)) throw new BrightDataError("bad_request", undefined, "no");
  const token = readToken();

  const response = await send(
    `${BRIGHT_DATA_API_BASE}/snapshot/${snapshotId}?format=json`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    60_000,
  );

  // 202: still building. 409: not ready for download yet.
  if (response.status === 202 || response.status === 409) return { ready: false };

  if (!response.ok) {
    await logFailure("snapshot download", response, token);
    const code = response.status === 400 ? "snapshot_expired" : codeForStatus(response.status);
    throw new BrightDataError(code, response.status, "no");
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_SNAPSHOT_BYTES) throw new BrightDataError("invalid_response", response.status, "no");

  const text = await response.text();
  if (text.length > MAX_SNAPSHOT_BYTES) throw new BrightDataError("invalid_response", response.status, "no");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BrightDataError("invalid_response", response.status, "no");
  }
  if (!Array.isArray(parsed)) throw new BrightDataError("invalid_response", response.status, "no");
  return { ready: true, records: parsed };
}
