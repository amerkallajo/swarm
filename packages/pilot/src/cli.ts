import { readFile, readdir, rename, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { canonicalSerialize, sha256Hex } from "@swarm/discovery";
import type { ManualCandidate } from "@swarm/discovery";

import {
  createTopDrafts,
  parseAuditImport,
  pipelineReport,
  recordAudits,
  scoreAuditedBusinesses,
  validateCandidates,
} from "./index.ts";

interface ManifestArtifact {
  readonly filename: string;
  readonly sha256: string;
}

interface DiscoveryManifest {
  readonly mode: string;
  readonly artifacts: {
    readonly raw: ManifestArtifact;
    readonly candidates: ManifestArtifact;
    readonly report: ManifestArtifact;
  };
}

interface DiscoveryReport {
  readonly sourceSufficiency?: {
    readonly sufficientForNextStage?: boolean;
  };
  readonly [key: string]: unknown;
}

interface ValidatedDiscoveryRun {
  readonly candidates: readonly ManualCandidate[];
  readonly manifest: DiscoveryManifest;
  readonly report: DiscoveryReport;
}

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PILOT_ROOT = join(REPOSITORY_ROOT, ".var", "pilot");
const DATABASE_PATH = join(PILOT_ROOT, "state", "pgdata");
const DISCOVERY_ROOT = join(PILOT_ROOT, "discovery");
const DATABASE_MIGRATIONS = [
  join(REPOSITORY_ROOT, "packages", "database", "migrations", "0001_pilot_data_model.sql"),
  join(
    REPOSITORY_ROOT,
    "packages",
    "database",
    "migrations",
    "0002_pilot_unknown_language_whatsapp.sql",
  ),
] as const;

function parseFlag(arguments_: readonly string[], name: string): string | null {
  const index = arguments_.indexOf(name);
  if (index === -1) return null;
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a path.`);
  }
  return resolve(REPOSITORY_ROOT, value);
}

async function ensureSchema(client: PGlite): Promise<void> {
  const schema = await client.query<{ exists: boolean }>(
    "SELECT to_regclass('public.businesses') IS NOT NULL AS exists",
  );
  if (schema.rows[0]?.exists !== true) {
    for (const migration of DATABASE_MIGRATIONS) {
      await client.exec(await readFile(migration, "utf8"));
    }
    return;
  }
  const whatsapp = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'contacts_route_type_check'
         AND pg_get_constraintdef(oid) LIKE '%WHATSAPP%'
     ) AS exists`,
  );
  if (whatsapp.rows[0]?.exists !== true) {
    await client.exec(await readFile(DATABASE_MIGRATIONS[1], "utf8"));
  }
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporary, path);
}

function isManualCandidateArray(value: unknown): value is ManualCandidate[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 30 &&
    value.every(
      (candidate) =>
        candidate !== null &&
        typeof candidate === "object" &&
        typeof (candidate as Record<string, unknown>).sourceId === "string" &&
        typeof (candidate as Record<string, unknown>).candidateHash === "string",
    )
  );
}

async function readDiscoveryRun(path: string): Promise<ValidatedDiscoveryRun> {
  const manifest = JSON.parse(
    await readFile(join(path, "manifest.json"), "utf8"),
  ) as DiscoveryManifest;
  if (manifest.mode !== "manual") throw new Error("Validation requires a reviewed manual run.");
  const raw = await readFile(join(path, manifest.artifacts.raw.filename), "utf8");
  const candidatesValue: unknown = JSON.parse(
    await readFile(join(path, manifest.artifacts.candidates.filename), "utf8"),
  );
  const reportValue: unknown = JSON.parse(
    await readFile(join(path, manifest.artifacts.report.filename), "utf8"),
  );
  if (!isManualCandidateArray(candidatesValue)) {
    throw new Error("Discovery candidates artifact is malformed.");
  }
  const report = reportValue as DiscoveryReport;
  if (report.sourceSufficiency?.sufficientForNextStage !== true) {
    throw new Error("Discovery run is not sufficient for validation.");
  }
  const checks = {
    raw: sha256Hex(new TextEncoder().encode(raw)),
    candidates: sha256Hex(canonicalSerialize(candidatesValue)),
    report: sha256Hex(canonicalSerialize(reportValue)),
  };
  if (
    checks.raw !== manifest.artifacts.raw.sha256 ||
    checks.candidates !== manifest.artifacts.candidates.sha256 ||
    checks.report !== manifest.artifacts.report.sha256
  ) {
    throw new Error("Discovery artifact integrity check failed.");
  }
  return Object.freeze({
    candidates: Object.freeze(candidatesValue),
    manifest: Object.freeze(manifest),
    report: Object.freeze(report),
  });
}

async function latestSufficientDiscoveryRun(): Promise<string> {
  const entries = await readdir(DISCOVERY_ROOT, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("manual-"))
      .map(async (entry) => {
        const path = join(DISCOVERY_ROOT, entry.name);
        return { path, modifiedAt: (await stat(path)).mtimeMs };
      }),
  );
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
  for (const candidate of candidates) {
    try {
      await readDiscoveryRun(candidate.path);
      return candidate.path;
    } catch {
      // Continue past incomplete or invalid runs; the selected run is revalidated before use.
    }
  }
  throw new Error("No sufficient reviewed discovery run was found.");
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
  const command = arguments_[0];
  if (!["validate", "audit", "score", "draft", "report"].includes(command ?? "")) {
    throw new Error("Usage: pilot <validate|audit|score|draft|report>");
  }
  await mkdir(dirname(DATABASE_PATH), { recursive: true });
  const client = new PGlite(DATABASE_PATH);
  try {
    await ensureSchema(client);
    let result: unknown;
    if (command === "validate") {
      const selectedRun = parseFlag(arguments_, "--run") ?? (await latestSufficientDiscoveryRun());
      const discovery = await readDiscoveryRun(selectedRun);
      result = await validateCandidates(client, discovery.candidates);
      await atomicJson(join(PILOT_ROOT, "validation", "latest.json"), {
        discoveryRun: relative(REPOSITORY_ROOT, selectedRun).replaceAll("\\", "/"),
        summary: result,
      });
    } else if (command === "audit") {
      const importPath = parseFlag(arguments_, "--manual");
      if (importPath === null) throw new Error("pilot:audit requires --manual <ignored-json>.");
      result = await recordAudits(client, parseAuditImport(await readFile(importPath, "utf8")));
      await atomicJson(join(PILOT_ROOT, "audit", "latest.json"), result);
    } else if (command === "score") {
      result = await scoreAuditedBusinesses(client);
      await atomicJson(join(PILOT_ROOT, "score", "latest.json"), result);
    } else if (command === "draft") {
      result = await createTopDrafts(client);
      await atomicJson(join(PILOT_ROOT, "drafts", "latest.json"), result);
    } else {
      const selectedRun = parseFlag(arguments_, "--run") ?? (await latestSufficientDiscoveryRun());
      const discovery = await readDiscoveryRun(selectedRun);
      result = {
        discovery: {
          run: relative(REPOSITORY_ROOT, selectedRun).replaceAll("\\", "/"),
          manifest: discovery.manifest,
          report: discovery.report,
        },
        pilot: await pipelineReport(client),
      };
      await atomicJson(join(PILOT_ROOT, "report", "latest.json"), result);
    }
    process.stdout.write(`${JSON.stringify({ ok: true, command, result }, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown pilot error.";
  process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exitCode = 1;
});
