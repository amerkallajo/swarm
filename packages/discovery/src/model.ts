import { canonicalSerialize, sha256Hex } from "./canonical.ts";

export const SCHEMA_VERSION = "1.0.0" as const;
export const MAX_CANDIDATES = 30 as const;
export const MAX_RESPONSE_BYTES = 10_485_760 as const;
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors" as const;
export const OSM_LICENSE_URL = "https://opendatacommons.org/licenses/odbl/1-0/" as const;
export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter" as const;
export const USER_AGENT = "SWARM-Discovery/1.0 (+https://github.com/amerkallajo/swarm)" as const;

export interface BoundingBox {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
  readonly label: "Riyadh" | "Jeddah";
}

export const RIYADH_BBOX: BoundingBox = Object.freeze({
  south: 24.5,
  west: 46.5,
  north: 24.9,
  east: 46.9,
  label: "Riyadh",
});

export const JEDDAH_BBOX: BoundingBox = Object.freeze({
  south: 21.3,
  west: 39.1,
  north: 21.7,
  east: 39.4,
  label: "Jeddah",
});

export const FROZEN_COHORT = Object.freeze({
  cohortId: "sa-detailing-riyadh-jeddah-2026q3",
  country: "SA",
  cities: Object.freeze(["Riyadh", "Jeddah"]),
  maxCandidates: MAX_CANDIDATES,
});

const PREMIUM_PATTERN =
  "detailing|detail|ceramic|coating|ppf|paint correction|car care|nano|polish|تلميع|تفصيل|سيراميك|كوتينج|حماية|عناية السيارات|بي بي اف";
const bbox = (box: BoundingBox): string => `${box.south},${box.west},${box.north},${box.east}`;

export const OVERPASS_QUERY = `[out:json][timeout:25];
(
  nwr["shop"="car_repair"](${bbox(RIYADH_BBOX)});
  nwr["shop"="car_repair"](${bbox(JEDDAH_BBOX)});
  nwr["shop"="car"](${bbox(RIYADH_BBOX)});
  nwr["shop"="car"](${bbox(JEDDAH_BBOX)});
  nwr["shop"="car_parts"](${bbox(RIYADH_BBOX)});
  nwr["shop"="car_parts"](${bbox(JEDDAH_BBOX)});
  nwr["amenity"="car_wash"](${bbox(RIYADH_BBOX)});
  nwr["amenity"="car_wash"](${bbox(JEDDAH_BBOX)});
  nwr["craft"="car_body_repairer"](${bbox(RIYADH_BBOX)});
  nwr["craft"="car_body_repairer"](${bbox(JEDDAH_BBOX)});
  nwr["name"~"${PREMIUM_PATTERN}",i](${bbox(RIYADH_BBOX)});
  nwr["name"~"${PREMIUM_PATTERN}",i](${bbox(JEDDAH_BBOX)});
  nwr["name:ar"~"${PREMIUM_PATTERN}",i](${bbox(RIYADH_BBOX)});
  nwr["name:ar"~"${PREMIUM_PATTERN}",i](${bbox(JEDDAH_BBOX)});
  nwr["name:en"~"${PREMIUM_PATTERN}",i](${bbox(RIYADH_BBOX)});
  nwr["name:en"~"${PREMIUM_PATTERN}",i](${bbox(JEDDAH_BBOX)});
  nwr["service"~"${PREMIUM_PATTERN}",i](${bbox(RIYADH_BBOX)});
  nwr["service"~"${PREMIUM_PATTERN}",i](${bbox(JEDDAH_BBOX)});
  nwr["description"~"${PREMIUM_PATTERN}",i](${bbox(RIYADH_BBOX)});
  nwr["description"~"${PREMIUM_PATTERN}",i](${bbox(JEDDAH_BBOX)});
  nwr["service:vehicle:detailing"](${bbox(RIYADH_BBOX)});
  nwr["service:vehicle:detailing"](${bbox(JEDDAH_BBOX)});
  nwr["service:vehicle:ceramic_coating"](${bbox(RIYADH_BBOX)});
  nwr["service:vehicle:ceramic_coating"](${bbox(JEDDAH_BBOX)});
  nwr["service:vehicle:paint_protection"](${bbox(RIYADH_BBOX)});
  nwr["service:vehicle:paint_protection"](${bbox(JEDDAH_BBOX)});
  nwr["car_wash:detailing"](${bbox(RIYADH_BBOX)});
  nwr["car_wash:detailing"](${bbox(JEDDAH_BBOX)});
);
out meta center;` as const;

