import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { canonicalBytes, canonicalSerialize, sha256Hex } from "./canonical.ts";
import {
  COHORT_DIGEST,
  MAX_RESPONSE_BYTES,
  OSM_ATTRIBUTION,
  OSM_LICENSE_URL,
  OVERPASS_ENDPOINT,
  OVERPASS_QUERY,
  QUERY_DIGEST,
  SCHEMA_VERSION,
  SOURCE_POLICY_DIGEST,
  USER_AGENT,
  processDiscoveryFixture,
} from "./model.ts";

export interface NetworkPlan {
  readonly endpoint: typeof OVERPASS_ENDPOINT;
  readonly method: "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly timeoutMs: 30_000;
  readonly byteCap: typeof MAX_RESPONSE_BYTES;
  readonly signal: AbortSignal;
}

export interface StreamingResponse {
  readonly status: number;
  readonly url: string;
  readonly redirected: boolean;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: AsyncIterable<Uint8Array>;
  readonly cancel: () => void | Promise<void>;
}

export interface DiscoveryDependencies {
  readonly projectRoot: string;
  readonly transport: (plan: NetworkPlan) => Promise<StreamingResponse>;
  readonly now: () => number;
  readonly scheduleTimeout: (callback: () => void, milliseconds: number) => unknown;
  readonly clearScheduledTimeout: (handle: unknown) => void;
}

export type LiveDiscoveryResult =
  | Readonly<{
      ok: true;
      runId: string;
      outputPath: string;
      counts: Readonly<Record<string, number>>;
      hashes: Readonly<Record<string, string>>;
      sourceSufficiency: Readonly<Record<string, unknown>>;
    }>
  | Readonly<{ ok: false; reason: "LIVE_DISCOVERY_FAILED"; error: string }>;

const BASE_PLAN = Object.freeze({
  endpoint: OVERPASS_ENDPOINT,
  method: "POST" as const,
  headers: Object.freeze({
    Accept: "application/json",
    "Accept-Encoding": "identity",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": USER_AGENT,
  }),
  body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
  timeoutMs: 30_000 as const,
  byteCap: MAX_RESPONSE_BYTES,
});

function failed(error: string): LiveDiscoveryResult {
  return Object.freeze({ ok: false, reason: "LIVE_DISCOVERY_FAILED", error });
}

function exactContentType(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const [mediaType, ...parameters] = value.split(";").map((item) => item.trim().toLowerCase());
  return (
    mediaType === "application/json" &&
    parameters.every((parameter) => parameter === "" || parameter === "charset=utf-8")
  );
}

function parseContentLength(value: unknown): number | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

async function cancel(response: StreamingResponse): Promise<void> {
  try {
    await response.cancel();
  } catch {
    // Best effort after a terminal response failure.
  }
}

async function requestBytes(
  dependencies: DiscoveryDependencies,
  signal: AbortSignal,
): Promise<
  | Readonly<{ ok: true; bytes: Uint8Array; retrievedAt: string }>
  | Readonly<{ ok: false; error: string }>
> {
  let response: StreamingResponse;
  try {
    response = await dependencies.transport({ ...BASE_PLAN, signal });
  } catch {
    return Object.freeze({ ok: false, error: "NETWORK_ERROR" });
  }
  if (
    response.status !== 200 ||
    response.redirected ||
    response.url !== OVERPASS_ENDPOINT ||
    !exactContentType(response.headers["content-type"]) ||
    !["", "identity"].includes((response.headers["content-encoding"] ?? "").toLowerCase())
  ) {
    await cancel(response);
    return Object.freeze({ ok: false, error: "INVALID_RESPONSE_METADATA" });
  }
  const contentLength = parseContentLength(response.headers["content-length"]);
  if (
    (contentLength !== null && !Number.isFinite(contentLength)) ||
    (contentLength !== null && contentLength > MAX_RESPONSE_BYTES)
  ) {
    await cancel(response);
    return Object.freeze({ ok: false, error: "RESPONSE_BYTE_LIMIT" });
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of response.body) {
      if (!(chunk instanceof Uint8Array) || chunk.byteLength > MAX_RESPONSE_BYTES - total) {
        await cancel(response);
        return Object.freeze({ ok: false, error: "RESPONSE_BYTE_LIMIT" });
      }
      const copy = new Uint8Array(chunk);
      chunks.push(copy);
      total += copy.byteLength;
    }
  } catch {
    await cancel(response);
    return Object.freeze({ ok: false, error: "RESPONSE_STREAM_ERROR" });
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const milliseconds = dependencies.now();
  if (!Number.isFinite(milliseconds)) return Object.freeze({ ok: false, error: "CLOCK_ERROR" });
  return Object.freeze({
    ok: true,
    bytes,
    retrievedAt: new Date(milliseconds).toISOString(),
  });
}

