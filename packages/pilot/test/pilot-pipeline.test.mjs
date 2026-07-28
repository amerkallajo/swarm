import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { processManualImport } from "@swarm/discovery";

import {
  createTopDrafts,
  parseAuditImport,
  pipelineReport,
  recordAudits,
  scoreAuditedBusinesses,
  validateCandidates,
} from "../src/index.ts";

const MIGRATION_SQL = (
  await Promise.all(
    [
      "../../database/migrations/0001_pilot_data_model.sql",
      "../../database/migrations/0002_pilot_unknown_language_whatsapp.sql",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  )
).join("\n");

function manualRecord(index, overrides = {}) {
  const website = `https://studio-${index}.example.com/`;
  return {
    sourceId: `manual-pilot-${index}`,
    name: `Synthetic Studio ${index}`,
    city: index % 2 === 0 ? "Jeddah" : "Riyadh",
    category: "PREMIUM_DETAILING",
    observedAt: "2026-07-28T06:00:00.000Z",
    identitySourceUrl: website,
    activityStatus: "ACTIVE",
    activitySourceUrl: website,
    independenceStatus: "INDEPENDENT",
    independenceSourceUrl: website,
    websiteStatus: "PRESENT",
    websiteUrl: website,
    websiteSourceUrl: website,
    contactKind: index === 1 ? "WHATSAPP" : "WEBSITE_FORM",
    contactRoute: index === 1 ? "+966500000001" : `${website}contact`,
    contactIsPublicBusiness: true,
    contactSourceUrl: `${website}contact`,
    opportunityStatus: "PLAUSIBLE",
    opportunityObservation: `Synthetic observed conversion issue ${index}.`,
    opportunitySourceUrl: website,
    ...overrides,
  };
}

function candidates(count = 3) {
  const result = processManualImport(
    JSON.stringify({
      schemaVersion: "1.0.0",
      records: Array.from({ length: count }, (_, index) => manualRecord(index + 1)),
    }),
  );
  assert.equal(result.ok, true);
  return result.candidates;
}

function auditDocument(count = 3) {
  return {
    schemaVersion: "1.0.0",
    businesses: Array.from({ length: count }, (_, index) => ({
      sourceId: `manual-pilot-${index + 1}`,
      language: index === 0 ? "ar" : "en",
      observedAt: "2026-07-28T07:00:00.000Z",
      findings: [
        {
          category: "CONVERSION_PATH",
          observedFact: `Synthetic booking defect ${index + 1}.`,
          evidenceSourceUrl: `https://studio-${index + 1}.example.com/`,
          businessImpact: "The verified defect can interrupt an enquiry.",
          recommendedImprovement: "Remove the defect and expose one clear booking action.",
          confidence: 90 - index,
        },
        ...(index === 0
          ? [
              {
                category: "SERVICE_PRESENTATION",
                observedFact: "Synthetic package prices are unfinished.",
                evidenceSourceUrl: "https://studio-1.example.com/packages",
                businessImpact: "Visitors cannot compare the available packages.",
                recommendedImprovement: "Publish complete package names, inclusions, and prices.",
                confidence: 95,
              },
            ]
          : []),
      ],
    })),
  };
}

async function migratedDatabase(t) {
  const client = new PGlite();
  t.after(() => client.close());
  await client.exec(MIGRATION_SQL);
  return client;
}

test("forward migration preserves unknown language and exact WhatsApp channel", async (t) => {
  const client = await migratedDatabase(t);
  const summary = await validateCandidates(client, candidates(1));
  assert.equal(summary.businesses, 1);
  const business = await client.query("SELECT preferred_language FROM businesses");
  const contact = await client.query("SELECT route_type FROM contacts");
  assert.equal(business.rows[0].preferred_language, "unknown");
  assert.equal(contact.rows[0].route_type, "WHATSAPP");
});

test("validation is restartable and does not duplicate local pilot state", async (t) => {
  const client = await migratedDatabase(t);
  const reviewed = candidates();
  const first = await validateCandidates(client, reviewed);
  const second = await validateCandidates(client, reviewed);
  assert.equal(first.businesses, 3);
  assert.equal(first.contacts, 3);
  assert.equal(first.websites, 3);
  assert.equal(first.evidenceRecords, 9);
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.evidenceRecords, 9);
});

test("a corrected contact artifact keeps the business identity and adds the newer exact route", async (t) => {
  const client = await migratedDatabase(t);
  await validateCandidates(client, candidates(1));
  const corrected = processManualImport(
    JSON.stringify({
      schemaVersion: "1.0.0",
      records: [
        manualRecord(1, {
          observedAt: "2026-07-28T07:00:00.000Z",
          websiteUrl: "https://studio-1-new.example.com/",
          websiteSourceUrl: "https://studio-1-new.example.com/",
          contactKind: "EMAIL",
          contactRoute: "pilot-correction@example.com",
        }),
      ],
    }),
  );
  assert.equal(corrected.ok, true);
  const summary = await validateCandidates(client, corrected.candidates);
  assert.equal(summary.businesses, 1);
  assert.equal(summary.contacts, 2);
  assert.equal(summary.websites, 2);
  const routes = await client.query(
    "SELECT route_type, route_value FROM contacts ORDER BY observed_at DESC",
  );
  assert.deepEqual(routes.rows[0], {
    route_type: "EMAIL",
    route_value: "pilot-correction@example.com",
  });
});

test("audit import is bounded and rejects malformed evidence", () => {
  assert.throws(
    () =>
      parseAuditImport(
        JSON.stringify({
          schemaVersion: "1.0.0",
          businesses: Array.from({ length: 11 }, (_, index) => ({
            ...auditDocument(1).businesses[0],
            sourceId: `overflow-${index}`,
          })),
        }),
      ),
    /between 1 and 10/,
  );
  const malformed = auditDocument(1);
  malformed.businesses[0].findings[0].evidenceSourceUrl = "http://unsafe.example.com";
  assert.throws(() => parseAuditImport(JSON.stringify(malformed)), /content is invalid/);
});

test("reviewed audits produce evidence-backed scores, three drafts, and zero contact attempts", async (t) => {
  const client = await migratedDatabase(t);
  await validateCandidates(client, candidates());
  const audit = await recordAudits(client, parseAuditImport(JSON.stringify(auditDocument())));
  assert.equal(audit.businessesAudited, 3);
  assert.equal(audit.findings, 4);

  const scores = await scoreAuditedBusinesses(client);
  assert.equal(scores.scored, 3);
  assert.equal(scores.qualified, 3);
  assert.equal(scores.topFive[0].name, "Synthetic Studio 1");
  assert.ok(scores.topFive.every((lead) => lead.totalScore >= 65));

  const drafts = await createTopDrafts(client);
  assert.equal(drafts.drafted, 3);
  assert.match(drafts.drafts[0].body, /لا يوجد عقد/);
  assert.match(drafts.drafts[1].body, /no contract/);
  assert.ok(drafts.drafts.every((draft) => draft.recipient.length > 0));
  assert.ok(drafts.drafts.every((draft) => Object.hasOwn(draft, "subject")));
  assert.equal(drafts.drafts[0].subject, null);

  const report = await pipelineReport(client);
  assert.equal(report.pipeline.discovered, 3);
  assert.equal(report.pipeline.validated, 3);
  assert.equal(report.pipeline.audited, 3);
  assert.equal(report.pipeline.qualified, 3);
  assert.equal(report.pipeline.drafted, 3);
  assert.equal(report.pipeline.contacted, 0);
});
