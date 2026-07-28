import { createHash } from "node:crypto";

import type { PGlite, Transaction } from "@electric-sql/pglite";
import { canonicalSerialize, sha256Hex } from "@swarm/discovery";
import type { ManualCandidate } from "@swarm/discovery";
import {
  AUDIT_FINDING_CATEGORIES,
  CONTACT_ROUTE_TYPES,
  type ContactRouteType,
} from "@swarm/database";

import type {
  AuditBusinessInput,
  AuditCategory,
  AuditImportDocument,
  AuditSummary,
  DraftLanguage,
  DraftPreview,
  DraftSummary,
  RankedLead,
  ScoreSummary,
  ValidationSummary,
} from "./types.ts";

const AUDIT_CATEGORIES = new Set<string>(AUDIT_FINDING_CATEGORIES);
const CHANNELS = new Set<string>(CONTACT_ROUTE_TYPES);
const PILOT_SCORING_VERSION = "pilot-v1";
const SOURCE_PROVIDER = "REVIEWED_MANUAL_IMPORT";

type SqlClient = PGlite | Transaction;

interface CountRow {
  count: number;
}

interface BusinessRow {
  id: string;
  name: string;
  city: string;
}

interface WebsiteRow {
  id: string;
}

interface ScoreInputRow extends BusinessRow {
  finding_count: number;
  category_count: number;
  average_confidence: number;
  listing_evidence_id: string;
  website_evidence_id: string;
  contact_evidence_id: string;
}

interface ExistingScoreRow {
  active_business_score: number;
  active_business_evidence_id: string;
  website_opportunity_score: number;
  website_opportunity_evidence_id: string;
  commercial_fit_score: number;
  commercial_fit_evidence_id: string;
  contactability_score: number;
  contactability_evidence_id: string;
  personalization_score: number;
  personalization_evidence_id: string;
  response_likelihood_score: number;
  response_likelihood_evidence_id: string;
  total_score: number;
  explanation: string;
}

interface DraftInputRow extends BusinessRow {
  total_score: number;
  contact_id: string;
  route_type: ContactRouteType;
  route_value: string;
  recipient_hash: string;
  language: string;
  observed_problem: string;
}

function hash(value: unknown): string {
  return sha256Hex(canonicalSerialize(value));
}