export const SOURCE_POLICY_V1 = Object.freeze({
  endpoint: OVERPASS_ENDPOINT,
  method: "POST",
  timeoutMs: 30_000,
  maxResponseBytes: MAX_RESPONSE_BYTES,
  maxCandidates: MAX_CANDIDATES,
  redirects: "DENY",
  outputBase: ".var/pilot/discovery",
});
export const QUERY_DIGEST = sha256Hex(OVERPASS_QUERY);
export const SOURCE_POLICY_DIGEST = sha256Hex(canonicalSerialize(SOURCE_POLICY_V1));
export const COHORT_DIGEST = sha256Hex(canonicalSerialize(FROZEN_COHORT));

const TOP_LEVEL_KEYS = new Set(["elements", "generator", "osm3s", "version"]);
const ELEMENT_KEYS = new Set([
  "center",
  "changeset",
  "id",
  "lat",
  "lon",
  "members",
  "nodes",
  "tags",
  "timestamp",
  "type",
  "uid",
  "user",
  "version",
]);
const SOURCE_TAGS = new Set([
  "amenity",
  "brand",
  "car_wash:detailing",
  "contact:phone",
  "contact:website",
  "contact:whatsapp",
  "craft",
  "description",
  "description:ar",
  "description:en",
  "name",
  "name:ar",
  "name:en",
  "network",
  "operator",
  "phone",
  "service",
  "service:vehicle:ceramic_coating",
  "service:vehicle:detailing",
  "service:vehicle:paint_protection",
  "shop",
  "website",
  "whatsapp",
]);
const PREMIUM_ENGLISH =
  /\b(?:detail(?:ing)?|ceramic(?: coating)?|coating|ppf|paint correction|paint protection|car care|nano(?: coating)?|polish(?:ing)?)\b/i;
export const PREMIUM_ARABIC_KEYWORDS = Object.freeze([
  "تلميع",
  "تفصيل",
  "سيراميك",
  "كوتينج",
  "حماية",
  "عناية السيارات",
  "بي بي اف",
]);
export const PREMIUM_ENGLISH_KEYWORDS = Object.freeze([
  "detailing",
  "ceramic coating",
  "ppf",
  "paint correction",
  "paint protection",
  "car care",
  "nano coating",
  "polishing",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKnownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every(
    (key) =>
      allowed.has(key) && key !== "__proto__" && key !== "constructor" && key !== "prototype",
  );
}

function safeText(value: unknown, maximum = 8_192): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}

function canonicalTimestamp(value: unknown): string | null {
  const candidate = safeText(value, 64);
  if (candidate === null || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(candidate)) {
    return null;
  }
  const milliseconds = Date.parse(candidate);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}

function publicHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower.includes(".") &&
    !lower.endsWith(".") &&
    !/^(?:localhost|0\.|10\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.(?:0\.|168\.)|198\.(?:1[89]\.|51\.100\.)|203\.0\.113\.|(?:22[4-9]|23\d|24\d|25[0-5])\.)/i.test(
      lower,
    ) &&
    !/(?:^|\.)(?:local|internal|localhost|lan|home|invalid|test|example|onion|arpa)$/i.test(
      lower,
    ) &&
    !/^(?:[a-z0-9-]+\.)*example\.(?:com|net|org)$/i.test(lower)
  );
}

