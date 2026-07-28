export { canonicalSerialize, sha256Hex } from "./canonical.ts";
export {
  COHORT_DIGEST,
  FROZEN_COHORT,
  JEDDAH_BBOX,
  MAX_CANDIDATES,
  MAX_RESPONSE_BYTES,
  OSM_ATTRIBUTION,
  OSM_LICENSE_URL,
  OVERPASS_ENDPOINT,
  OVERPASS_QUERY,
  PREMIUM_ARABIC_KEYWORDS,
  PREMIUM_ENGLISH_KEYWORDS,
  QUERY_DIGEST,
  RIYADH_BBOX,
  SCHEMA_VERSION,
  SOURCE_POLICY_DIGEST,
  SOURCE_POLICY_V1,
  USER_AGENT,
  evaluateEligibility,
  parseOverpassResponse,
  processDiscoveryFixture,
} from "./model.ts";
export { runLiveDiscovery } from "./runner.ts";
export {
  MANUAL_IMPORT_MAX_CANDIDATES,
  MANUAL_IMPORT_SCHEMA_VERSION,
  processManualImport,
} from "./manual.ts";
export type {
  EligibilityDecision,
  EligibilityEvidence,
  NormalizedCandidate,
  ParsedElement,
  ParseOverpassResult,
  ProcessDiscoveryResult,
} from "./model.ts";
export type {
  DiscoveryDependencies,
  LiveDiscoveryResult,
  NetworkPlan,
  StreamingResponse,
} from "./runner.ts";
export type { ManualCandidate, ManualImportResult } from "./manual.ts";
