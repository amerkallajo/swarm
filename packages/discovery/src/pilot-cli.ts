import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalSerialize, sha256Hex } from "./canonical.ts";
import { processManualImport } from "./manual.ts";
import { processDiscoveryFixture } from "./model.ts";
import { createAllowlistedStreamingTransport } from "./network.ts";
import { runLiveDiscovery } from "./runner.ts";

const FIXTURE_OBSERVED_AT = "2026-07-28T00:00:00.000Z";
const OUTPUT_BASE = join(".var", "pilot", "discovery");
const capturedDateNow = Date.now;
const capturedSetTimeout = globalThis.setTimeout;
const capturedClearTimeout = globalThis.clearTimeout;
const PROJECT_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

function outputBase(projectRoot: string): string {
  return resolve(projectRoot, OUTPUT_BASE);
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
      const actual = await readFile(join(directory, filename));
      if (sha256Hex(actual) !== sha256Hex(artifacts[key])) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function publishLocalArtifacts(
  projectRoot: string,
  runId: string,
  artifacts: ArtifactBundle,
): Promise<string> {
  const base = outputBase(projectRoot);
  const final = resolve(base, runId);
  if (!within(base, final)) throw new Error("INVALID_LOCAL_RUN_ID");
  await mkdir(base, { recursive: true });
  if (await artifactsMatch(final, artifacts)) return final;
  try {
    await stat(final);
    throw new Error("LOCAL_RUN_COLLISION");
  } catch (error) {
    if ((error as { code?: unknown }).code !== "ENOENT") throw error;
  }

  const temporary = resolve(base, `.tmp-${runId}-${randomUUID()}`);
  if (!within(base, temporary)) throw new Error("INVALID_LOCAL_TEMP_PATH");
  await mkdir(temporary);
  let published = false;
  try {
    for (const [key, filename] of ARTIFACT_FILES) {
      await writeFile(join(temporary, filename), artifacts[key], { flag: "wx" });
    }
    await rename(temporary, final);
    published = true;
    return final;
  } catch (error) {
    if (
      (error as { code?: unknown }).code === "EEXIST" &&
      (await artifactsMatch(final, artifacts))
    ) {
      return final;
    }
    throw error;
  } finally {
    if (!published) await rm(temporary, { recursive: true, force: true });
  }
}

async function runFixture(projectRoot: string): Promise<number> {
  const fixturePath = join(
    projectRoot,
    "packages",
    "discovery",
    "fixtures",
    "overpass.synthetic.json",
  );
  const raw = await readFile(fixturePath);
  const rawBytes = new Uint8Array(raw);
  const processed = processDiscoveryFixture(rawBytes, FIXTURE_OBSERVED_AT);
  if (!processed.ok) {
    process.stderr.write(`FIXTURE_DISCOVERY_FAILED:${processed.reason}\n`);
    return 1;
  }

  const report = { ...processed.report, dispositions: processed.dispositions };
  const candidatesBytes = Buffer.from(canonicalSerialize(processed.candidates));
  const reportBytes = Buffer.from(canonicalSerialize(report));
  const reportArtifactHash = sha256Hex(reportBytes);
  const runId = `fixture-${processed.rawHash.slice(0, 12)}-${processed.candidatesHash.slice(0, 12)}`;
  const manifest = {
    schemaVersion: "1.0.0",
    mode: "fixture",
    runId,
    observedAt: processed.observationTime,
    sourceTimestamp: processed.osmBaseTimestamp,
    artifacts: {
      raw: { filename: "raw.json", sha256: sha256Hex(rawBytes) },
      candidates: {
        filename: "candidates.json",
        sha256: sha256Hex(candidatesBytes),
      },
      report: { filename: "report.json", sha256: reportArtifactHash },
    },
  };
  const manifestBytes = Buffer.from(canonicalSerialize(manifest));
  try {
    await publishLocalArtifacts(projectRoot, runId, {
      raw: rawBytes,
      candidates: candidatesBytes,
      report: reportBytes,
      manifest: manifestBytes,
    });
  } catch {
    process.stderr.write("FIXTURE_ARTIFACT_PUBLICATION_FAILED\n");
    return 1;
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      mode: "fixture",
      outputPath: `${OUTPUT_BASE.replaceAll("\\", "/")}/${runId}`,
      counts: processed.report.reconciliation,
      hashes: {
        raw: processed.rawHash,
        candidates: processed.candidatesHash,
        report: reportArtifactHash,
      },
    })}\n`,
  );
  return 0;
}

async function runLive(projectRoot: string): Promise<number> {
  const result = await runLiveDiscovery({
    projectRoot,
    transport: createAllowlistedStreamingTransport(),
    now: capturedDateNow,
    scheduleTimeout: capturedSetTimeout,
    clearScheduledTimeout: (handle: unknown) => capturedClearTimeout(handle as NodeJS.Timeout),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.ok ? 0 : 1;
}

async function runManual(projectRoot: string, inputArgument: string): Promise<number> {
  const importBase = resolve(outputBase(projectRoot), "import");
  const inputPath = resolve(projectRoot, inputArgument);
  if (!within(importBase, inputPath)) {
    process.stderr.write("MANUAL_INPUT_MUST_BE_UNDER_.var/pilot/discovery/import\n");
    return 2;
  }
  let raw;
  try {
    raw = await readFile(inputPath);
  } catch {
    process.stderr.write("MANUAL_INPUT_NOT_READABLE\n");
    return 1;
  }
  const rawBytes = new Uint8Array(raw);
  const processed = processManualImport(rawBytes);
  if (!processed.ok) {
    process.stderr.write(`MANUAL_IMPORT_FAILED:${processed.reason}\n`);
    return 1;
  }
  const runId = `manual-${processed.rawHash.slice(0, 12)}`;
  const report = { ...processed.report, dispositions: processed.dispositions };
  const candidatesBytes = Buffer.from(canonicalSerialize(processed.candidates));
  const reportBytes = Buffer.from(canonicalSerialize(report));
  const reportHash = sha256Hex(reportBytes);
  const manifest = {
    schemaVersion: "1.0.0",
    mode: "manual",
    runId,
    artifacts: {
      raw: { filename: "raw.json", sha256: sha256Hex(rawBytes) },
      candidates: {
        filename: "candidates.json",
        sha256: sha256Hex(candidatesBytes),
      },
      report: { filename: "report.json", sha256: reportHash },
    },
  };
  const manifestBytes = Buffer.from(canonicalSerialize(manifest));
  try {
    await publishLocalArtifacts(projectRoot, runId, {
      raw: rawBytes,
      candidates: candidatesBytes,
      report: reportBytes,
      manifest: manifestBytes,
    });
  } catch {
    process.stderr.write("MANUAL_ARTIFACT_PUBLICATION_FAILED\n");
    return 1;
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      mode: "manual",
      outputPath: `${OUTPUT_BASE.replaceAll("\\", "/")}/${runId}`,
      counts: {
        raw: processed.report.rawRecordCount,
        selected: processed.report.selectedCount,
        duplicateRemoved: processed.report.duplicateCount,
      },
      hashes: {
        raw: processed.rawHash,
        candidates: processed.candidatesHash,
        report: reportHash,
      },
    })}\n`,
  );
  return 0;
}

