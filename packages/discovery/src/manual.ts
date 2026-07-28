import { canonicalSerialize, sha256Hex } from "./canonical.ts";

export const MANUAL_IMPORT_SCHEMA_VERSION = "1.0.0" as const;
export const MANUAL_IMPORT_MAX_CANDIDATES = 30 as const;

const CITIES = new Set(["Riyadh", "Jeddah"]);
const WEBSITE_STATUSES = new Set(["PRESENT", "CONFIRMED_ABSENT", "UNKNOWN"]);
const ACTIVITY_STATUSES = new Set(["ACTIVE", "UNKNOWN", "CLOSED"]);
const INDEPENDENCE_STATUSES = new Set(["INDEPENDENT", "UNKNOWN", "CHAIN"]);
const OPPORTUNITY_STATUSES = new Set(["PLAUSIBLE", "NONE", "UNKNOWN"]);
const CONTACT_KINDS = new Set(["EMAIL", "PHONE", "WHATSAPP", "WEBSITE_FORM"]);
const ROW_KEYS = [
  "activitySourceUrl",
  "activityStatus",
  "category",
  "city",
  "contactIsPublicBusiness",
  "contactKind",
  "contactRoute",
  "contactSourceUrl",
  "identitySourceUrl",
  "independenceSourceUrl",
  "independenceStatus",
  "name",
  "observedAt",
  "opportunityObservation",
  "opportunitySourceUrl",
  "opportunityStatus",
  "sourceId",
  "websiteSourceUrl",
  "websiteStatus",
  "websiteUrl",
].sort();

export interface ManualCandidate {
  readonly sourceId: string;
  readonly name: string;
  readonly city: "Riyadh" | "Jeddah";
  readonly category: "PREMIUM_DETAILING";
  readonly observedAt: string;
  readonly activityStatus: "ACTIVE";
  readonly independenceStatus: "INDEPENDENT";
  readonly websiteStatus: "PRESENT" | "CONFIRMED_ABSENT";
  readonly websiteUrl: string | null;
  readonly contactKind: "EMAIL" | "PHONE" | "WHATSAPP" | "WEBSITE_FORM";
  readonly contactRoute: string;
  readonly opportunityStatus: "PLAUSIBLE" | "NONE";
  readonly opportunityObservation: string | null;
  readonly evidence: Readonly<{
    identitySourceUrl: string;
    activitySourceUrl: string;
    independenceSourceUrl: string;
    websiteSourceUrl: string;
    contactSourceUrl: string;
    opportunitySourceUrl: string | null;
  }>;
  readonly candidateHash: string;
}

export type ManualImportResult =
  | Readonly<{
      ok: true;
      candidates: readonly ManualCandidate[];
      dispositions: readonly Readonly<Record<string, unknown>>[];
      report: Readonly<Record<string, unknown>>;
      rawHash: string;
      candidatesHash: string;
      reportHash: string;
    }>
  | Readonly<{ ok: false; reason: string }>;

function text(value: unknown, maximum = 512): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}

function timestamp(value: unknown): string | null {
  const candidate = text(value, 64);
  if (candidate === null) return null;
  const milliseconds = Date.parse(candidate);
  if (!Number.isFinite(milliseconds)) return null;
  const canonical = new Date(milliseconds).toISOString();
  return canonical === candidate ? canonical : null;
}

function publicHttpsUrl(value: unknown): string | null {
  const candidate = text(value, 2_048);
  if (candidate === null) return null;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== "" ||
      hostname.length === 0 ||
      !hostname.includes(".") ||
      /^(?:localhost|0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|\[?::1\]?)/i.test(
        hostname,
      ) ||
      /(?:^|\.)(?:local|internal|localhost|lan|home|invalid|test|example|onion)$/i.test(hostname)
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function nullableHttpsUrl(value: unknown): string | null {
  return value === null ? null : publicHttpsUrl(value);
}

function publicContact(kind: string, value: unknown): string | null {
  const candidate = text(value, 512);
  if (candidate === null) return null;
  if (kind === "EMAIL") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate.toLowerCase() : null;
  }
  if (kind === "PHONE" || kind === "WHATSAPP") {
    const compact = candidate.replace(/[\s().-]+/g, "");
    if (/^05\d{8}$/.test(compact)) return `+966${compact.slice(1)}`;
    return /^\+9665\d{8}$/.test(compact) ? compact : null;
  }
  return publicHttpsUrl(candidate);
}

function exactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === ROW_KEYS.length && keys.every((key, index) => key === ROW_KEYS[index]);
}

