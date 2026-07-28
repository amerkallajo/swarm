import type { AUDIT_FINDING_CATEGORIES, CONTACT_ROUTE_TYPES } from "@swarm/database";

export type ExactChannel = (typeof CONTACT_ROUTE_TYPES)[number];
export type AuditCategory = (typeof AUDIT_FINDING_CATEGORIES)[number];
export type DraftLanguage = "ar" | "en";

export interface AuditFindingInput {
  readonly category: AuditCategory;
  readonly observedFact: string;
  readonly evidenceSourceUrl: string;
  readonly businessImpact: string;
  readonly recommendedImprovement: string;
  readonly confidence: number;
}

export interface AuditBusinessInput {
  readonly sourceId: string;
  readonly language: DraftLanguage;
  readonly observedAt: string;
  readonly findings: readonly AuditFindingInput[];
}

export interface AuditImportDocument {
  readonly schemaVersion: "1.0.0";
  readonly businesses: readonly AuditBusinessInput[];
}

export interface ValidationSummary {
  readonly inputCandidates: number;
  readonly businesses: number;
  readonly websites: number;
  readonly contacts: number;
  readonly evidenceRecords: number;
  readonly idempotent: boolean;
  readonly validatedAt: string;
}

export interface AuditSummary {
  readonly businessesAudited: number;
  readonly findings: number;
  readonly observedAt: string;
}

export interface ScoreSummary {
  readonly scored: number;
  readonly qualified: number;
  readonly topFive: readonly RankedLead[];
  readonly scoredAt: string;
}

export interface RankedLead {
  readonly businessId: string;
  readonly name: string;
  readonly city: string;
  readonly totalScore: number;
  readonly findingCount: number;
}

export interface DraftSummary {
  readonly drafted: number;
  readonly drafts: readonly DraftPreview[];
  readonly createdAt: string;
}

export interface DraftPreview {
  readonly businessId: string;
  readonly business: string;
  readonly channel: ExactChannel;
  readonly recipientHash: string;
  readonly recipient: string;
  readonly language: DraftLanguage;
  readonly subject: string | null;
  readonly body: string;
  readonly payloadHash: string;
}
