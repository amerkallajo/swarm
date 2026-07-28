import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MAX_RESPONSE_BYTES,
  OVERPASS_ENDPOINT,
  processDiscoveryFixture,
  processManualImport,
  runLiveDiscovery,
} from "../src/index.ts";
import {
  createAllowlistedStreamingTransport,
  isPublicNetworkAddress,
  toPlainNetworkBytes,
} from "../src/network.ts";

const FIXTURE_URL = new URL("../fixtures/overpass.synthetic.json", import.meta.url);
const OBSERVED_AT = "2026-07-28T00:00:00.000Z";

function element(index, overrides = {}) {
  return {
    type: "node",
    id: 10_000 + index,
    lat: index % 2 === 0 ? 24.7 : 21.5,
    lon: index % 2 === 0 ? 46.7 : 39.2,
    timestamp: "2026-07-27T12:00:00Z",
    version: 1,
    changeset: index + 1,
    tags: {
      name: `Synthetic Detailing ${index}`,
      shop: "car_repair",
      service: "ceramic coating",
      website: `https://studio-${index}.swarm-fixture.sa/`,
    },
    ...overrides,
  };
}

function document(elements) {
  return {
    version: 0.6,
    generator: "synthetic-test",
    osm3s: {
      timestamp_osm_base: "2026-07-28T00:00:00Z",
      copyright: "Synthetic fixture",
    },
    elements,
  };
}

function response(bytes, overrides = {}) {
  return {
    status: 200,
    url: OVERPASS_ENDPOINT,
    redirected: false,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-encoding": "identity",
      "content-length": String(bytes.byteLength),
    },
    body: {
      async *[Symbol.asyncIterator]() {
        yield bytes;
      },
    },
    cancel() {},
    ...overrides,
  };
}

function dependencies(projectRoot, transport) {
  return {
    projectRoot,
    transport,
    now: () => Date.parse(OBSERVED_AT),
    scheduleTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clearScheduledTimeout: (handle) => clearTimeout(handle),
  };
}

test("fixture mode preserves Arabic, provenance, duplicates, and makes zero network calls", async () => {
  const raw = await readFile(FIXTURE_URL);
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("fixture mode must not use the network");
  };
  let result;
  try {
    result = processDiscoveryFixture(new Uint8Array(raw), OBSERVED_AT);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(networkCalls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.report.rawRecordCount, 6);
  assert.equal(result.report.selectedCount, 2);
  assert.equal(result.report.duplicateCount, 1);
  assert.equal(
    result.candidates.find((candidate) => candidate.nameAr !== null)?.nameAr,
    "مركز تجريبي للسيراميك",
  );
  assert.match(result.candidates[0].sourceUrl, /^https:\/\/www\.openstreetmap\.org\//);
  assert.equal(result.report.sourceSufficiency.sufficientForNextStage, false);
});

test("normalization and all aggregate hashes are deterministic", async () => {
  const raw = await readFile(FIXTURE_URL);
  const first = processDiscoveryFixture(new Uint8Array(raw), OBSERVED_AT);
  const second = processDiscoveryFixture(new Uint8Array(raw), OBSERVED_AT);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.candidates, second.candidates);
  assert.equal(first.rawHash, second.rawHash);
  assert.equal(first.candidatesHash, second.candidatesHash);
  assert.equal(first.reportHash, second.reportHash);
  assert.equal(first.captureHash, second.captureHash);
});

test("malformed Overpass input fails closed", () => {
  assert.deepEqual(processDiscoveryFixture("{", OBSERVED_AT), {
    ok: false,
    reason: "INVALID_JSON",
  });
  assert.deepEqual(
    processDiscoveryFixture(JSON.stringify({ ...document([]), unexpected: true }), OBSERVED_AT),
    { ok: false, reason: "INVALID_OVERPASS_DOCUMENT" },
  );
  assert.deepEqual(processDiscoveryFixture(new Uint8Array([0xff]), OBSERVED_AT), {
    ok: false,
    reason: "INVALID_UTF8_OR_SIZE",
  });
});

test("candidate selection is deterministic and capped at 30", () => {
  const result = processDiscoveryFixture(
    JSON.stringify(document(Array.from({ length: 35 }, (_, index) => element(index)))),
    OBSERVED_AT,
  );
  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 30);
  assert.equal(result.report.reconciliation.capExcluded, 5);
});

test("network destination guard rejects private, loopback, link-local, and metadata ranges", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "198.51.100.1",
    "203.0.113.1",
    "::1",
    "fd00:ec2::254",
    "fe80::1",
  ]) {
    assert.equal(isPublicNetworkAddress(address), false, address);
  }
  assert.equal(isPublicNetworkAddress("1.1.1.1"), true);
  assert.equal(isPublicNetworkAddress("2606:4700:4700::1111"), true);
});

test("live transport rejects any unapproved host, path, or method before networking", async () => {
  const transport = createAllowlistedStreamingTransport();
  const plan = {
    endpoint: OVERPASS_ENDPOINT,
    method: "POST",
    headers: {},
    body: "synthetic",
    timeoutMs: 30_000,
    byteCap: MAX_RESPONSE_BYTES,
    signal: new AbortController().signal,
  };
  await assert.rejects(
    transport({ ...plan, endpoint: "https://overpass-api.example/api/interpreter" }),
    /NETWORK_PLAN_NOT_ALLOWLISTED/,
  );
  await assert.rejects(
    transport({ ...plan, endpoint: "https://overpass-api.de/api/other" }),
    /NETWORK_PLAN_NOT_ALLOWLISTED/,
  );
  await assert.rejects(transport({ ...plan, method: "GET" }), /NETWORK_PLAN_NOT_ALLOWLISTED/);
});

