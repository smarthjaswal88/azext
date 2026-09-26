/**
 * Operator command for the Bright Data -> Supabase catalog import.
 *
 * Talks to the running app's protected route (/api/admin/catalog/import),
 * never to Bright Data directly, so the Bright Data token stays inside the
 * server process.
 *
 *   npm run dev                                                   # in one terminal
 *   npm run catalog:fields                                        # free schema check; no collection
 *   npm run catalog:preview [-- --authorize-additional-paid-run <id>]  # no external request
 *   npm run catalog:import -- --confirm IMPORT_MAX_24_PRODUCTS    # the one paid request
 *       [--authorize-additional-paid-run <earlier-run-id>]        # only after a run that was, or may
 *                                                                 # have been, accepted by Bright Data
 *   npm run catalog:resume -- <run-id> [--reimport] [--snapshot <id>]
 *
 * catalog:import prints the preview — the exact endpoint, payload, limits and
 * assumptions — before it sends anything, and sends nothing without --confirm.
 * The server then re-checks every requested field against the dataset's
 * metadata (free) and refuses to send the paid request if one is missing.
 * After an earlier run that Bright Data accepted or may have accepted, a new
 * paid request also needs --authorize-additional-paid-run naming that run.
 * It then keeps checking the collection until it is imported. catalog:resume
 * only reads an existing snapshot; it never starts another collection.
 *
 * CATALOG_IMPORT_SECRET must be set in .env.local, where the dev server reads
 * it too. It is sent only as a request header to that server and never printed.
 */

import { existsSync, readFileSync } from "node:fs";

const CONFIRMATION = "IMPORT_MAX_24_PRODUCTS";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 80; // 20 minutes

// Next loads .env itself; a standalone script has to. Only the two variables
// this script uses are read.
const WANTED = new Set(["CATALOG_IMPORT_SECRET", "CATALOG_IMPORT_BASE_URL"]);
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    const key = k.trim();
    if (!WANTED.has(key)) continue;
    const v = rest.join("=").trim().replace(/^["']|["']$/g, "");
    if (v && !process.env[key]) process.env[key] = v;
  }
}

const BASE = process.env.CATALOG_IMPORT_BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE}/api/admin/catalog/import`;
const SECRET = process.env.CATALOG_IMPORT_SECRET?.trim();

function exit(message, code = 1) {
  console.error(message);
  process.exit(code);
}

if (!SECRET || SECRET.length < 32) {
  exit(
    "CATALOG_IMPORT_SECRET is missing or shorter than 32 characters. Add it to .env.local, " +
      "then restart `npm run dev` so the server reads it too.",
  );
}

async function call(body) {
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    exit(`Could not reach ${ENDPOINT}. Is \`npm run dev\` running?`);
  }
  const payload = await response.json().catch(() => ({ error: "non_json_response" }));
  if (response.status === 404 && payload.error === "not_found") {
    exit(
      "The import route is disabled. The dev server needs CATALOG_IMPORT_SECRET (32+ characters) — restart it after adding the variable.",
    );
  }
  return { status: response.status, payload };
}

function print(title, result) {
  console.log(`\n== ${title} (HTTP ${result.status})`);
  console.log(JSON.stringify(result.payload, null, 2));
}

function flag(args, name) {
  return args.includes(name);
}

function option(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function pollResume(runId, extra) {
  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    const result = await call({ action: "resume", runId, ...extra });
    if (result.status !== 202) {
      print("Import result", result);
      process.exit(result.status < 300 ? 0 : 1);
    }
    const state = result.payload.brightDataStatus ?? "collecting";
    console.log(`… Bright Data status: ${state}. Checking again in ${POLL_INTERVAL_MS / 1000}s.`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  exit(`Still collecting after 20 minutes. Continue later with: npm run catalog:resume -- ${runId}`);
}

const [command, ...args] = process.argv.slice(2);

if (command === "fields") {
  // One free read of the dataset's schema. Starts no collection.
  const result = await call({ action: "fields" });
  print("Dataset fields — no collection started", result);
  process.exit(result.status === 200 && result.payload.allRequestedFieldsConfirmed ? 0 : 1);
}

if (command === "preview") {
  const authorizeRunId = option(args, "--authorize-additional-paid-run");
  if (flag(args, "--authorize-additional-paid-run") && !UUID.test(authorizeRunId ?? "")) {
    exit("--authorize-additional-paid-run needs the id of the earlier run it supersedes.");
  }
  const result = await call({ action: "preview", ...(authorizeRunId ? { authorizeAdditionalPaidRun: authorizeRunId } : {}) });
  print("Preview — nothing has been sent to Bright Data", result);
  process.exit(result.payload.readyToStart ? 0 : 1);
}

if (command === "start") {
  const authorizeRunId = option(args, "--authorize-additional-paid-run");
  if (flag(args, "--authorize-additional-paid-run") && !UUID.test(authorizeRunId ?? "")) {
    exit("--authorize-additional-paid-run needs the id of the earlier run it supersedes. Nothing was sent.");
  }
  const authorization = authorizeRunId ? { authorizeAdditionalPaidRun: authorizeRunId } : {};

  // Always show exactly what will be sent before sending it.
  const preview = await call({ action: "preview", ...authorization });
  print("Preview — nothing has been sent to Bright Data yet", preview);

  if (!preview.payload.readyToStart) exit("\nNot ready to start; see blockers above. Nothing was sent.");
  if (option(args, "--confirm") !== CONFIRMATION) {
    exit(`\nNothing was sent. To make the paid request above, run:\n  ${preview.payload.startWith}`);
  }

  const started = await call({ action: "start", confirm: CONFIRMATION, ...authorization });
  print("Start", started);
  if (started.status !== 202) process.exit(1);
  await pollResume(started.payload.runId, {});
}

if (command === "resume") {
  const runId = args.find((arg) => UUID.test(arg));
  if (!runId) exit("Usage: npm run catalog:resume -- <run-id> [--reimport] [--snapshot <id>]");
  const extra = {};
  if (flag(args, "--reimport")) extra.reimport = true;
  const snapshotId = option(args, "--snapshot");
  if (snapshotId) extra.snapshotId = snapshotId;
  await pollResume(runId, extra);
}

exit(
  "Usage: node scripts/catalog-import.mjs fields | preview | start --confirm " + CONFIRMATION +
    " [--authorize-additional-paid-run <run-id>] | resume <run-id> [--reimport] [--snapshot <id>]",
);