function parseRow(value: unknown): ManualCandidate | string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return "MALFORMED_ROW";
  const row = value as Record<string, unknown>;
  if (!exactKeys(row)) return "MALFORMED_ROW";

  const sourceId = text(row.sourceId, 256);
  const name = text(row.name, 256);
  const observedAt = timestamp(row.observedAt);
  const identitySourceUrl = publicHttpsUrl(row.identitySourceUrl);
  const activitySourceUrl = publicHttpsUrl(row.activitySourceUrl);
  const independenceSourceUrl = publicHttpsUrl(row.independenceSourceUrl);
  const websiteSourceUrl = publicHttpsUrl(row.websiteSourceUrl);
  const contactSourceUrl = publicHttpsUrl(row.contactSourceUrl);
  const opportunitySourceUrl = nullableHttpsUrl(row.opportunitySourceUrl);
  if (
    sourceId === null ||
    name === null ||
    observedAt === null ||
    identitySourceUrl === null ||
    activitySourceUrl === null ||
    independenceSourceUrl === null ||
    websiteSourceUrl === null ||
    contactSourceUrl === null
  ) {
    return "INVALID_REQUIRED_PROVENANCE";
  }
  if (
    row.category !== "PREMIUM_DETAILING" ||
    typeof row.city !== "string" ||
    !CITIES.has(row.city)
  ) {
    return "OUTSIDE_COHORT";
  }
  if (
    typeof row.activityStatus !== "string" ||
    !ACTIVITY_STATUSES.has(row.activityStatus) ||
    typeof row.independenceStatus !== "string" ||
    !INDEPENDENCE_STATUSES.has(row.independenceStatus) ||
    typeof row.websiteStatus !== "string" ||
    !WEBSITE_STATUSES.has(row.websiteStatus) ||
    typeof row.opportunityStatus !== "string" ||
    !OPPORTUNITY_STATUSES.has(row.opportunityStatus)
  ) {
    return "INVALID_REVIEW_STATUS";
  }
  if (row.activityStatus !== "ACTIVE") return "NOT_CONFIRMED_ACTIVE";
  if (row.independenceStatus !== "INDEPENDENT") return "NOT_CONFIRMED_INDEPENDENT";
  if (row.websiteStatus === "UNKNOWN") return "WEBSITE_STATUS_UNKNOWN";
  if (
    (row.websiteStatus === "PRESENT" && publicHttpsUrl(row.websiteUrl) === null) ||
    (row.websiteStatus === "CONFIRMED_ABSENT" && row.websiteUrl !== null)
  ) {
    return "INVALID_WEBSITE_REVIEW";
  }
  if (
    row.contactIsPublicBusiness !== true ||
    typeof row.contactKind !== "string" ||
    !CONTACT_KINDS.has(row.contactKind)
  ) {
    return "NO_PUBLIC_BUSINESS_CONTACT";
  }
  const contactRoute = publicContact(row.contactKind, row.contactRoute);
  if (contactRoute === null) return "NO_PUBLIC_BUSINESS_CONTACT";
  if (row.opportunityStatus === "UNKNOWN") return "OPPORTUNITY_STATUS_UNKNOWN";
  const opportunityObservation =
    row.opportunityStatus === "PLAUSIBLE" ? text(row.opportunityObservation, 1_024) : null;
  if (
    row.opportunityStatus === "PLAUSIBLE" &&
    (opportunitySourceUrl === null || opportunityObservation === null)
  ) {
    return "OPPORTUNITY_EVIDENCE_MISSING";
  }
  if (
    row.opportunityStatus === "NONE" &&
    (row.opportunityObservation !== null || row.opportunitySourceUrl !== null)
  ) {
    return "INVALID_OPPORTUNITY_REVIEW";
  }

  const stable = {
    sourceId,
    name,
    city: row.city as "Riyadh" | "Jeddah",
    category: "PREMIUM_DETAILING" as const,
    observedAt,
    activityStatus: "ACTIVE" as const,
    independenceStatus: "INDEPENDENT" as const,
    websiteStatus: row.websiteStatus as "PRESENT" | "CONFIRMED_ABSENT",
    websiteUrl: row.websiteStatus === "PRESENT" ? (publicHttpsUrl(row.websiteUrl) as string) : null,
    contactKind: row.contactKind as "EMAIL" | "PHONE" | "WHATSAPP" | "WEBSITE_FORM",
    contactRoute,
    opportunityStatus: row.opportunityStatus as "PLAUSIBLE" | "NONE",
    opportunityObservation,
    evidence: {
      identitySourceUrl,
      activitySourceUrl,
      independenceSourceUrl,
      websiteSourceUrl,
      contactSourceUrl,
      opportunitySourceUrl,
    },
  };
  return Object.freeze({
    ...stable,
    evidence: Object.freeze(stable.evidence),
    candidateHash: sha256Hex(canonicalSerialize(stable)),
  });
}