function normalizeWebsite(value: unknown): { url: string; domain: string } | null {
  const candidate = safeText(value, 2_048);
  if (candidate === null) return null;
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== "" ||
      !publicHostname(parsed.hostname)
    ) {
      return null;
    }
    for (const key of [...parsed.searchParams.keys()]) {
      const decoded = decodeURIComponent(key.replaceAll("+", " ")).toLowerCase();
      if (decoded === "gclid" || decoded === "fbclid" || decoded.startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return { url: parsed.href, domain };
  } catch {
    return null;
  }
}

function normalizePhone(value: unknown): string | null {
  const candidate = safeText(value, 64);
  if (candidate === null) return null;
  const compact = candidate.replace(/[\s().-]+/g, "");
  if (/^05\d{8}$/.test(compact)) return `+966${compact.slice(1)}`;
  return /^\+9665\d{8}$/.test(compact) ? compact : null;
}

function cityFor(lat: number, lon: number): "Riyadh" | "Jeddah" | null {
  for (const box of [RIYADH_BBOX, JEDDAH_BBOX]) {
    if (lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east) {
      return box.label;
    }
  }
  return null;
}

export interface ParsedElement {
  readonly rawIndex: number;
  readonly osmType: "node" | "way" | "relation";
  readonly osmId: number;
  readonly osmVersion: number;
  readonly osmTimestamp: string;
  readonly osmChangeset: number;
  readonly lat: number;
  readonly lon: number;
  readonly city: "Riyadh" | "Jeddah";
  readonly name: string;
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly website: string | null;
  readonly websiteDomain: string | null;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly sourceTags: Readonly<Record<string, string>>;
}

export interface ParseOverpassResult {
  readonly ok: true;
  readonly rawCount: number;
  readonly elements: readonly ParsedElement[];
  readonly rejections: readonly Readonly<{
    rawIndex: number;
    disposition: "PARSER_REJECTED";
    reason: string;
  }>[];
  readonly osmBaseTimestamp: string;
}

function parseElement(value: unknown, rawIndex: number): ParsedElement | string {
  if (!isRecord(value) || !exactKnownKeys(value, ELEMENT_KEYS)) return "MALFORMED_ELEMENT";
  if (
    (value.type !== "node" && value.type !== "way" && value.type !== "relation") ||
    !Number.isSafeInteger(value.id) ||
    Number(value.id) <= 0 ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) <= 0 ||
    !Number.isSafeInteger(value.changeset) ||
    Number(value.changeset) <= 0
  ) {
    return "INVALID_SOURCE_IDENTITY";
  }
  const timestamp = canonicalTimestamp(value.timestamp);
  if (timestamp === null) return "INVALID_SOURCE_TIMESTAMP";
  const location =
    value.type === "node"
      ? { lat: value.lat, lon: value.lon }
      : isRecord(value.center)
        ? value.center
        : null;
  if (
    location === null ||
    typeof location.lat !== "number" ||
    !Number.isFinite(location.lat) ||
    typeof location.lon !== "number" ||
    !Number.isFinite(location.lon)
  ) {
    return "MISSING_LOCATION";
  }
  const city = cityFor(location.lat, location.lon);
  if (city === null) return "OUTSIDE_COHORT";
  if (!isRecord(value.tags) || Object.keys(value.tags).length > 64) return "INVALID_TAGS";
  const sourceTags: Record<string, string> = {};
  for (const [key, tagValue] of Object.entries(value.tags)) {
    if (
      key.length === 0 ||
      key.length > 128 ||
      typeof tagValue !== "string" ||
      tagValue.length > 8_192
    ) {
      return "INVALID_TAGS";
    }
    if (SOURCE_TAGS.has(key)) sourceTags[key] = tagValue.normalize("NFC").trim();
  }
  const name = safeText(sourceTags.name ?? sourceTags["name:ar"] ?? sourceTags["name:en"], 256);
  if (name === null) return "MISSING_NAME";
  const websiteRoute = normalizeWebsite(sourceTags.website ?? sourceTags["contact:website"]);
  const phone = normalizePhone(sourceTags.phone ?? sourceTags["contact:phone"]);
  const whatsapp = normalizePhone(sourceTags.whatsapp ?? sourceTags["contact:whatsapp"]);
  return Object.freeze({
    rawIndex,
    osmType: value.type,
    osmId: Number(value.id),
    osmVersion: Number(value.version),
    osmTimestamp: timestamp,
    osmChangeset: Number(value.changeset),
    lat: location.lat,
    lon: location.lon,
    city,
    name,
    nameAr: safeText(sourceTags["name:ar"], 256),
    nameEn: safeText(sourceTags["name:en"], 256),
    website: websiteRoute?.url ?? null,
    websiteDomain: websiteRoute?.domain ?? null,
    phone,
    whatsapp,
    sourceTags: Object.freeze(sourceTags),
  });
}

