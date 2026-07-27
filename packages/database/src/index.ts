const freeze = Object.freeze;

export const PILOT_TABLES = freeze([
  "businesses",
  "contacts",
  "websites",
  "lead_evidence",
  "audit_findings",
  "lead_scores",
  "outreach_drafts",
  "approvals",
  "contact_attempts",
  "suppressions",
  "activity_events",
] as const);

export type PilotTable = (typeof PILOT_TABLES)[number];

export const CONTACT_ROUTE_TYPES = freeze(["EMAIL", "PHONE", "CONTACT_FORM", "OTHER"] as const);
export type ContactRouteType = (typeof CONTACT_ROUTE_TYPES)[number];

export const PILOT_LANGUAGES = freeze(["de", "en", "ar"] as const);
export type PilotLanguage = (typeof PILOT_LANGUAGES)[number];

export const LEAD_EVIDENCE_SIGNAL_TYPES = freeze([
  "PUBLIC_LISTING",
  "RECENT_REVIEW",
  "OPENING_HOURS",
  "SOCIAL_ACTIVITY",
  "WEBSITE_UPDATE",
  "PORTFOLIO_PROJECT",
  "CONTACT_VALIDATION",
  "WEBSITE_OBSERVATION",
  "OTHER",
] as const);
export type LeadEvidenceSignalType = (typeof LEAD_EVIDENCE_SIGNAL_TYPES)[number];

export const AUDIT_FINDING_CATEGORIES = freeze([
  "MOBILE_USABILITY",
  "HOMEPAGE_CLARITY",
  "LOADING_PERFORMANCE",
  "HTTPS_TECHNICAL",
  "CTA_CONTACT",
  "SERVICE_PRESENTATION",
  "TRUST_SIGNALS",
  "SEO_FUNDAMENTALS",
  "BROKEN_INTERACTIONS",
  "CONVERSION_PATH",
] as const);
export type AuditFindingCategory = (typeof AUDIT_FINDING_CATEGORIES)[number];

export const APPROVAL_ACTIONS = freeze(["LEAD_APPROVAL", "DRAFT_APPROVAL"] as const);
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const APPROVAL_STATUSES = freeze(["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const);
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const CONTACT_ATTEMPT_STATUSES = freeze([
  "INTENT",
  "ACCEPTED",
  "RECONCILED",
  "FAILED",
  "UNCERTAIN",
] as const);
export type ContactAttemptStatus = (typeof CONTACT_ATTEMPT_STATUSES)[number];

export const SUPPRESSION_SCOPE_TYPES = freeze(["CONTACT", "BUSINESS", "DOMAIN", "GLOBAL"] as const);
export type SuppressionScopeType = (typeof SUPPRESSION_SCOPE_TYPES)[number];

export const ACTIVITY_EVENT_TYPES = freeze([
  "BUSINESS_DISCOVERED",
  "EVIDENCE_OBSERVED",
  "AUDIT_FINDING_RECORDED",
  "LEAD_SCORED",
  "DRAFT_CREATED",
  "APPROVAL_REQUESTED",
  "APPROVAL_DECIDED",
  "CONTACT_ATTEMPTED",
  "CONTACT_RECONCILED",
  "SUPPRESSION_RECORDED",
] as const);
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];