test("live runner enforces its hard timeout", async () => {
  const result = await runLiveDiscovery({
    projectRoot: join(tmpdir(), "swarm-timeout-not-written"),
    transport: () => new Promise(() => {}),
    now: () => Date.parse(OBSERVED_AT),
    scheduleTimeout: (callback) => setTimeout(callback, 5),
    clearScheduledTimeout: (handle) => clearTimeout(handle),
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "LIVE_DISCOVERY_FAILED",
    error: "TIMEOUT",
  });
});

test("live runner rejects an oversized response before reading its body", async () => {
  let bodyRead = false;
  const result = await runLiveDiscovery(
    dependencies(join(tmpdir(), "swarm-byte-limit-not-written"), async () =>
      response(new Uint8Array(), {
        headers: {
          "content-type": "application/json",
          "content-encoding": "identity",
          "content-length": String(MAX_RESPONSE_BYTES + 1),
        },
        body: {
          async *[Symbol.asyncIterator]() {
            bodyRead = true;
            yield new Uint8Array();
          },
        },
      }),
    ),
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "RESPONSE_BYTE_LIMIT");
  assert.equal(bodyRead, false);
});

test("live runner publishes an insufficient capture atomically and reruns idempotently", async (t) => {
  const projectRoot = await mkdtemp(join(tmpdir(), "swarm-discovery-"));
  t.after(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });
  const raw = new Uint8Array(await readFile(FIXTURE_URL));
  const deps = dependencies(projectRoot, async () => response(raw));
  const first = await runLiveDiscovery(deps);
  const second = await runLiveDiscovery(deps);
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.equal(first.sourceSufficiency.sufficientForNextStage, false);
  const directory = join(projectRoot, first.outputPath);
  assert.equal(
    JSON.parse(await readFile(join(directory, "report.json"), "utf8")).sourceSufficiency.verdict,
    "REVIEWED_IMPORT_REQUIRED",
  );
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  assert.equal(manifest.endpoint, OVERPASS_ENDPOINT);
  assert.match(manifest.query, /^\[out:json\]/);
  assert.match(manifest.artifacts.raw.sha256, /^[a-f0-9]{64}$/);
});

test("Node Buffer chunks are copied to a plain Uint8Array boundary", () => {
  const source = Buffer.from("synthetic");
  const converted = toPlainNetworkBytes(source);
  assert.deepEqual([...converted], [...source]);
  source[0] = 0;
  assert.equal(new TextDecoder().decode(converted), "synthetic");
  assert.equal(toPlainNetworkBytes("not bytes"), null);
});

test("reviewed manual JSON preserves Arabic, provenance, and deterministic deduplication", async () => {
  const raw = await readFile(new URL("../fixtures/manual.synthetic.json", import.meta.url));
  const first = processManualImport(new Uint8Array(raw));
  const second = processManualImport(new Uint8Array(raw));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.report.rawRecordCount, 3);
  assert.equal(first.report.selectedCount, 1);
  assert.equal(first.report.duplicateCount, 1);
  assert.equal(first.candidates[0].name, "استوديو العناية التجريبي");
  assert.match(first.candidates[0].evidence.independenceSourceUrl, /^https:/);
  assert.match(first.candidates[0].opportunityObservation, /booking page/);
  assert.equal(first.candidatesHash, second.candidatesHash);
  assert.equal(first.reportHash, second.reportHash);
});

test("reviewed manual JSON enforces the exact 15/10/8 rules and 30-record cap", () => {
  const records = Array.from({ length: 15 }, (_, index) => ({
    sourceId: `manual-${String(index).padStart(2, "0")}`,
    name: `Synthetic Reviewed Studio ${index}`,
    city: index % 2 === 0 ? "Riyadh" : "Jeddah",
    category: "PREMIUM_DETAILING",
    observedAt: OBSERVED_AT,
    identitySourceUrl: `https://identity-${index}.swarm-fixture.sa/`,
    activityStatus: "ACTIVE",
    activitySourceUrl: `https://activity-${index}.swarm-fixture.sa/`,
    independenceStatus: "INDEPENDENT",
    independenceSourceUrl: `https://identity-${index}.swarm-fixture.sa/`,
    websiteStatus: "PRESENT",
    websiteUrl: `https://website-${index}.swarm-fixture.sa/`,
    websiteSourceUrl: `https://identity-${index}.swarm-fixture.sa/`,
    contactKind: "WEBSITE_FORM",
    contactRoute: `https://website-${index}.swarm-fixture.sa/contact`,
    contactIsPublicBusiness: true,
    contactSourceUrl: `https://website-${index}.swarm-fixture.sa/contact`,
    opportunityStatus: index < 8 ? "PLAUSIBLE" : "NONE",
    opportunityObservation:
      index < 8 ? "The synthetic service page lacks a direct booking call to action." : null,
    opportunitySourceUrl: index < 8 ? `https://website-${index}.swarm-fixture.sa/services` : null,
  }));
  const result = processManualImport(JSON.stringify({ schemaVersion: "1.0.0", records }));
  assert.equal(result.ok, true);
  assert.equal(result.report.selectedCount, 15);
  assert.equal(result.report.sourceSufficiency.sufficientForNextStage, true);
  assert.deepEqual(
    processManualImport(
      JSON.stringify({
        schemaVersion: "1.0.0",
        records: Array.from({ length: 31 }, () => records[0]),
      }),
    ),
    { ok: false, reason: "INVALID_DOCUMENT" },
  );
});