function decodeInput(input: string | Uint8Array): string | null {
  if (typeof input === "string") {
    return Buffer.byteLength(input, "utf8") <= MAX_RESPONSE_BYTES ? input : null;
  }
  if (!(input instanceof Uint8Array) || input.byteLength > MAX_RESPONSE_BYTES) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    return null;
  }
}

export function parseOverpassResponse(
  input: string | Uint8Array,
): ParseOverpassResult | Readonly<{ ok: false; reason: string }> {
  const text = decodeInput(input);
  if (text === null) return Object.freeze({ ok: false, reason: "INVALID_UTF8_OR_SIZE" });
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return Object.freeze({ ok: false, reason: "INVALID_JSON" });
  }
  if (
    !isRecord(decoded) ||
    !exactKnownKeys(decoded, TOP_LEVEL_KEYS) ||
    typeof decoded.version !== "number" ||
    typeof decoded.generator !== "string" ||
    !isRecord(decoded.osm3s) ||
    !Array.isArray(decoded.elements) ||
    decoded.elements.length > 5_000
  ) {
    return Object.freeze({ ok: false, reason: "INVALID_OVERPASS_DOCUMENT" });
  }
  const osmBaseTimestamp = canonicalTimestamp(decoded.osm3s.timestamp_osm_base);
  if (osmBaseTimestamp === null) {
    return Object.freeze({ ok: false, reason: "INVALID_OSM_TIMESTAMP" });
  }
  const elements: ParsedElement[] = [];
  const rejections: Array<{ rawIndex: number; disposition: "PARSER_REJECTED"; reason: string }> =
    [];
  for (let index = 0; index < decoded.elements.length; index += 1) {
    const parsed = parseElement(decoded.elements[index], index);
    if (typeof parsed === "string") {
      rejections.push({ rawIndex: index, disposition: "PARSER_REJECTED", reason: parsed });
    } else {
      elements.push(parsed);
    }
  }
  return Object.freeze({
    ok: true,
    rawCount: decoded.elements.length,
    elements: Object.freeze(elements),
    rejections: Object.freeze(rejections),
    osmBaseTimestamp,
  });
}

export interface EligibilityEvidence {
  readonly tag: string;
  readonly value: string;
  readonly keyword: string;
}

export type EligibilityDecision =
  | Readonly<{
      eligible: true;
      reason: "EXPLICIT_PREMIUM_EVIDENCE";
      evidence: readonly EligibilityEvidence[];
    }>
  | Readonly<{ eligible: false; reason: string; evidence: readonly EligibilityEvidence[] }>;