type ReportRecord = Readonly<Record<string, unknown>>;

function record(value: unknown): ReportRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as ReportRecord)
    : null;
}

function numberField(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function artifactDescriptor(
  artifacts: ReportRecord,
  key: "raw" | "candidates" | "report",
  expectedFilename: string,
): string | null {
  const descriptor = record(artifacts[key]);
  const digest = descriptor?.sha256;
  return descriptor?.filename === expectedFilename &&
    typeof digest === "string" &&
    /^[a-f0-9]{64}$/.test(digest)
    ? digest
    : null;
}

async function verifiedRunArtifacts(
  directory: string,
): Promise<{ report: ReportRecord; manifest: ReportRecord } | null> {
  try {
    const rawBytes = await readFile(join(directory, "raw.json"));
    const candidatesBytes = await readFile(join(directory, "candidates.json"));
    const reportBytes = await readFile(join(directory, "report.json"));
    const manifestBytes = await readFile(join(directory, "manifest.json"));
    const report = record(JSON.parse(reportBytes.toString("utf8")));
    const manifest = record(JSON.parse(manifestBytes.toString("utf8")));
    const artifacts = record(manifest?.artifacts);
    if (report === null || manifest === null || artifacts === null) return null;
    const rawHash = artifactDescriptor(artifacts, "raw", "raw.json");
    const candidatesHash = artifactDescriptor(artifacts, "candidates", "candidates.json");
    const reportHash = artifactDescriptor(artifacts, "report", "report.json");
    if (
      rawHash === null ||
      candidatesHash === null ||
      reportHash === null ||
      sha256Hex(rawBytes) !== rawHash ||
      sha256Hex(candidatesBytes) !== candidatesHash ||
      sha256Hex(reportBytes) !== reportHash
    ) {
      return null;
    }
    return { report, manifest };
  } catch {
    return null;
  }
}

async function latestRunDirectory(projectRoot: string): Promise<string | null> {
  const base = outputBase(projectRoot);
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return null;
  }
  let selected: { path: string; modifiedAt: number } | null = null;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = resolve(base, entry.name);
    if (!within(base, candidate)) continue;
    try {
      const manifest = await stat(join(candidate, "manifest.json"));
      const report = await stat(join(candidate, "report.json"));
      const modifiedAt = Math.max(manifest.mtimeMs, report.mtimeMs);
      if (selected === null || modifiedAt > selected.modifiedAt) {
        selected = { path: candidate, modifiedAt };
      }
    } catch {
      // Ignore incomplete local runs.
    }
  }
  return selected?.path ?? null;
}