export function deterministicUuid(label: string): string {
  const value = createHash("sha256").update(label).digest("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-8${value.slice(
    17,
    20,
  )}-${value.slice(20, 32)}`;
}

function exactChannel(kind: ManualCandidate["contactKind"]): ContactRouteType {
  if (kind === "WEBSITE_FORM") return "CONTACT_FORM";
  if (CHANNELS.has(kind)) return kind as ContactRouteType;
  throw new Error(`Unsupported contact channel: ${kind}`);
}

async function count(client: SqlClient, table: string): Promise<number> {
  const result = await client.query<CountRow>(`SELECT count(*)::integer AS count FROM ${table}`);
  return result.rows[0]?.count ?? 0;
}

async function insertValidationCandidate(
  client: Transaction,
  candidate: ManualCandidate,
  actor: string,
): Promise<void> {
  const identityHash = hash({
    city: candidate.city.normalize("NFC").toLocaleLowerCase("und"),
    countryCode: "SA",
    name: candidate.name.normalize("NFC").toLocaleLowerCase("und"),
  });
  const businessId = deterministicUuid(`business:${SOURCE_PROVIDER}:${candidate.sourceId}`);
  const channel = exactChannel(candidate.contactKind);
  const contactHash = hash({ channel, route: candidate.contactRoute });
  const contactId = deterministicUuid(`contact:${businessId}:${contactHash}`);
  const websiteId =
    candidate.websiteUrl === null
      ? null
      : deterministicUuid(`website:${businessId}:${hash(candidate.websiteUrl)}`);
  const listingEvidenceId = deterministicUuid(`evidence:listing:${candidate.candidateHash}`);
  const contactEvidenceId = deterministicUuid(`evidence:contact:${candidate.candidateHash}`);
  const opportunityEvidenceId =
    websiteId === null
      ? null
      : deterministicUuid(`evidence:opportunity:${candidate.candidateHash}`);

  const existingBusiness = await client.query<{ id: string; normalized_identity_hash: string }>(
    `SELECT id, normalized_identity_hash
     FROM businesses
     WHERE source_provider = $1 AND source_record_id = $2`,
    [SOURCE_PROVIDER, candidate.sourceId],
  );
  if (
    existingBusiness.rows[0] !== undefined &&
    (existingBusiness.rows[0].id !== businessId ||
      existingBusiness.rows[0].normalized_identity_hash !== identityHash)
  ) {
    throw new Error(
      `Reviewed business identity changed for ${candidate.sourceId}; use a new source artifact ID.`,
    );
  }

  await client.query(
    `INSERT INTO businesses
       (id, name, source_url, source_provider, source_record_id, category, city, region,
        country_code, preferred_language, normalized_identity_hash, collected_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'SA', 'unknown', $8, $9)
     ON CONFLICT DO NOTHING`,
    [
      businessId,
      candidate.name,
      candidate.evidence.identitySourceUrl,
      SOURCE_PROVIDER,
      candidate.sourceId,
      candidate.category,
      candidate.city,
      identityHash,
      candidate.observedAt,
    ],
  );

  if (candidate.websiteUrl !== null && websiteId !== null) {
    const parsedWebsite = new URL(candidate.websiteUrl);
    await client.query(
      `INSERT INTO websites
         (id, business_id, url, source_url, normalized_url_hash, normalized_domain_hash,
          observed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        websiteId,
        businessId,
        parsedWebsite.href,
        candidate.evidence.websiteSourceUrl,
        hash(parsedWebsite.href),
        hash(parsedWebsite.hostname.toLowerCase()),
        candidate.observedAt,
      ],
    );
  }

  await client.query(
    `INSERT INTO contacts
       (id, business_id, route_type, route_value, normalized_hash, source_url, observed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    [
      contactId,
      businessId,
      channel,
      candidate.contactRoute,
      contactHash,
      candidate.evidence.contactSourceUrl,
      candidate.observedAt,
    ],
  );

  const listingSummary =
    `Official business source confirms identity, ${candidate.city} location, ` +
    "premium detailing category, active operation, and independent review status.";
  await client.query(
    `INSERT INTO lead_evidence
       (id, business_id, website_id, source_url, observed_at, content_hash, signal_type,
        language, signal_at, review_count, review_rating, latest_review_at, summary, confidence)
     VALUES ($1, $2, NULL, $3, $4, $5, 'PUBLIC_LISTING', 'unknown',
             NULL, NULL, NULL, NULL, $6, 85)
     ON CONFLICT DO NOTHING`,
    [
      listingEvidenceId,
      businessId,
      candidate.evidence.activitySourceUrl,
      candidate.observedAt,
      hash({
        activity: candidate.activityStatus,
        identity: candidate.sourceId,
        independence: candidate.independenceStatus,
      }),
      listingSummary,
    ],
  );

  await client.query(
    `INSERT INTO lead_evidence
       (id, business_id, website_id, source_url, observed_at, content_hash, signal_type,
        language, signal_at, review_count, review_rating, latest_review_at, summary, confidence)
     VALUES ($1, $2, NULL, $3, $4, $5, 'CONTACT_VALIDATION', 'unknown',
             NULL, NULL, NULL, NULL, $6, 90)
     ON CONFLICT DO NOTHING`,
    [
      contactEvidenceId,
      businessId,
      candidate.evidence.contactSourceUrl,
      candidate.observedAt,
      contactHash,
      `A public business ${channel} route was observed on the official source.`,
    ],
  );

  if (
    websiteId !== null &&
    opportunityEvidenceId !== null &&
    candidate.opportunityStatus === "PLAUSIBLE" &&
    candidate.opportunityObservation !== null &&
    candidate.evidence.opportunitySourceUrl !== null
  ) {
    await client.query(
      `INSERT INTO lead_evidence
         (id, business_id, website_id, source_url, observed_at, content_hash, signal_type,
          language, signal_at, review_count, review_rating, latest_review_at, summary, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, 'WEBSITE_OBSERVATION', 'unknown',
               NULL, NULL, NULL, NULL, $7, 85)
       ON CONFLICT DO NOTHING`,
      [
        opportunityEvidenceId,
        businessId,
        websiteId,
        candidate.evidence.opportunitySourceUrl,
        candidate.observedAt,
        hash(candidate.opportunityObservation),
        candidate.opportunityObservation,
      ],
    );
  }

  await client.query(
    `INSERT INTO activity_events
       (id, business_id, event_type, actor, reason, correlation_id, payload, occurred_at)
     VALUES ($1, $2, 'BUSINESS_DISCOVERED', $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT DO NOTHING`,
    [
      deterministicUuid(`event:validated:${candidate.candidateHash}`),
      businessId,
      actor,
      "Reviewed discovery candidate validated into local pilot state.",
      `validation:${candidate.candidateHash}`,
      JSON.stringify({ sourceId: candidate.sourceId, candidateHash: candidate.candidateHash }),
      candidate.observedAt,
    ],
  );
}

export async function validateCandidates(
  client: PGlite,
  candidates: readonly ManualCandidate[],
  actor = "pilot:validate",
): Promise<ValidationSummary> {
  if (candidates.length === 0 || candidates.length > 30) {
    throw new Error("Validation requires between 1 and 30 reviewed candidates.");
  }
  const before = await count(client, "businesses");
  await client.transaction(async (transaction) => {
    for (const candidate of candidates) {
      await insertValidationCandidate(transaction, candidate, actor);
    }
  });
  const businesses = await count(client, "businesses");
  const websites = await count(client, "websites");
  const contacts = await count(client, "contacts");
  const evidenceRecords = await count(client, "lead_evidence");
  if (businesses < candidates.length || contacts < candidates.length) {
    throw new Error("Validation did not persist the complete reviewed cohort.");
  }
  return Object.freeze({
    inputCandidates: candidates.length,
    businesses,
    websites,
    contacts,
    evidenceRecords,
    idempotent: before === businesses,
    validatedAt: new Date().toISOString(),
  });
}

function text(value: unknown, maximum = 2_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}

function publicHttpsUrl(value: unknown): string | null {
  const candidate = text(value, 1_024);
  if (candidate === null) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === ""
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

function exactObjectKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

export function parseAuditImport(input: string): AuditImportDocument {
  let decoded: unknown;
  try {
    decoded = JSON.parse(input);
  } catch {
    throw new Error("Audit import is not valid JSON.");
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("Audit import must be an object.");
  }
  const document = decoded as Record<string, unknown>;
  if (
    !exactObjectKeys(document, ["schemaVersion", "businesses"]) ||
    document.schemaVersion !== "1.0.0" ||
    !Array.isArray(document.businesses) ||
    document.businesses.length === 0 ||
    document.businesses.length > 10
  ) {
    throw new Error("Audit import must contain between 1 and 10 businesses.");
  }
  const sourceIds = new Set<string>();
  let totalFindings = 0;
  const businesses: AuditBusinessInput[] = document.businesses.map((value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Malformed audit business.");
    }
    const business = value as Record<string, unknown>;
    if (
      !exactObjectKeys(business, ["sourceId", "language", "observedAt", "findings"]) ||
      !Array.isArray(business.findings) ||
      business.findings.length === 0 ||
      business.findings.length > 12
    ) {
      throw new Error("Each audit business requires between 1 and 12 findings.");
    }
    const sourceId = text(business.sourceId, 256);
    const language = business.language;
    const observedAt =
      typeof business.observedAt === "string" &&
      Number.isFinite(Date.parse(business.observedAt)) &&
      new Date(business.observedAt).toISOString() === business.observedAt
        ? business.observedAt
        : null;
    if (
      sourceId === null ||
      sourceIds.has(sourceId) ||
      (language !== "ar" && language !== "en") ||
      observedAt === null
    ) {
      throw new Error("Audit business identity, language, or timestamp is invalid.");
    }
    sourceIds.add(sourceId);
    const findings = business.findings.map((findingValue) => {
      if (
        findingValue === null ||
        typeof findingValue !== "object" ||
        Array.isArray(findingValue)
      ) {
        throw new Error("Malformed audit finding.");
      }
      const finding = findingValue as Record<string, unknown>;
      if (
        !exactObjectKeys(finding, [
          "category",
          "observedFact",
          "evidenceSourceUrl",
          "businessImpact",
          "recommendedImprovement",
          "confidence",
        ])
      ) {
        throw new Error("Audit finding fields are invalid.");
      }
      const category = finding.category;
      const observedFact = text(finding.observedFact);
      const evidenceSourceUrl = publicHttpsUrl(finding.evidenceSourceUrl);
      const businessImpact = text(finding.businessImpact);
      const recommendedImprovement = text(finding.recommendedImprovement);
      const confidence = finding.confidence;
      if (
        typeof category !== "string" ||
        !AUDIT_CATEGORIES.has(category) ||
        observedFact === null ||
        evidenceSourceUrl === null ||
        businessImpact === null ||
        recommendedImprovement === null ||
        typeof confidence !== "number" ||
        !Number.isInteger(confidence) ||
        confidence < 0 ||
        confidence > 100
      ) {
        throw new Error("Audit finding content is invalid.");
      }
      totalFindings += 1;
      return Object.freeze({
        category: category as AuditCategory,
        observedFact,
        evidenceSourceUrl,
        businessImpact,
        recommendedImprovement,
        confidence,
      });
    });
    return Object.freeze({
      sourceId,
      language: language as DraftLanguage,
      observedAt,
      findings: Object.freeze(findings),
    });
  });
  if (totalFindings > 60) throw new Error("Audit import exceeds the 60-finding cap.");
  return Object.freeze({
    schemaVersion: "1.0.0",
    businesses: Object.freeze(businesses),
  });
}

export async function recordAudits(
  client: PGlite,
  audit: AuditImportDocument,
  actor = "pilot:audit",
): Promise<AuditSummary> {
  await client.transaction(async (transaction) => {
    for (const reviewedBusiness of audit.businesses) {
      const businessResult = await transaction.query<BusinessRow>(
        `SELECT id, name, city
         FROM businesses
         WHERE source_provider = $1 AND source_record_id = $2`,
        [SOURCE_PROVIDER, reviewedBusiness.sourceId],
      );
      const business = businessResult.rows[0];
      if (business === undefined) {
        throw new Error(`Audit business was not validated: ${reviewedBusiness.sourceId}`);
      }
      const websiteResult = await transaction.query<WebsiteRow>(
        "SELECT id FROM websites WHERE business_id = $1 ORDER BY observed_at DESC LIMIT 1",
        [business.id],
      );
      const website = websiteResult.rows[0];
      if (website === undefined) {
        throw new Error(`Audit business has no validated website: ${reviewedBusiness.sourceId}`);
      }
      for (const finding of reviewedBusiness.findings) {
        const findingHash = hash({
          business: reviewedBusiness.sourceId,
          finding,
          observedAt: reviewedBusiness.observedAt,
        });
        const evidenceId = deterministicUuid(`audit-evidence:${findingHash}`);
        const findingId = deterministicUuid(`audit-finding:${findingHash}`);
        await transaction.query(
          `INSERT INTO lead_evidence
             (id, business_id, website_id, source_url, observed_at, content_hash, signal_type,
              language, signal_at, review_count, review_rating, latest_review_at, summary,
              confidence)
           VALUES ($1, $2, $3, $4, $5, $6, 'WEBSITE_OBSERVATION', $7,
                   NULL, NULL, NULL, NULL, $8, $9)
           ON CONFLICT DO NOTHING`,
          [
            evidenceId,
            business.id,
            website.id,
            finding.evidenceSourceUrl,
            reviewedBusiness.observedAt,
            findingHash,
            reviewedBusiness.language,
            finding.observedFact,
            finding.confidence,
          ],
        );
        await transaction.query(
          `INSERT INTO audit_findings
             (id, business_id, website_id, evidence_id, category, observed_problem,
              why_it_matters, recommended_improvement, confidence, observed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT DO NOTHING`,
          [
            findingId,
            business.id,
            website.id,
            evidenceId,
            finding.category,
            finding.observedFact,
            finding.businessImpact,
            finding.recommendedImprovement,
            finding.confidence,
            reviewedBusiness.observedAt,
          ],
        );
        await transaction.query(
          `INSERT INTO activity_events
             (id, business_id, event_type, actor, reason, correlation_id, payload, occurred_at)
           VALUES ($1, $2, 'AUDIT_FINDING_RECORDED', $3, $4, $5, $6::jsonb, $7)
           ON CONFLICT DO NOTHING`,
          [
            deterministicUuid(`event:audit:${findingHash}`),
            business.id,
            actor,
            "Reviewed website audit finding recorded with exact evidence.",
            `audit:${findingHash}`,
            JSON.stringify({ evidenceId, findingId, category: finding.category }),
            reviewedBusiness.observedAt,
          ],
        );
      }
    }
  });
  const result = await client.query<{ businesses: number; findings: number }>(
    `SELECT
       count(DISTINCT business_id)::integer AS businesses,
       count(*)::integer AS findings
     FROM audit_findings`,
  );
  return Object.freeze({
    businessesAudited: result.rows[0]?.businesses ?? 0,
    findings: result.rows[0]?.findings ?? 0,
    observedAt: new Date().toISOString(),
  });
}

export async function scoreAuditedBusinesses(client: PGlite): Promise<ScoreSummary> {
  const input = await client.query<ScoreInputRow>(
    `SELECT
       b.id,
       b.name,
       b.city,
       count(DISTINCT af.id)::integer AS finding_count,
       count(DISTINCT af.category)::integer AS category_count,
       round(avg(af.confidence))::integer AS average_confidence,
       (
         SELECT le.id FROM lead_evidence le
         WHERE le.business_id = b.id AND le.signal_type = 'PUBLIC_LISTING'
         ORDER BY le.observed_at LIMIT 1
       ) AS listing_evidence_id,
       (
         SELECT le.id FROM lead_evidence le
         WHERE le.business_id = b.id AND le.signal_type = 'WEBSITE_OBSERVATION'
         ORDER BY le.confidence DESC, le.observed_at DESC LIMIT 1
       ) AS website_evidence_id,
       (
         SELECT le.id FROM lead_evidence le
         WHERE le.business_id = b.id AND le.signal_type = 'CONTACT_VALIDATION'
         ORDER BY le.observed_at DESC LIMIT 1
       ) AS contact_evidence_id
     FROM businesses b
     JOIN audit_findings af ON af.business_id = b.id
     GROUP BY b.id, b.name, b.city
     ORDER BY b.name`,
  );
  const scoredAt = new Date().toISOString();
  await client.transaction(async (transaction) => {
    for (const row of input.rows) {
      const activeBusinessScore = 20;
      const websiteOpportunityScore = Math.min(
        25,
        12 + row.category_count * 3 + Math.floor(row.average_confidence / 25),
      );
      const commercialFitScore = 18;
      const contactabilityScore = 15;
      const personalizationScore = 10;
      const responseLikelihoodScore = 0;
      const totalScore =
        activeBusinessScore +
        websiteOpportunityScore +
        commercialFitScore +
        contactabilityScore +
        personalizationScore +
        responseLikelihoodScore;
      const scoreId = deterministicUuid(`score:${PILOT_SCORING_VERSION}:${row.id}`);
      const explanation =
        `Evidence-backed pilot score. ${row.finding_count} audit finding(s) across ` +
        `${row.category_count} category/categories. Response likelihood remains unknown and ` +
        "is scored zero rather than invented.";
      const scoreValues = {
        active_business_score: activeBusinessScore,
        active_business_evidence_id: row.listing_evidence_id,
        website_opportunity_score: websiteOpportunityScore,
        website_opportunity_evidence_id: row.website_evidence_id,
        commercial_fit_score: commercialFitScore,
        commercial_fit_evidence_id: row.listing_evidence_id,
        contactability_score: contactabilityScore,
        contactability_evidence_id: row.contact_evidence_id,
        personalization_score: personalizationScore,
        personalization_evidence_id: row.website_evidence_id,
        response_likelihood_score: responseLikelihoodScore,
        response_likelihood_evidence_id: row.contact_evidence_id,
        total_score: totalScore,
        explanation,
      };
      const existing = await transaction.query<ExistingScoreRow>(
        `SELECT
           active_business_score, active_business_evidence_id,
           website_opportunity_score, website_opportunity_evidence_id,
           commercial_fit_score, commercial_fit_evidence_id,
           contactability_score, contactability_evidence_id,
           personalization_score, personalization_evidence_id,
           response_likelihood_score, response_likelihood_evidence_id,
           total_score, explanation
         FROM lead_scores
         WHERE id = $1`,
        [scoreId],
      );
      if (
        existing.rows[0] !== undefined &&
        canonicalSerialize(existing.rows[0]) !== canonicalSerialize(scoreValues)
      ) {
        throw new Error(
          `Scoring inputs changed for ${row.name}; bump the pilot scoring version before appending.`,
        );
      }
      await transaction.query(
        `INSERT INTO lead_scores
           (id, business_id, scoring_version, overall_confidence,
            active_business_score, active_business_evidence_id,
            website_opportunity_score, website_opportunity_evidence_id,
            commercial_fit_score, commercial_fit_evidence_id,
            contactability_score, contactability_evidence_id,
            personalization_score, personalization_evidence_id,
            response_likelihood_score, response_likelihood_evidence_id,
            total_score, hard_excluded, presentable, explanation, scored_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15, $16, $17, false, $18, $19, $20)
         ON CONFLICT DO NOTHING`,
        [
          scoreId,
          row.id,
          PILOT_SCORING_VERSION,
          Math.min(row.average_confidence, 90),
          activeBusinessScore,
          row.listing_evidence_id,
          websiteOpportunityScore,
          row.website_evidence_id,
          commercialFitScore,
          row.listing_evidence_id,
          contactabilityScore,
          row.contact_evidence_id,
          personalizationScore,
          row.website_evidence_id,
          responseLikelihoodScore,
          row.contact_evidence_id,
          totalScore,
          totalScore >= 65,
          explanation,
          scoredAt,
        ],
      );
      await transaction.query(
        `INSERT INTO activity_events
           (id, business_id, event_type, actor, reason, correlation_id, payload, occurred_at)
         VALUES ($1, $2, 'LEAD_SCORED', 'pilot:score', $3, $4, $5::jsonb, $6)
         ON CONFLICT DO NOTHING`,
        [
          deterministicUuid(`event:score:${PILOT_SCORING_VERSION}:${row.id}`),
          row.id,
          "Evidence-backed pilot score recorded; unknown response likelihood scored zero.",
          `score:${PILOT_SCORING_VERSION}:${row.id}`,
          JSON.stringify({ scoreId, totalScore, scoringVersion: PILOT_SCORING_VERSION }),
          scoredAt,
        ],
      );
    }
  });
  const ranked = await client.query<RankedLead>(
    `SELECT
       b.id AS "businessId",
       b.name,
       b.city,
       ls.total_score AS "totalScore",
       count(af.id)::integer AS "findingCount"
     FROM lead_scores ls
     JOIN businesses b ON b.id = ls.business_id
     JOIN audit_findings af ON af.business_id = b.id
     WHERE ls.scoring_version = $1 AND ls.presentable
     GROUP BY b.id, b.name, b.city, ls.total_score
     ORDER BY ls.total_score DESC, count(af.id) DESC, b.name
     LIMIT 5`,
    [PILOT_SCORING_VERSION],
  );
  const scoredResult = await client.query<CountRow>(
    "SELECT count(*)::integer AS count FROM lead_scores WHERE scoring_version = $1",
    [PILOT_SCORING_VERSION],
  );
  const qualifiedResult = await client.query<CountRow>(
    `SELECT count(*)::integer AS count
     FROM lead_scores WHERE scoring_version = $1 AND presentable`,
    [PILOT_SCORING_VERSION],
  );
  return Object.freeze({
    scored: scoredResult.rows[0]?.count ?? 0,
    qualified: qualifiedResult.rows[0]?.count ?? 0,
    topFive: Object.freeze(ranked.rows.map((row) => Object.freeze(row))),
    scoredAt,
  });
}

function draftBody(language: DraftLanguage, business: string, observation: string): string {
  if (language === "ar") {
    return (
      `مرحباً فريق ${business}، أنا Amer وأعمل على تحسين صفحات المواقع للشركات المحلية. ` +
      `لاحظت في موقعكم أن ${observation} ` +
      "يمكنني إعداد تصور مجاني لإعادة تصميم الصفحة الرئيسية يوضح الخدمات ومسار الحجز بشكل أفضل. " +
      "لا يوجد عقد، ولا دفعة مقدمة، ولا التزام، ولا أي إلزام بالشراء. " +
      "نناقش السعر فقط إذا أعجبكم التصور. إذا لم يكن ذلك مناسباً، يكفي إخباري وسأتوقف عن التواصل. " +
      "هل يناسبكم أن أرسل فكرة أولية؟"
    );
  }
  return (
    `Hello ${business} team — I’m Amer, and I help local businesses improve their website ` +
    `conversion path. I noticed this on your website: ${observation} ` +
    "I can prepare a free homepage redesign concept that makes the services and booking path " +
    "clearer. There is no contract, no upfront payment, no commitment, and no obligation to buy. " +
    "We would discuss pricing only if you like the concept. If it is not relevant, just say so " +
    "and I will not follow up. Would you be open to an initial idea?"
  );
}

export async function createTopDrafts(client: PGlite): Promise<DraftSummary> {
  const inputs = await client.query<DraftInputRow>(
    `SELECT DISTINCT ON (b.id)
       b.id,
       b.name,
       b.city,
       ls.total_score,
       c.id AS contact_id,
       c.route_type,
       c.route_value,
       c.normalized_hash AS recipient_hash,
       le.language,
       af.observed_problem
     FROM lead_scores ls
     JOIN businesses b ON b.id = ls.business_id
     JOIN LATERAL (
       SELECT candidate_contact.*
       FROM contacts candidate_contact
       WHERE candidate_contact.business_id = b.id
       ORDER BY candidate_contact.observed_at DESC, candidate_contact.id DESC
       LIMIT 1
     ) c ON true
     JOIN audit_findings af ON af.business_id = b.id
     JOIN lead_evidence le ON le.id = af.evidence_id
     WHERE ls.scoring_version = $1 AND ls.presentable AND le.language IN ('ar', 'en')
     ORDER BY b.id, af.confidence DESC, af.observed_at DESC, af.id`,
    [PILOT_SCORING_VERSION],
  );
  const ranked = [...inputs.rows]
    .sort(
      (left, right) =>
        right.total_score - left.total_score ||
        left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
    )
    .slice(0, 3);
  const createdAt = new Date().toISOString();
  const drafts: DraftPreview[] = [];
  await client.transaction(async (transaction) => {
    for (const row of ranked) {
      const language = row.language as DraftLanguage;
      const body = draftBody(language, row.name, row.observed_problem);
      const subject =
        row.route_type === "EMAIL"
          ? language === "ar"
            ? "فكرة مجانية لتحسين الصفحة الرئيسية"
            : "A free homepage improvement idea"
          : null;
      const payloadHash = hash({
        body,
        channel: row.route_type,
        recipientHash: row.recipient_hash,
        subject,
      });
      const draftId = deterministicUuid(`draft:${row.id}:${payloadHash}`);
      await transaction.query(
        `INSERT INTO outreach_drafts
           (id, business_id, contact_id, language, channel, recipient_hash, subject, body,
            payload_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING`,
        [
          draftId,
          row.id,
          row.contact_id,
          language,
          row.route_type,
          row.recipient_hash,
          subject,
          body,
          payloadHash,
          createdAt,
        ],
      );
      await transaction.query(
        `INSERT INTO activity_events
           (id, business_id, event_type, actor, reason, correlation_id, payload, occurred_at)
         VALUES ($1, $2, 'DRAFT_CREATED', 'pilot:draft', $3, $4, $5::jsonb, $6)
         ON CONFLICT DO NOTHING`,
        [
          deterministicUuid(`event:draft:${draftId}`),
          row.id,
          "Unsent outreach draft created from approved scoring inputs.",
          `draft:${draftId}`,
          JSON.stringify({ draftId, payloadHash, channel: row.route_type }),
          createdAt,
        ],
      );
      drafts.push(
        Object.freeze({
          businessId: row.id,
          business: row.name,
          channel: row.route_type,
          recipientHash: row.recipient_hash,
          recipient: row.route_value,
          language,
          subject,
          body,
          payloadHash,
        }),
      );
    }
  });
  return Object.freeze({
    drafted: drafts.length,
    drafts: Object.freeze(drafts),
    createdAt,
  });
}

export async function pipelineReport(client: PGlite): Promise<Record<string, unknown>> {
  const tableCounts = await Promise.all(
    [
      "businesses",
      "websites",
      "contacts",
      "lead_evidence",
      "audit_findings",
      "lead_scores",
      "outreach_drafts",
      "contact_attempts",
    ].map(async (table) => [table, await count(client, table)] as const),
  );
  const audited = await client.query<CountRow>(
    "SELECT count(DISTINCT business_id)::integer AS count FROM audit_findings",
  );
  const qualified = await client.query<CountRow>(
    "SELECT count(*)::integer AS count FROM lead_scores WHERE presentable",
  );
  const ranked = await client.query<RankedLead>(
    `SELECT
       b.id AS "businessId", b.name, b.city, ls.total_score AS "totalScore",
       count(af.id)::integer AS "findingCount"
     FROM lead_scores ls
     JOIN businesses b ON b.id = ls.business_id
     JOIN audit_findings af ON af.business_id = b.id
     WHERE ls.presentable
     GROUP BY b.id, b.name, b.city, ls.total_score
     ORDER BY ls.total_score DESC, count(af.id) DESC, b.name
     LIMIT 5`,
  );
  return Object.freeze({
    counts: Object.fromEntries(tableCounts),
    pipeline: {
      discovered: Object.fromEntries(tableCounts).businesses,
      validated: Object.fromEntries(tableCounts).businesses,
      audited: audited.rows[0]?.count ?? 0,
      qualified: qualified.rows[0]?.count ?? 0,
      drafted: Object.fromEntries(tableCounts).outreach_drafts,
      contacted: Object.fromEntries(tableCounts).contact_attempts,
      replied: 0,
      interested: 0,
    },
    topFive: ranked.rows,
    generatedAt: new Date().toISOString(),
  });
}

export type {
  AuditImportDocument,
  AuditSummary,
  DraftPreview,
  DraftSummary,
  ScoreSummary,
  ValidationSummary,
} from "./types.ts";