export function processManualImport(input: string | Uint8Array): ManualImportResult {
  let raw: string;
  try {
    raw =
      typeof input === "string" ? input : new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    return Object.freeze({ ok: false, reason: "INVALID_UTF8" });
  }
  if (raw.length > 5_242_880) return Object.freeze({ ok: false, reason: "INPUT_TOO_LARGE" });
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return Object.freeze({ ok: false, reason: "INVALID_JSON" });
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    return Object.freeze({ ok: false, reason: "INVALID_DOCUMENT" });
  }
  const document = decoded as Record<string, unknown>;
  if (
    Object.keys(document).sort().join(",") !== "records,schemaVersion" ||
    document.schemaVersion !== MANUAL_IMPORT_SCHEMA_VERSION ||
    !Array.isArray(document.records) ||
    document.records.length > MANUAL_IMPORT_MAX_CANDIDATES
  ) {
    return Object.freeze({ ok: false, reason: "INVALID_DOCUMENT" });
  }

  const rawHash = sha256Hex(new TextEncoder().encode(raw));
  const accepted: Array<{ candidate: ManualCandidate; rawIndex: number }> = [];
  const dispositions: Array<Record<string, unknown>> = [];
  for (let index = 0; index < document.records.length; index += 1) {
    const parsed = parseRow(document.records[index]);
    if (typeof parsed === "string") {
      dispositions.push({ rawIndex: index, disposition: "EXCLUDED", reason: parsed });
    } else {
      accepted.push({ candidate: parsed, rawIndex: index });
    }
  }
  accepted.sort((left, right) =>
    left.candidate.sourceId < right.candidate.sourceId
      ? -1
      : left.candidate.sourceId > right.candidate.sourceId
        ? 1
        : 0,
  );
  const seenSource = new Set<string>();
  const seenIdentity = new Set<string>();
  const candidates: ManualCandidate[] = [];
  for (const item of accepted) {
    const identity = `${item.candidate.city}|${item.candidate.name.toLowerCase()}|${
      item.candidate.websiteUrl ?? "NO_WEBSITE"
    }`;
    if (seenSource.has(item.candidate.sourceId) || seenIdentity.has(identity)) {
      dispositions.push({
        rawIndex: item.rawIndex,
        disposition: "DUPLICATE_REMOVED",
        reason: "DUPLICATE_REVIEWED_IDENTITY",
      });
      continue;
    }
    seenSource.add(item.candidate.sourceId);
    seenIdentity.add(identity);
    candidates.push(item.candidate);
    dispositions.push({
      rawIndex: item.rawIndex,
      disposition: "SELECTED",
      reason: "REVIEWED_MANUAL_CANDIDATE",
    });
  }
  dispositions.sort((left, right) => Number(left.rawIndex) - Number(right.rawIndex));

  const duplicateCount = dispositions.filter(
    (item) => item.disposition === "DUPLICATE_REMOVED",
  ).length;
  const exclusions: Record<string, number> = {};
  for (const item of dispositions) {
    if (item.disposition === "SELECTED") continue;
    const reason = String(item.reason);
    exclusions[reason] = (exclusions[reason] ?? 0) + 1;
  }
  const withWebsites = candidates.filter((candidate) => candidate.websiteUrl !== null).length;
  const plausible = candidates.filter(
    (candidate) => candidate.opportunityStatus === "PLAUSIBLE",
  ).length;
  const siteKnown = candidates.length;
  const sufficient = candidates.length >= 15 && siteKnown >= 10 && plausible >= 8;
  const candidatesHash = sha256Hex(canonicalSerialize(candidates));
  const observedTimes = candidates.map((candidate) => candidate.observedAt).sort();
  const earliestObservedAt = observedTimes[0] ?? null;
  const latestObservedAt = observedTimes.at(-1) ?? null;
  const report = {
    schemaVersion: MANUAL_IMPORT_SCHEMA_VERSION,
    adapter: "REVIEWED_MANUAL_JSON",
    rawRecordCount: document.records.length,
    parsedRecordCount: document.records.length,
    eligibleCandidateCount: accepted.length,
    selectedCount: candidates.length,
    duplicateCount,
    exclusionCountsByReason: exclusions,
    candidatesWithWebsites: withWebsites,
    candidatesWithoutWebsites: candidates.length - withWebsites,
    candidatesWithPublicBusinessRoute: candidates.length,
    missingFieldRates: {
      website:
        candidates.length === 0 ? null : (candidates.length - withWebsites) / candidates.length,
    },
    source: {
      provider: "REVIEWED_MANUAL_IMPORT",
      observedAt: latestObservedAt,
      observationRange: {
        earliest: earliestObservedAt,
        latest: latestObservedAt,
      },
      rawSha256: rawHash,
      normalizedSha256: candidatesHash,
    },
    sourceSufficiency: {
      sufficientForNextStage: sufficient,
      verdict: sufficient ? "SOURCE_SUFFICIENT" : "REVIEWED_IMPORT_INCOMPLETE",
      criteria: {
        credibleActiveBusinesses: { minimum: 15, observed: candidates.length },
        ownedWebsiteOrConfirmedAbsence: { minimum: 10, observed: siteKnown },
        plausibleWebsiteOpportunity: { minimum: 8, observed: plausible },
      },
    },
  };
  const reportHash = sha256Hex(canonicalSerialize(report));
  return Object.freeze({
    ok: true,
    candidates: Object.freeze(candidates),
    dispositions: Object.freeze(dispositions),
    report: Object.freeze(report),
    rawHash,
    candidatesHash,
    reportHash,
  });
}