async function printReport(projectRoot: string): Promise<number> {
  const directory = await latestRunDirectory(projectRoot);
  if (directory === null) {
    process.stderr.write("NO_DISCOVERY_RUN_FOUND\n");
    return 1;
  }
  const verified = await verifiedRunArtifacts(directory);
  if (verified === null) {
    process.stderr.write("INVALID_DISCOVERY_ARTIFACTS\n");
    return 1;
  }
  const { report, manifest } = verified;
  const reconciliation = record(report.reconciliation) ?? {};
  const source = record(report.source) ?? {};
  const sufficiency = record(report.sourceSufficiency) ?? {};
  const exclusions = record(report.exclusionCountsByReason) ?? {};
  const missing = record(report.missingFieldRates) ?? {};
  const artifacts = record(manifest.artifacts) ?? {};
  const rawArtifact = record(artifacts.raw) ?? {};
  const candidatesArtifact = record(artifacts.candidates) ?? {};
  const display = {
    run: relative(projectRoot, directory).replaceAll("\\", "/"),
    rawRecordCount: numberField(report.rawRecordCount, numberField(reconciliation.raw)),
    parsedRecordCount: numberField(report.parsedRecordCount),
    eligibleCandidateCount: numberField(report.eligibleCandidateCount),
    selectedCount: numberField(report.selectedCount, numberField(reconciliation.selected)),
    duplicateCount: numberField(
      report.duplicateCount,
      numberField(reconciliation.duplicateRemoved),
    ),
    exclusionCountsByReason: exclusions,
    candidatesWithWebsites: numberField(report.candidatesWithWebsites),
    candidatesWithoutWebsites: numberField(report.candidatesWithoutWebsites),
    candidatesWithPublicBusinessRoute: numberField(report.candidatesWithPublicBusinessRoute),
    missingFieldRates: missing,
    sourceObservedAt:
      source.retrievedAt ??
      source.observedAt ??
      manifest.retrievedAt ??
      manifest.responseTimestamp ??
      manifest.observedAt,
    sourceTimestamp: source.sourceTimestamp ?? manifest.sourceTimestamp,
    hashes: {
      raw: source.rawSha256 ?? rawArtifact.sha256,
      normalized: source.normalizedSha256 ?? candidatesArtifact.sha256,
      report: record(artifacts.report)?.sha256,
    },
    sourceSufficientForNextStage: sufficiency.sufficientForNextStage === true,
    sourceSufficiencyVerdict: sufficiency.verdict ?? "UNKNOWN",
  };
  process.stdout.write(`${JSON.stringify(display, null, 2)}\n`);
  return 0;
}

async function main(): Promise<number> {
  const [command, ...forwardedArgs] = process.argv.slice(2);
  const args =
    forwardedArgs.length > 0 && forwardedArgs[0] === "--" ? forwardedArgs.slice(1) : forwardedArgs;
  const projectRoot = PROJECT_ROOT;
  if (command === "discover") {
    if (args.length === 0 || (args.length === 1 && args[0] === "--fixture")) {
      return await runFixture(projectRoot);
    }
    if (args.length === 1 && args[0] === "--live") {
      return await runLive(projectRoot);
    }
    if (args.length === 2 && args[0] === "--manual") {
      return await runManual(projectRoot, args[1] ?? "");
    }
  } else if (command === "report" && args.length === 0) {
    return await printReport(projectRoot);
  }
  process.stderr.write(
    "USAGE: pilot-cli discover [--fixture | --live | --manual <ignored-json-path>] | report\n",
  );
  return 2;
}

process.exitCode = await main();
