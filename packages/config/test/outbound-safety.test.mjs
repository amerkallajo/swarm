import assert from "node:assert/strict";
import test from "node:test";

import { resolveOutboundSafetyFlags } from "../src/index.ts";

test("all outbound flags default to disabled", () => {
  assert.deepEqual(resolveOutboundSafetyFlags(), {
    outreachEnabled: false,
    previewPublishEnabled: false,
  });
});

test("malformed truthy values fail closed", () => {
  for (const malformedTruthyValue of ["1", "TRUE", " true ", "enabled", "on", "yes"]) {
    assert.deepEqual(
      resolveOutboundSafetyFlags({
        OUTREACH_ENABLED: malformedTruthyValue,
        PREVIEW_PUBLISH_ENABLED: malformedTruthyValue,
      }),
      {
        outreachEnabled: false,
        previewPublishEnabled: false,
      },
      `expected ${JSON.stringify(malformedTruthyValue)} to fail closed`,
    );
  }
});

test("only the exact explicit value true enables an outbound flag", () => {
  assert.deepEqual(
    resolveOutboundSafetyFlags({
      OUTREACH_ENABLED: "true",
      PREVIEW_PUBLISH_ENABLED: "false",
    }),
    {
      outreachEnabled: true,
      previewPublishEnabled: false,
    },
  );
});
