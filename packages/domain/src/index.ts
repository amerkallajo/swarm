const freeze = Object.freeze;

export const domainStatus = freeze({
  phase: "foundation",
  stateMachineImplemented: true,
} as const);

export const LEAD_STATUSES = freeze([
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
  "PREVIEW_SEND_APPROVED",
  "PREVIEW_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
  "DO_NOT_CONTACT",
  "FOLLOW_UP_LATER",
] as const);

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_COMMANDS = freeze([
  "START_VALIDATION",
  "QUALIFY_LEAD",
  "REQUEST_OUTREACH_APPROVAL",
  "APPROVE_OUTREACH",
  "RECORD_OUTREACH_SENT",
  "RECORD_MANUAL_OUTREACH_SENT",
  "RECORD_REPLY",
  "MARK_INTERESTED",
  "APPROVE_PREVIEW_CREATION",
  "START_PREVIEW",
  "SUBMIT_PREVIEW_FOR_REVIEW",
  "REQUEST_PREVIEW_CHANGES",
  "APPROVE_PREVIEW_SEND",
  "RECORD_PREVIEW_SENT",
  "START_NEGOTIATION",
  "MARK_WON",
  "MARK_LOST",
  "REJECT_LEAD",
  "RECORD_DO_NOT_CONTACT",
  "DEFER_FOLLOW_UP",
] as const);

export type LeadCommand = (typeof LEAD_COMMANDS)[number];

export const LEAD_ACTORS = freeze([
  "SYSTEM",
  "HUMAN_OPERATOR",
  "HUMAN_APPROVER",
  "PROVIDER",
  "LEAD",
] as const);

export type LeadActor = (typeof LEAD_ACTORS)[number];

export const TERMINAL_LEAD_STATUSES = freeze([
  "REJECTED",
  "WON",
  "LOST",
  "DO_NOT_CONTACT",
] as const satisfies readonly LeadStatus[]);

export type TerminalLeadStatus = (typeof TERMINAL_LEAD_STATUSES)[number];

type InternalTransitionRule = Readonly<{
  from: LeadStatus;
  command: LeadCommand;
  to: LeadStatus;
  actors: readonly LeadActor[];
}>;

export type LeadTransitionRule = Readonly<{
  from: LeadStatus;
  command: LeadCommand;
  to: LeadStatus;
  actors: readonly LeadActor[];
}>;

function rule(
  from: LeadStatus,
  command: LeadCommand,
  to: LeadStatus,
  ...actors: readonly [LeadActor, ...LeadActor[]]
): InternalTransitionRule {
  return freeze({ from, command, to, actors: freeze(actors) });
}

