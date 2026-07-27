export const domainStatus = {
  phase: "bootstrap",
  stateMachineImplemented: false,
} as const;

export const LEAD_STATUSES = Object.freeze([
  "DISCOVERED",
  "VALIDATING",
  "REJECTED",
  "QUALIFIED",
  "AWAITING_APPROVAL",
  "APPROVED_FOR_OUTREACH",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "PREVIEW_PLANNED",
  "PREVIEW_IN_PROGRESS",
  "PREVIEW_REVIEW",
  "PREVIEW_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
  "DO_NOT_CONTACT",
  "FOLLOW_UP_LATER",
] as const);

export type LeadStatus = (typeof LEAD_STATUSES)[number];