function within(base: string, candidate: string): boolean {
  const path = relative(base, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

type ArtifactBundle = Readonly<{
  raw: Uint8Array;
  candidates: Uint8Array;
  report: Uint8Array;
  manifest: Uint8Array;
}>;

const ARTIFACT_FILES = Object.freeze([
  ["raw", "raw.json"],
  ["candidates", "candidates.json"],
  ["report", "report.json"],
  ["manifest", "manifest.json"],
] as const);

async function artifactsMatch(directory: string, artifacts: ArtifactBundle): Promise<boolean> {
  try {
    for (const [key, filename] of ARTIFACT_FILES) {
      if (sha256Hex(await readFile(join(directory, filename))) !== sha256Hex(artifacts[key])) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function publish(
  projectRoot: string,
  runId: string,
  artifacts: ArtifactBundle,
): Promise<string | null> {
  const root = resolve(projectRoot);
  const base = resolve(root, ".var", "pilot", "discovery");
  const final = resolve(base, runId);
  if (!within(root, base) || !within(base, final)) return null;
  await mkdir(base, { recursive: true });
  if (await artifactsMatch(final, artifacts)) return final;
  try {
    await stat(final);
    return null;
  } catch (error) {
    if ((error as { code?: unknown }).code !== "ENOENT") return null;
  }
  const temporary = resolve(base, `.tmp-${runId}-${randomUUID()}`);
  if (!within(base, temporary)) return null;
  await mkdir(temporary);
  let renamed = false;
  try {
    for (const [key, filename] of ARTIFACT_FILES) {
      await writeFile(join(temporary, filename), artifacts[key], { flag: "wx" });
    }
    await rename(temporary, final);
    renamed = true;
    return (await artifactsMatch(final, artifacts)) ? final : null;
  } catch {
    return null;
  } finally {
    if (!renamed) await rm(temporary, { recursive: true, force: true });
  }
}

export async function runLiveDiscovery(
  dependencies: DiscoveryDependencies,
): Promise<LiveDiscoveryResult> {
  const controller = new AbortController();
  let timeoutHandle: unknown;
  const timeout = new Promise<"TIMEOUT">((resolveTimeout) => {
    timeoutHandle = dependencies.scheduleTimeout(() => {
      controller.abort();
      resolveTimeout("TIMEOUT");
    }, BASE_PLAN.timeoutMs);
  });
  const request = requestBytes(dependencies, controller.signal);
  const raced = await Promise.race([request, timeout]);
  if (timeoutHandle !== undefined) dependencies.clearScheduledTimeout(timeoutHandle);
  if (raced === "TIMEOUT") {
    void request.catch(() => undefined);
    return failed("TIMEOUT");
  }
  if (!raced.ok) return failed(raced.error);
  const processed = processDiscoveryFixture(raced.bytes, raced.retrievedAt);
  if (!processed.ok) return failed(`PARSER_${processed.reason}`);
  const report = { ...processed.report, dispositions: processed.dispositions };
  const rawBytes = new Uint8Array(raced.bytes);
  const candidatesBytes = canonicalBytes(processed.candidates);
  const reportBytes = canonicalBytes(report);
  const runId = `${raced.retrievedAt.replace(/[-:.]/g, "")}-${processed.rawHash.slice(0, 12)}`;
  const manifestCore = {
    schemaVersion: SCHEMA_VERSION,
    runId,
    endpoint: OVERPASS_ENDPOINT,
    method: "POST",
    query: OVERPASS_QUERY,
    querySha256: QUERY_DIGEST,
    sourcePolicySha256: SOURCE_POLICY_DIGEST,
    cohortSha256: COHORT_DIGEST,
    retrievedAt: raced.retrievedAt,
    sourceTimestamp: processed.osmBaseTimestamp,
    attribution: OSM_ATTRIBUTION,
    licenseUrl: OSM_LICENSE_URL,
    artifacts: {
      raw: { filename: "raw.json", sha256: sha256Hex(rawBytes) },
      candidates: { filename: "candidates.json", sha256: sha256Hex(candidatesBytes) },
      report: { filename: "report.json", sha256: sha256Hex(reportBytes) },
    },
  };
  const manifestBytes = canonicalBytes({
    ...manifestCore,
    manifestSha256: sha256Hex(canonicalSerialize(manifestCore)),
  });
  const outputPath = await publish(dependencies.projectRoot, runId, {
    raw: rawBytes,
    candidates: candidatesBytes,
    report: reportBytes,
    manifest: manifestBytes,
  });
  if (outputPath === null) return failed("ARTIFACT_PUBLICATION_FAILED");
  return Object.freeze({
    ok: true,
    runId,
    outputPath: relative(resolve(dependencies.projectRoot), outputPath).replaceAll("\\", "/"),
    counts: (processed.report.reconciliation ?? {}) as Readonly<Record<string, number>>,
    hashes: Object.freeze({
      raw: processed.rawHash,
      candidates: processed.candidatesHash,
      report: sha256Hex(reportBytes),
      manifest: sha256Hex(manifestBytes),
    }),
    sourceSufficiency: (processed.report.sourceSufficiency ?? {}) as Readonly<
      Record<string, unknown>
    >,
  });
}