function premiumEvidence(element: ParsedElement): EligibilityEvidence[] {
  const evidence: EligibilityEvidence[] = [];
  for (const tag of [
    "name",
    "name:ar",
    "name:en",
    "service",
    "description",
    "description:ar",
    "description:en",
  ]) {
    const value = element.sourceTags[tag];
    if (value === undefined) continue;
    const english = value.match(PREMIUM_ENGLISH)?.[0];
    if (english !== undefined) evidence.push({ tag, value, keyword: english.toLowerCase() });
    for (const keyword of PREMIUM_ARABIC_KEYWORDS) {
      if (value.includes(keyword)) evidence.push({ tag, value, keyword });
    }
  }
  for (const tag of [
    "service:vehicle:detailing",
    "service:vehicle:ceramic_coating",
    "service:vehicle:paint_protection",
    "car_wash:detailing",
  ]) {
    if (element.sourceTags[tag] === "yes") {
      evidence.push({ tag, value: "yes", keyword: tag });
    }
  }
  return evidence;
}

export function evaluateEligibility(element: ParsedElement): EligibilityDecision {
  const evidence = premiumEvidence(element);
  if (evidence.length === 0) {
    return Object.freeze({ eligible: false, reason: "NO_EXPLICIT_PREMIUM_EVIDENCE", evidence });
  }
  const tags = element.sourceTags;
  const automotive =
    tags.shop === "car_repair" ||
    tags.shop === "car" ||
    tags.shop === "car_parts" ||
    tags.amenity === "car_wash" ||
    tags.craft === "car_body_repairer" ||
    evidence.some((item) => item.tag.includes(":"));
  if (!automotive) {
    return Object.freeze({ eligible: false, reason: "NO_AUTOMOTIVE_CONTEXT", evidence });
  }
  if (element.website === null && element.phone === null && element.whatsapp === null) {
    return Object.freeze({ eligible: false, reason: "NO_VALID_PUBLIC_ROUTE", evidence });
  }
  return Object.freeze({ eligible: true, reason: "EXPLICIT_PREMIUM_EVIDENCE", evidence });
}

export interface NormalizedCandidate {
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly name: string;
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly city: "Riyadh" | "Jeddah";
  readonly lat: number;
  readonly lon: number;
  readonly website: string | null;
  readonly websiteDomain: string | null;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly independence: "UNKNOWN";
  readonly sourceTags: Readonly<Record<string, string>>;
  readonly eligibilityEvidence: readonly EligibilityEvidence[];
  readonly sourceObservedAt: string;
  readonly retrievedAt: string;
  readonly rawCaptureHash: string;
  readonly candidateHash: string;
}

export type ProcessDiscoveryResult =
  | Readonly<{
      ok: true;
      candidates: readonly NormalizedCandidate[];
      dispositions: readonly Readonly<Record<string, unknown>>[];
      report: Readonly<Record<string, unknown>>;
      rawHash: string;
      candidatesHash: string;
      reportHash: string;
      captureHash: string;
      osmBaseTimestamp: string;
      observationTime: string;
    }>
  | Readonly<{ ok: false; reason: string }>;

function chainSignal(element: ParsedElement): boolean {
  return ["brand", "operator", "network"].some((key) => safeText(element.sourceTags[key]) !== null);
}

function candidateFrom(
  element: ParsedElement,
  evidence: readonly EligibilityEvidence[],
  retrievedAt: string,
  sourceObservedAt: string,
  rawCaptureHash: string,
): NormalizedCandidate {
  const stable = {
    sourceId: `osm-${element.osmType}-${element.osmId}`,
    sourceUrl: `https://www.openstreetmap.org/${element.osmType}/${element.osmId}`,
    name: element.name,
    nameAr: element.nameAr,
    nameEn: element.nameEn,
    city: element.city,
    lat: element.lat,
    lon: element.lon,
    website: element.website,
    websiteDomain: element.websiteDomain,
    phone: element.phone,
    whatsapp: element.whatsapp,
    independence: "UNKNOWN" as const,
    sourceTags: element.sourceTags,
    eligibilityEvidence: evidence,
  };
  return Object.freeze({
    ...stable,
    sourceObservedAt,
    retrievedAt,
    rawCaptureHash,
    candidateHash: sha256Hex(canonicalSerialize(stable)),
  });
}