const TRANSITION_RULES = freeze([
  rule("DISCOVERED", "START_VALIDATION", "VALIDATING", "SYSTEM", "HUMAN_OPERATOR"),
  rule("VALIDATING", "QUALIFY_LEAD", "QUALIFIED", "SYSTEM", "HUMAN_OPERATOR"),
  rule("QUALIFIED", "REQUEST_OUTREACH_APPROVAL", "AWAITING_APPROVAL", "SYSTEM", "HUMAN_OPERATOR"),
  rule("AWAITING_APPROVAL", "APPROVE_OUTREACH", "APPROVED_FOR_OUTREACH", "HUMAN_APPROVER"),
  rule("APPROVED_FOR_OUTREACH", "RECORD_OUTREACH_SENT", "CONTACTED", "SYSTEM", "PROVIDER"),
  rule("APPROVED_FOR_OUTREACH", "RECORD_MANUAL_OUTREACH_SENT", "CONTACTED", "HUMAN_OPERATOR"),
  rule("CONTACTED", "RECORD_REPLY", "REPLIED", "SYSTEM", "HUMAN_OPERATOR", "PROVIDER", "LEAD"),
  rule("REPLIED", "MARK_INTERESTED", "INTERESTED", "SYSTEM", "HUMAN_OPERATOR"),
  rule("INTERESTED", "APPROVE_PREVIEW_CREATION", "PREVIEW_PLANNED", "HUMAN_APPROVER"),
  rule("PREVIEW_PLANNED", "START_PREVIEW", "PREVIEW_IN_PROGRESS", "SYSTEM", "HUMAN_OPERATOR"),
  rule(
    "PREVIEW_IN_PROGRESS",
    "SUBMIT_PREVIEW_FOR_REVIEW",
    "PREVIEW_REVIEW",
    "SYSTEM",
    "HUMAN_OPERATOR",
  ),
  rule("PREVIEW_REVIEW", "REQUEST_PREVIEW_CHANGES", "PREVIEW_IN_PROGRESS", "HUMAN_APPROVER"),
  rule("PREVIEW_REVIEW", "APPROVE_PREVIEW_SEND", "PREVIEW_SEND_APPROVED", "HUMAN_APPROVER"),
  rule("PREVIEW_SEND_APPROVED", "RECORD_PREVIEW_SENT", "PREVIEW_SENT", "SYSTEM", "PROVIDER"),
  rule("INTERESTED", "START_NEGOTIATION", "NEGOTIATING", "HUMAN_OPERATOR"),
  rule("PREVIEW_SENT", "START_NEGOTIATION", "NEGOTIATING", "HUMAN_OPERATOR"),
  rule("NEGOTIATING", "MARK_WON", "WON", "HUMAN_OPERATOR"),
  rule("NEGOTIATING", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("REPLIED", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("CONTACTED", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("INTERESTED", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("PREVIEW_PLANNED", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("PREVIEW_IN_PROGRESS", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("PREVIEW_REVIEW", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("PREVIEW_SEND_APPROVED", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("PREVIEW_SENT", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("FOLLOW_UP_LATER", "MARK_LOST", "LOST", "HUMAN_OPERATOR"),
  rule("CONTACTED", "DEFER_FOLLOW_UP", "FOLLOW_UP_LATER", "SYSTEM", "HUMAN_OPERATOR"),
  rule("REPLIED", "DEFER_FOLLOW_UP", "FOLLOW_UP_LATER", "SYSTEM", "HUMAN_OPERATOR"),
  rule(
    "FOLLOW_UP_LATER",
    "REQUEST_OUTREACH_APPROVAL",
    "AWAITING_APPROVAL",
    "SYSTEM",
    "HUMAN_OPERATOR",
  ),
  rule("DISCOVERED", "REJECT_LEAD", "REJECTED", "SYSTEM", "HUMAN_OPERATOR"),
  rule("VALIDATING", "REJECT_LEAD", "REJECTED", "SYSTEM", "HUMAN_OPERATOR"),
  rule("QUALIFIED", "REJECT_LEAD", "REJECTED", "SYSTEM", "HUMAN_OPERATOR"),
  rule("AWAITING_APPROVAL", "REJECT_LEAD", "REJECTED", "HUMAN_APPROVER"),
  rule("APPROVED_FOR_OUTREACH", "REJECT_LEAD", "REJECTED", "HUMAN_OPERATOR", "HUMAN_APPROVER"),
  rule(
    "DISCOVERED",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "VALIDATING",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "QUALIFIED",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "AWAITING_APPROVAL",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "APPROVED_FOR_OUTREACH",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "CONTACTED",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "REPLIED",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "INTERESTED",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "PREVIEW_PLANNED",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "PREVIEW_IN_PROGRESS",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "PREVIEW_REVIEW",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "PREVIEW_SEND_APPROVED",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "PREVIEW_SENT",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "NEGOTIATING",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
  rule(
    "FOLLOW_UP_LATER",
    "RECORD_DO_NOT_CONTACT",
    "DO_NOT_CONTACT",
    "SYSTEM",
    "HUMAN_OPERATOR",
    "PROVIDER",
    "LEAD",
  ),
]);

export const LEAD_TRANSITIONS: readonly LeadTransitionRule[] = freeze(
  TRANSITION_RULES.map((transition) =>
    freeze({
      from: transition.from,
      command: transition.command,
      to: transition.to,
      actors: freeze([...transition.actors]),
    }),
  ),
);

function containsString<const Value extends string>(
  values: readonly Value[],
  candidate: unknown,
): candidate is Value {
  if (typeof candidate !== "string") return false;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === candidate) return true;
  }

  return false;
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return containsString(LEAD_STATUSES, value);
}

function isLeadCommand(value: unknown): value is LeadCommand {
  return containsString(LEAD_COMMANDS, value);
}

function isLeadActor(value: unknown): value is LeadActor {
  return containsString(LEAD_ACTORS, value);
}

export type AllowedLeadTransition = Readonly<{
  allowed: true;
  from: LeadStatus;
  command: LeadCommand;
  actor: LeadActor;
  to: LeadStatus;
}>;

export type LeadTransitionDenialReason =
  | "UNKNOWN_STATUS"
  | "UNKNOWN_COMMAND"
  | "UNKNOWN_ACTOR"
  | "TERMINAL_STATE"
  | "TRANSITION_NOT_ALLOWED"
  | "ACTOR_NOT_ALLOWED";

export type DeniedLeadTransition = Readonly<{
  allowed: false;
  reason: LeadTransitionDenialReason;
}>;

export type LeadTransitionDecision = AllowedLeadTransition | DeniedLeadTransition;

const UNKNOWN_STATUS_DENIAL = freeze({
  allowed: false,
  reason: "UNKNOWN_STATUS",
} as const);

const UNKNOWN_COMMAND_DENIAL = freeze({
  allowed: false,
  reason: "UNKNOWN_COMMAND",
} as const);

const UNKNOWN_ACTOR_DENIAL = freeze({
  allowed: false,
  reason: "UNKNOWN_ACTOR",
} as const);

const TERMINAL_STATE_DENIAL = freeze({
  allowed: false,
  reason: "TERMINAL_STATE",
} as const);

const TRANSITION_NOT_ALLOWED_DENIAL = freeze({
  allowed: false,
  reason: "TRANSITION_NOT_ALLOWED",
} as const);

const ACTOR_NOT_ALLOWED_DENIAL = freeze({
  allowed: false,
  reason: "ACTOR_NOT_ALLOWED",
} as const);

export function decideLeadTransition(
  status: unknown,
  command: unknown,
  actor: unknown,
): LeadTransitionDecision {
  if (!isLeadStatus(status)) {
    return UNKNOWN_STATUS_DENIAL;
  }

  if (containsString(TERMINAL_LEAD_STATUSES, status)) {
    return TERMINAL_STATE_DENIAL;
  }

  if (!isLeadCommand(command)) {
    return UNKNOWN_COMMAND_DENIAL;
  }

  if (!isLeadActor(actor)) {
    return UNKNOWN_ACTOR_DENIAL;
  }

  let transition: InternalTransitionRule | undefined;
  for (let index = 0; index < TRANSITION_RULES.length; index += 1) {
    const candidate = TRANSITION_RULES[index];
    if (candidate?.from === status && candidate.command === command) {
      transition = candidate;
      break;
    }
  }
  if (transition === undefined) {
    return TRANSITION_NOT_ALLOWED_DENIAL;
  }

  if (!containsString(transition.actors, actor)) {
    return ACTOR_NOT_ALLOWED_DENIAL;
  }

  return freeze({ allowed: true, from: status, command, actor, to: transition.to });
}
