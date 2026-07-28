import assert from "node:assert/strict";
import test from "node:test";

import * as domain from "../src/index.ts";

const { LEAD_STATUSES } = domain;

const SYSTEM_OR_OPERATOR = ["SYSTEM", "HUMAN_OPERATOR"];
const SUPPRESSION_ACTORS = ["SYSTEM", "HUMAN_OPERATOR", "PROVIDER", "LEAD"];

const LEGAL_RULES = [
  ["DISCOVERED", "START_VALIDATION", "VALIDATING", SYSTEM_OR_OPERATOR],
  ["VALIDATING", "QUALIFY_LEAD", "QUALIFIED", SYSTEM_OR_OPERATOR],
  ["QUALIFIED", "REQUEST_OUTREACH_APPROVAL", "AWAITING_APPROVAL", SYSTEM_OR_OPERATOR],
  ["AWAITING_APPROVAL", "APPROVE_OUTREACH", "APPROVED_FOR_OUTREACH", ["HUMAN_APPROVER"]],
  ["APPROVED_FOR_OUTREACH", "RECORD_OUTREACH_SENT", "CONTACTED", ["SYSTEM", "PROVIDER"]],
  ["APPROVED_FOR_OUTREACH", "RECORD_MANUAL_OUTREACH_SENT", "CONTACTED", ["HUMAN_OPERATOR"]],
  ["CONTACTED", "RECORD_REPLY", "REPLIED", ["SYSTEM", "HUMAN_OPERATOR", "PROVIDER", "LEAD"]],
  ["REPLIED", "MARK_INTERESTED", "INTERESTED", SYSTEM_OR_OPERATOR],
  ["INTERESTED", "APPROVE_PREVIEW_CREATION", "PREVIEW_PLANNED", ["HUMAN_APPROVER"]],
  ["PREVIEW_PLANNED", "START_PREVIEW", "PREVIEW_IN_PROGRESS", SYSTEM_OR_OPERATOR],
  ["PREVIEW_IN_PROGRESS", "SUBMIT_PREVIEW_FOR_REVIEW", "PREVIEW_REVIEW", SYSTEM_OR_OPERATOR],
  ["PREVIEW_REVIEW", "REQUEST_PREVIEW_CHANGES", "PREVIEW_IN_PROGRESS", ["HUMAN_APPROVER"]],
  ["PREVIEW_REVIEW", "APPROVE_PREVIEW_SEND", "PREVIEW_SEND_APPROVED", ["HUMAN_APPROVER"]],
  ["PREVIEW_SEND_APPROVED", "RECORD_PREVIEW_SENT", "PREVIEW_SENT", ["SYSTEM", "PROVIDER"]],
  ["INTERESTED", "START_NEGOTIATION", "NEGOTIATING", ["HUMAN_OPERATOR"]],
  ["PREVIEW_SENT", "START_NEGOTIATION", "NEGOTIATING", ["HUMAN_OPERATOR"]],
  ["NEGOTIATING", "MARK_WON", "WON", ["HUMAN_OPERATOR"]],
  ["NEGOTIATING", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["REPLIED", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["CONTACTED", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["INTERESTED", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["PREVIEW_PLANNED", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["PREVIEW_IN_PROGRESS", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["PREVIEW_REVIEW", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["PREVIEW_SEND_APPROVED", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["PREVIEW_SENT", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["FOLLOW_UP_LATER", "MARK_LOST", "LOST", ["HUMAN_OPERATOR"]],
  ["CONTACTED", "DEFER_FOLLOW_UP", "FOLLOW_UP_LATER", SYSTEM_OR_OPERATOR],
  ["REPLIED", "DEFER_FOLLOW_UP", "FOLLOW_UP_LATER", SYSTEM_OR_OPERATOR],
  ["FOLLOW_UP_LATER", "REQUEST_OUTREACH_APPROVAL", "AWAITING_APPROVAL", SYSTEM_OR_OPERATOR],
  ["DISCOVERED", "REJECT_LEAD", "REJECTED", SYSTEM_OR_OPERATOR],
  ["VALIDATING", "REJECT_LEAD", "REJECTED", SYSTEM_OR_OPERATOR],
  ["QUALIFIED", "REJECT_LEAD", "REJECTED", SYSTEM_OR_OPERATOR],
  ["AWAITING_APPROVAL", "REJECT_LEAD", "REJECTED", ["HUMAN_APPROVER"]],
  ["APPROVED_FOR_OUTREACH", "REJECT_LEAD", "REJECTED", ["HUMAN_OPERATOR", "HUMAN_APPROVER"]],
  ...[
    "DISCOVERED",
    "VALIDATING",
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
    "FOLLOW_UP_LATER",
  ].map((from) => [from, "RECORD_DO_NOT_CONTACT", "DO_NOT_CONTACT", SUPPRESSION_ACTORS]),
];

test("LEAD_STATUSES contains all canonical statuses from architecture doc", () => {
  const expected = [
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
  ];
  assert.deepEqual(LEAD_STATUSES, expected);
});

test("LEAD_STATUSES is frozen and cannot be mutated", () => {
  assert.ok(Object.isFrozen(LEAD_STATUSES));
});

test("domain package marker reports the implemented foundation state machine", () => {
  assert.deepEqual(domain.domainStatus, {
    phase: "foundation",
    stateMachineImplemented: true,
  });
  assert.ok(Object.isFrozen(domain.domainStatus));
});

test("publishes immutable finite command, actor, and terminal-state vocabularies", () => {
  const expectedCommands = [
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
  ];
  const expectedActors = ["SYSTEM", "HUMAN_OPERATOR", "HUMAN_APPROVER", "PROVIDER", "LEAD"];
  const expectedTerminalStates = ["REJECTED", "WON", "LOST", "DO_NOT_CONTACT"];

  assert.deepEqual(domain.LEAD_COMMANDS, expectedCommands);
  assert.deepEqual(domain.LEAD_ACTORS, expectedActors);
  assert.deepEqual(domain.TERMINAL_LEAD_STATUSES, expectedTerminalStates);
  assert.equal(domain.LEAD_COMMANDS.includes("SET_STATUS"), false);

  for (const vocabulary of [
    domain.LEAD_STATUSES,
    domain.LEAD_COMMANDS,
    domain.LEAD_ACTORS,
    domain.TERMINAL_LEAD_STATUSES,
  ]) {
    assert.ok(Object.isFrozen(vocabulary));
    assert.throws(() => vocabulary.push("MUTATED"), TypeError);
  }
});

test("allows every independently specified lifecycle transition for each authorized actor", () => {
  assert.equal(typeof domain.decideLeadTransition, "function");

  for (const [from, command, to, actors] of LEGAL_RULES) {
    for (const actor of actors) {
      const result = domain.decideLeadTransition(from, command, actor);
      assert.deepEqual(
        result,
        { allowed: true, from, command, actor, to },
        `${actor} should be allowed to apply ${command} from ${from} to ${to}`,
      );
      assert.ok(Object.isFrozen(result));
    }
  }
});

test("fails closed across unauthorized actors, illegal pairs, and the complete terminal matrix", () => {
  const actors = ["SYSTEM", "HUMAN_OPERATOR", "HUMAN_APPROVER", "PROVIDER", "LEAD"];
  const commands = [
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
  ];
  const statuses = [
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
  ];
  const terminalStatuses = ["REJECTED", "WON", "LOST", "DO_NOT_CONTACT"];
  const legalPairs = new Set(LEGAL_RULES.map(([from, command]) => `${from}\u0000${command}`));

  for (const [from, command, , allowedActors] of LEGAL_RULES) {
    for (const actor of actors.filter((candidate) => !allowedActors.includes(candidate))) {
      const result = domain.decideLeadTransition(from, command, actor);
      assert.deepEqual(result, { allowed: false, reason: "ACTOR_NOT_ALLOWED" });
      assert.ok(Object.isFrozen(result));
    }
  }

  for (const status of statuses.filter((candidate) => !terminalStatuses.includes(candidate))) {
    for (const command of commands) {
      if (legalPairs.has(`${status}\u0000${command}`)) continue;

      for (const actor of actors) {
        const result = domain.decideLeadTransition(status, command, actor);
        assert.deepEqual(result, { allowed: false, reason: "TRANSITION_NOT_ALLOWED" });
        assert.ok(Object.isFrozen(result));
      }
    }
  }

  for (const status of terminalStatuses) {
    for (const command of commands) {
      for (const actor of actors) {
        const result = domain.decideLeadTransition(status, command, actor);
        assert.deepEqual(result, { allowed: false, reason: "TERMINAL_STATE" });
        assert.ok(Object.isFrozen(result));
        assert.equal(result.allowed, false, `${status}/${command}/${actor} must never succeed`);
      }
    }
  }
});

test("rejects malformed and prototype-like unknown input without throwing using stable precedence", () => {
  const malformed = [
    undefined,
    null,
    0,
    true,
    {},
    [],
    Symbol("malformed"),
    new String("DISCOVERED"),
    "__proto__",
    "prototype",
    "constructor",
    "toString",
  ];

  for (const status of malformed) {
    assert.doesNotThrow(() => domain.decideLeadTransition(status, "START_VALIDATION", "SYSTEM"));
    assert.deepEqual(domain.decideLeadTransition(status, "START_VALIDATION", "SYSTEM"), {
      allowed: false,
      reason: "UNKNOWN_STATUS",
    });
  }

  for (const command of malformed) {
    assert.doesNotThrow(() => domain.decideLeadTransition("DISCOVERED", command, "SYSTEM"));
    assert.deepEqual(domain.decideLeadTransition("DISCOVERED", command, "SYSTEM"), {
      allowed: false,
      reason: "UNKNOWN_COMMAND",
    });
  }

  for (const actor of malformed) {
    assert.doesNotThrow(() => domain.decideLeadTransition("DISCOVERED", "START_VALIDATION", actor));
    assert.deepEqual(domain.decideLeadTransition("DISCOVERED", "START_VALIDATION", actor), {
      allowed: false,
      reason: "UNKNOWN_ACTOR",
    });
  }

  assert.deepEqual(domain.decideLeadTransition("not-a-status", "not-a-command", "not-an-actor"), {
    allowed: false,
    reason: "UNKNOWN_STATUS",
  });
  assert.deepEqual(domain.decideLeadTransition("WON", "not-a-command", "not-an-actor"), {
    allowed: false,
    reason: "TERMINAL_STATE",
  });
  assert.deepEqual(domain.decideLeadTransition("DISCOVERED", "not-a-command", "not-an-actor"), {
    allowed: false,
    reason: "UNKNOWN_COMMAND",
  });
  assert.deepEqual(domain.decideLeadTransition("DISCOVERED", "QUALIFY_LEAD", "not-an-actor"), {
    allowed: false,
    reason: "UNKNOWN_ACTOR",
  });
});

test("exposes immutable unique rules without mutable internals and returns mutation-proof pure results", () => {
  const expectedRules = LEGAL_RULES.map(([from, command, to, actors]) => ({
    from,
    command,
    to,
    actors,
  }));

  assert.deepEqual(domain.LEAD_TRANSITIONS, expectedRules);
  assert.equal(domain.LEAD_TRANSITIONS.length, 50);
  assert.ok(Object.isFrozen(domain.LEAD_TRANSITIONS));

  const pairs = new Set();
  for (const transition of domain.LEAD_TRANSITIONS) {
    assert.ok(Object.isFrozen(transition));
    assert.ok(Object.isFrozen(transition.actors));
    assert.ok(transition.actors.length > 0);
    assert.equal(typeof transition.to, "string");
    assert.equal(pairs.has(`${transition.from}\u0000${transition.command}`), false);
    pairs.add(`${transition.from}\u0000${transition.command}`);

    if (transition.command.startsWith("APPROVE_")) {
      assert.deepEqual(transition.actors, ["HUMAN_APPROVER"]);
    }
  }

  assert.throws(() => domain.LEAD_TRANSITIONS.push({}), TypeError);
  assert.throws(() => {
    domain.LEAD_TRANSITIONS[0].to = "WON";
  }, TypeError);
  assert.throws(() => domain.LEAD_TRANSITIONS[0].actors.push("LEAD"), TypeError);

  const firstAllowed = domain.decideLeadTransition("DISCOVERED", "START_VALIDATION", "SYSTEM");
  const secondAllowed = domain.decideLeadTransition("DISCOVERED", "START_VALIDATION", "SYSTEM");
  assert.deepEqual(firstAllowed, secondAllowed);
  assert.ok(Object.isFrozen(firstAllowed));
  assert.throws(() => {
    firstAllowed.to = "WON";
  }, TypeError);

  const firstDenied = domain.decideLeadTransition("DISCOVERED", "MARK_WON", "SYSTEM");
  const secondDenied = domain.decideLeadTransition("DISCOVERED", "MARK_WON", "SYSTEM");
  assert.deepEqual(firstDenied, secondDenied);
  assert.ok(Object.isFrozen(firstDenied));
  assert.throws(() => {
    firstDenied.reason = "ACTOR_NOT_ALLOWED";
  }, TypeError);

  assert.deepEqual(domain.decideLeadTransition("DISCOVERED", "START_VALIDATION", "SYSTEM"), {
    allowed: true,
    from: "DISCOVERED",
    command: "START_VALIDATION",
    actor: "SYSTEM",
    to: "VALIDATING",
  });
});

test("resists same-realm intrinsic tampering after module initialization", () => {
  const originalIncludes = Array.prototype.includes;
  const originalFind = Array.prototype.find;
  const originalFreeze = Object.freeze;

  try {
    Array.prototype.includes = function tamperedIncludes(value) {
      if (value === "LEAD") return true;
      return Reflect.apply(originalIncludes, this, [value]);
    };

    assert.deepEqual(domain.decideLeadTransition("AWAITING_APPROVAL", "APPROVE_OUTREACH", "LEAD"), {
      allowed: false,
      reason: "ACTOR_NOT_ALLOWED",
    });

    Array.prototype.includes = originalIncludes;
    Array.prototype.find = () => ({
      from: "DISCOVERED",
      command: "MARK_WON",
      to: "WON",
      actors: ["LEAD"],
    });

    assert.deepEqual(domain.decideLeadTransition("DISCOVERED", "MARK_WON", "LEAD"), {
      allowed: false,
      reason: "TRANSITION_NOT_ALLOWED",
    });

    Array.prototype.find = originalFind;
    Object.freeze = (value) => value;
    const result = domain.decideLeadTransition("DISCOVERED", "START_VALIDATION", "SYSTEM");
    assert.ok(Object.isFrozen(result));
    assert.throws(() => {
      result.to = "WON";
    }, TypeError);
  } finally {
    Array.prototype.includes = originalIncludes;
    Array.prototype.find = originalFind;
    Object.freeze = originalFreeze;
  }
});