function missingRate(count: number, total: number): number | null {
  return total === 0 ? null : count / total;
}

export function processDiscoveryFixture(
  input: string | Uint8Array,
  observationTime: string,
): ProcessDiscoveryResult {
  const retrievedAt = canonicalTimestamp(observationTime);
  if (retrievedAt === null) return Object.freeze({ ok: false, reason: "INVALID_OBSERVATION_TIME" });
  const rawText = decodeInput(input);
  if (rawText === null) return Object.freeze({ ok: false, reason: "INVALID_UTF8_OR_SIZE" });
  const rawBytes = new TextEncoder().encode(rawText);
  const rawHash = sha256Hex(rawBytes);
  const parsed = parseOverpassResponse(rawBytes);
  if (!parsed.ok) return parsed;

  const dispositions: Array<Record<string, unknown>> = [...parsed.rejections];
  const eligible: Array<{ element: ParsedElement; evidence: readonly EligibilityEvidence[] }> = [];
  let mechanicallyEligible = 0;
  for (const element of parsed.elements) {
    const decision = evaluateEligibility(element);
    if (!decision.eligible) {
      dispositions.push({
        rawIndex: element.rawIndex,
        disposition: "INELIGIBLE",
        reason: decision.reason,
      });
    } else {
      mechanicallyEligible += 1;
      if (chainSignal(element)) {
        dispositions.push({
          rawIndex: element.rawIndex,
          disposition: "HELD",
          reason: "CHAIN_OR_OPERATOR_REVIEW_REQUIRED",
        });
      } else {
        eligible.push({ element, evidence: decision.evidence });
      }
    }
  }
  eligible.sort((left, right) => {
    const leftId = `${left.element.osmType}-${left.element.osmId}`;
    const rightId = `${right.element.osmType}-${right.element.osmId}`;
    return leftId.localeCompare(rightId);
  });
  const seen = new Set<string>();
  const deduplicated: typeof eligible = [];
  for (const item of eligible) {
    const sourceId = `${item.element.osmType}-${item.element.osmId}`;
    const identity = `${item.element.city}|${item.element.name.toLowerCase()}|${
      item.element.websiteDomain ?? "NO_DOMAIN"
    }`;
    if (seen.has(sourceId) || seen.has(identity)) {
      dispositions.push({
        rawIndex: item.element.rawIndex,
        disposition: "EXACT_DUPLICATE_REMOVED",
        reason: "DUPLICATE_SOURCE_OR_IDENTITY",
      });
    } else {
      seen.add(sourceId);
      seen.add(identity);
      deduplicated.push(item);
    }
  }
  deduplicated.sort((left, right) => {
    const city = left.element.city.localeCompare(right.element.city);
    if (city !== 0) return city;
    const name = left.element.name.localeCompare(right.element.name, ["ar", "en"]);
    if (name !== 0) return name;
    return left.element.osmId - right.element.osmId;
  });
  const selectedWork = deduplicated.slice(0, MAX_CANDIDATES);
  for (const item of selectedWork) {
    dispositions.push({
      rawIndex: item.element.rawIndex,
      disposition: "SELECTED",
      reason: "ELIGIBLE_WITH_PUBLIC_ROUTE",
    });
  }
  for (const item of deduplicated.slice(MAX_CANDIDATES)) {
    dispositions.push({
      rawIndex: item.element.rawIndex,
      disposition: "ELIGIBLE_OVER_CAP",
      reason: "MAX_CANDIDATE_CAP",
    });
  }
  dispositions.sort((left, right) => Number(left.rawIndex) - Number(right.rawIndex));
  const candidates = selectedWork.map((item) =>
    candidateFrom(item.element, item.evidence, retrievedAt, parsed.osmBaseTimestamp, rawHash),
  );
  const candidatesHash = sha256Hex(canonicalSerialize(candidates));
  const counts = {
    raw: parsed.rawCount,
    parserRejected: dispositions.filter((item) => item.disposition === "PARSER_REJECTED").length,
    ineligible: dispositions.filter((item) => item.disposition === "INELIGIBLE").length,
    duplicateRemoved: dispositions.filter((item) => item.disposition === "EXACT_DUPLICATE_REMOVED")
      .length,
    held: dispositions.filter((item) => item.disposition === "HELD").length,
    selected: candidates.length,
    capExcluded: dispositions.filter((item) => item.disposition === "ELIGIBLE_OVER_CAP").length,
  };
  if (
    Object.values(counts)
      .slice(1)
      .reduce((sum, value) => sum + value, 0) !== counts.raw
  ) {
    return Object.freeze({ ok: false, reason: "RECONCILIATION_FAILURE" });
  }
  const exclusions: Record<string, number> = {};
  for (const item of dispositions) {
    if (item.disposition === "SELECTED") continue;
    const reason = String(item.reason);
    exclusions[reason] = (exclusions[reason] ?? 0) + 1;
  }
  const withWebsites = candidates.filter((candidate) => candidate.website !== null).length;
  const withRoutes = candidates.filter(
    (candidate) =>
      candidate.website !== null || candidate.phone !== null || candidate.whatsapp !== null,
  ).length;
  const report = {
    schemaVersion: SCHEMA_VERSION,
    rawRecordCount: parsed.rawCount,
    parsedRecordCount: parsed.elements.length,
    eligibleCandidateCount: mechanicallyEligible,
    selectedCount: candidates.length,
    duplicateCount: counts.duplicateRemoved,
    exclusionCountsByReason: exclusions,
    candidatesWithWebsites: withWebsites,
    candidatesWithoutWebsites: candidates.length - withWebsites,
    candidatesWithPublicBusinessRoute: withRoutes,
    missingFieldRates: {
      nameAr: missingRate(
        candidates.filter((candidate) => candidate.nameAr === null).length,
        candidates.length,
      ),
      nameEn: missingRate(
        candidates.filter((candidate) => candidate.nameEn === null).length,
        candidates.length,
      ),
      website: missingRate(candidates.length - withWebsites, candidates.length),
      phone: missingRate(
        candidates.filter((candidate) => candidate.phone === null).length,
        candidates.length,
      ),
      whatsapp: missingRate(
        candidates.filter((candidate) => candidate.whatsapp === null).length,
        candidates.length,
      ),
    },
    source: {
      provider: "OpenStreetMap",
      endpoint: OVERPASS_ENDPOINT,
      querySha256: QUERY_DIGEST,
      retrievedAt,
      sourceTimestamp: parsed.osmBaseTimestamp,
      rawSha256: rawHash,
      normalizedSha256: candidatesHash,
    },
    reconciliation: counts,
    sourceSufficiency: {
      sufficientForNextStage: false,
      verdict: "REVIEWED_IMPORT_REQUIRED",
      criteria: {
        credibleActiveBusinesses: { minimum: 15, observed: "UNKNOWN", met: false },
        ownedWebsiteOrConfirmedAbsence: {
          minimum: 10,
          observed: 0,
          osmWebsitePointers: withWebsites,
          met: false,
        },
        plausibleWebsiteOpportunity: { minimum: 8, observed: "UNKNOWN", met: false },
      },
      reasons: [
        "OSM_DOES_NOT_VERIFY_ACTIVE_OPERATION",
        "OSM_WEBSITE_TAGS_DO_NOT_PROVE_OWNERSHIP",
        "MISSING_OSM_WEBSITE_TAG_DOES_NOT_CONFIRM_ABSENCE",
        "WEBSITE_OPPORTUNITY_REQUIRES_OPENED_SOURCE_REVIEW",
      ],
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
    captureHash: sha256Hex(
      canonicalSerialize({ rawHash, candidatesHash, reportHash, observationTime: retrievedAt }),
    ),
    osmBaseTimestamp: parsed.osmBaseTimestamp,
    observationTime: retrievedAt,
  });
}
