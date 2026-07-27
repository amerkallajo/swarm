import assert from "node:assert/strict";
import test from "node:test";

import { LEAD_STATUSES } from "../src/index.ts";

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
