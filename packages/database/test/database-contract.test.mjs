import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import * as database from "../src/index.ts";

const MIGRATION_SQL = (
  await Promise.all(
    [
      "../migrations/0001_pilot_data_model.sql",
      "../migrations/0002_pilot_unknown_language_whatsapp.sql",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  )
).join("\n");
const uuid = (number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const hash = (number) => number.toString(16).padStart(64, "0");

async function openMigratedDatabase(t) {
  const client = new PGlite();
  t.after(async () => {
    await client.close();
  });
  await client.exec(MIGRATION_SQL);
  return client;
}

async function insertBusiness(client, number) {
  await client.query(
    `INSERT INTO businesses
       (id, name, source_url, source_provider, source_record_id, category, city, region,
        country_code, preferred_language, normalized_identity_hash, collected_at)
     VALUES ($1, $2, $3, 'fixture-directory', $4, 'Professional Services',
             'London', NULL, 'GB', 'en', $5, '2026-07-01T00:00:00Z')`,
    [
      uuid(number),
      `Synthetic Business ${number}`,
      `https://directory-${number}.example.invalid/business`,
      `record-${number}`,
      hash(number),
    ],
  );
  return uuid(number);
}

async function insertEvidence(client, number, businessId, websiteId = null) {
  // Website-less fixtures are public-listing evidence, not website observations.
  const signalType = websiteId === null ? "PUBLIC_LISTING" : "WEBSITE_OBSERVATION";
  await client.query(
    `INSERT INTO lead_evidence
       (id, business_id, website_id, source_url, observed_at, content_hash, signal_type,
        language, signal_at, review_count, review_rating, latest_review_at, summary, confidence)
     VALUES ($1, $2, $3, $4, '2026-07-01T02:00:00Z', $5, $6,
             'en', NULL, NULL, NULL, NULL, 'Synthetic evidence', 90)`,
    [
      uuid(number),
      businessId,
      websiteId,
      `https://evidence-${number}.example.invalid/observation`,
      hash(number + 100_000),
      signalType,
    ],
  );
  return uuid(number);
}

test("exports captured-frozen canonical tables and finite vocabularies", () => {
  const expected = {
    PILOT_TABLES: [
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
    ],
    CONTACT_ROUTE_TYPES: ["EMAIL", "PHONE", "WHATSAPP", "CONTACT_FORM", "OTHER"],
    PILOT_LANGUAGES: ["de", "en", "ar", "unknown"],
    LEAD_EVIDENCE_SIGNAL_TYPES: [
      "PUBLIC_LISTING",
      "RECENT_REVIEW",
      "OPENING_HOURS",
      "SOCIAL_ACTIVITY",
      "WEBSITE_UPDATE",
      "PORTFOLIO_PROJECT",
      "CONTACT_VALIDATION",
      "WEBSITE_OBSERVATION",
      "OTHER",
    ],
    AUDIT_FINDING_CATEGORIES: [
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
    ],
    APPROVAL_ACTIONS: ["LEAD_APPROVAL", "DRAFT_APPROVAL"],
    APPROVAL_STATUSES: ["PENDING", "APPROVED", "REJECTED", "EXPIRED"],
    CONTACT_ATTEMPT_STATUSES: ["INTENT", "ACCEPTED", "RECONCILED", "FAILED", "UNCERTAIN"],
    SUPPRESSION_SCOPE_TYPES: ["CONTACT", "BUSINESS", "DOMAIN", "GLOBAL"],
    ACTIVITY_EVENT_TYPES: [
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
    ],
  };

  assert.equal("OUTREACH_DRAFT_STATUSES" in database, false);
  for (const [exportName, expectedValues] of Object.entries(expected)) {
    assert.deepEqual(database[exportName], expectedValues);
    assert.ok(Object.isFrozen(database[exportName]), `${exportName} must be frozen`);
    assert.throws(() => database[exportName].push("MUTATED"), TypeError);
  }
});

test("applies once with exactly 11 forced-RLS public tables and zero policies", async (t) => {
  const client = await openMigratedDatabase(t);
  const tables = await client.query(`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);
  assert.deepEqual(tables.rows.map((row) => row.relname).sort(), [...database.PILOT_TABLES].sort());
  assert.ok(tables.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
  const policies = await client.query(`
    SELECT COUNT(*)::integer AS count
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
  `);
  assert.equal(policies.rows[0].count, 0);
  await assert.rejects(client.exec(MIGRATION_SQL), /already exists/i);
});

test("uses application-supplied nonnullable UUID primary keys on all 11 tables", async (t) => {
  const client = await openMigratedDatabase(t);
  const ids = await client.query(`
    SELECT table_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'id'
    ORDER BY table_name
  `);
  assert.equal(ids.rows.length, 11);
  assert.ok(
    ids.rows.every(
      (row) => row.data_type === "uuid" && row.is_nullable === "NO" && row.column_default === null,
    ),
  );
  const primaryKeys = await client.query(`
    SELECT table_class.relname AS table_name
    FROM pg_catalog.pg_constraint AS constraint_meta
    JOIN pg_catalog.pg_class AS table_class ON table_class.oid = constraint_meta.conrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
    WHERE namespace.nspname = 'public' AND constraint_meta.contype = 'p'
    ORDER BY table_class.relname
  `);
  assert.deepEqual(
    primaryKeys.rows.map((row) => row.table_name),
    [...database.PILOT_TABLES].sort(),
  );
});

test("catalogs the exact thin final column surface without tenant or mutable draft drift", async (t) => {
  const client = await openMigratedDatabase(t);
  const result = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const columns = Object.fromEntries(
    database.PILOT_TABLES.map((tableName) => [
      tableName,
      result.rows.filter((row) => row.table_name === tableName).map((row) => row.column_name),
    ]),
  );
  assert.deepEqual(columns, {
    businesses: [
      "id",
      "name",
      "source_url",
      "source_provider",
      "source_record_id",
      "category",
      "city",
      "region",
      "country_code",
      "preferred_language",
      "normalized_identity_hash",
      "collected_at",
    ],
    contacts: [
      "id",
      "business_id",
      "route_type",
      "route_value",
      "normalized_hash",
      "source_url",
      "observed_at",
    ],
    websites: [
      "id",
      "business_id",
      "url",
      "source_url",
      "normalized_url_hash",
      "normalized_domain_hash",
      "observed_at",
    ],
    lead_evidence: [
      "id",
      "business_id",
      "website_id",
      "source_url",
      "observed_at",
      "content_hash",
      "signal_type",
      "language",
      "signal_at",
      "review_count",
      "review_rating",
      "latest_review_at",
      "summary",
      "confidence",
    ],
    audit_findings: [
      "id",
      "business_id",
      "website_id",
      "evidence_id",
      "category",
      "observed_problem",
      "why_it_matters",
      "recommended_improvement",
      "confidence",
      "observed_at",
    ],
    lead_scores: [
      "id",
      "business_id",
      "scoring_version",
      "overall_confidence",
      "active_business_score",
      "active_business_evidence_id",
      "website_opportunity_score",
      "website_opportunity_evidence_id",
      "commercial_fit_score",
      "commercial_fit_evidence_id",
      "contactability_score",
      "contactability_evidence_id",
      "personalization_score",
      "personalization_evidence_id",
      "response_likelihood_score",
      "response_likelihood_evidence_id",
      "total_score",
      "hard_excluded",
      "presentable",
      "explanation",
      "scored_at",
    ],
    outreach_drafts: [
      "id",
      "business_id",
      "contact_id",
      "language",
      "channel",
      "recipient_hash",
      "subject",
      "body",
      "payload_hash",
      "created_at",
    ],
    approvals: [
      "id",
      "action",
      "business_id",
      "draft_id",
      "subject_id",
      "payload_hash",
      "recipient_hash",
      "channel",
      "status",
      "requester",
      "approver",
      "requested_at",
      "decided_at",
      "expires_at",
      "reason",
    ],
    contact_attempts: [
      "id",
      "business_id",
      "contact_id",
      "draft_id",
      "approval_id",
      "payload_hash",
      "recipient_hash",
      "channel",
      "provider",
      "idempotency_key",
      "status",
      "provider_message_id",
      "provider_thread_id",
      "attempted_at",
      "reconciled_at",
    ],
    suppressions: ["id", "scope_type", "scope_hash", "reason", "source", "created_at", "active"],
    activity_events: [
      "id",
      "business_id",
      "event_type",
      "actor",
      "reason",
      "correlation_id",
      "payload",
      "occurred_at",
    ],
  });
  const allColumns = result.rows.map((row) => row.column_name);
  assert.equal(allColumns.includes("workspace_id"), false);
  assert.equal(allColumns.includes("updated_at"), false);
  assert.equal(
    result.rows.some((row) => row.table_name === "outreach_drafts" && row.column_name === "status"),
    false,
  );
});

test("catalogs exact relational keys, restrictive foreign keys, explicit indexes, and triggers", async (t) => {
  const client = await openMigratedDatabase(t);
  const constraints = await client.query(`
    SELECT
      table_class.relname AS table_name,
      constraint_meta.contype AS type,
      pg_get_constraintdef(constraint_meta.oid) AS definition
    FROM pg_catalog.pg_constraint AS constraint_meta
    JOIN pg_catalog.pg_class AS table_class ON table_class.oid = constraint_meta.conrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
    WHERE namespace.nspname = 'public'
    ORDER BY table_class.relname, constraint_meta.contype, constraint_meta.oid
  `);
  const definitions = constraints.rows.map(
    (row) => `${row.table_name}:${row.type}:${row.definition}`,
  );
  for (const expected of [
    /^businesses:u:UNIQUE \(source_provider, source_record_id\)$/,
    /^businesses:u:UNIQUE \(normalized_identity_hash\)$/,
    /^contacts:u:UNIQUE \(id, business_id, route_type, normalized_hash\)$/,
    /^websites:u:UNIQUE \(id, business_id\)$/,
    /^lead_evidence:f:FOREIGN KEY \(website_id, business_id\) REFERENCES websites\(id, business_id\) ON DELETE RESTRICT$/,
    /^audit_findings:f:FOREIGN KEY \(evidence_id, website_id, business_id\) REFERENCES lead_evidence\(id, website_id, business_id\) ON DELETE RESTRICT$/,
    /^outreach_drafts:f:FOREIGN KEY \(contact_id, business_id, channel, recipient_hash\) REFERENCES contacts\(id, business_id, route_type, normalized_hash\) ON DELETE RESTRICT$/,
    /^approvals:u:UNIQUE \(action, subject_id, payload_hash\)$/,
    /^approvals:f:FOREIGN KEY \(draft_id, business_id, channel, recipient_hash, payload_hash\) REFERENCES outreach_drafts\(id, business_id, channel, recipient_hash, payload_hash\) ON DELETE RESTRICT$/,
    /^contact_attempts:f:FOREIGN KEY \(approval_id, business_id, draft_id, payload_hash, recipient_hash, channel\) REFERENCES approvals\(id, business_id, draft_id, payload_hash, recipient_hash, channel\) ON DELETE RESTRICT$/,
    /^contact_attempts:u:UNIQUE \(recipient_hash\)$/,
  ]) {
    assert.ok(
      definitions.some((definition) => expected.test(definition)),
      expected.source,
    );
  }

  const foreignKeys = constraints.rows.filter((row) => row.type === "f");
  assert.equal(foreignKeys.length, 20);
  assert.ok(foreignKeys.every((row) => /ON DELETE RESTRICT$/.test(row.definition)));

  const indexes = await client.query(`
    SELECT
      table_class.relname AS table_name,
      index_class.relname AS index_name,
      index_meta.indisunique AS is_unique,
      pg_get_expr(index_meta.indpred, index_meta.indrelid) AS predicate
    FROM pg_catalog.pg_index AS index_meta
    JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_meta.indexrelid
    JOIN pg_catalog.pg_class AS table_class ON table_class.oid = index_meta.indrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
    LEFT JOIN pg_catalog.pg_constraint AS constraint_meta
      ON constraint_meta.conindid = index_meta.indexrelid
    WHERE namespace.nspname = 'public' AND constraint_meta.oid IS NULL
    ORDER BY index_class.relname
  `);
  assert.deepEqual(
    indexes.rows.map(({ table_name, index_name, is_unique, predicate }) => ({
      table_name,
      index_name,
      is_unique,
      predicate,
    })),
    [
      {
        table_name: "contact_attempts",
        index_name: "contact_attempts_status_idx",
        is_unique: false,
        predicate: null,
      },
      {
        table_name: "lead_evidence",
        index_name: "lead_evidence_business_recency_idx",
        is_unique: false,
        predicate: null,
      },
      {
        table_name: "lead_scores",
        index_name: "lead_scores_presentable_ranking_idx",
        is_unique: false,
        predicate: "presentable",
      },
      {
        table_name: "suppressions",
        index_name: "suppressions_active_scope_uidx",
        is_unique: true,
        predicate: "active",
      },
      {
        table_name: "websites",
        index_name: "websites_business_domain_idx",
        is_unique: false,
        predicate: null,
      },
    ],
  );

  const constraintIndexes = await client.query(`
    SELECT COUNT(*)::integer AS count
    FROM pg_catalog.pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype IN ('p', 'u', 'x')
      AND conindid <> 0
  `);
  assert.equal(constraintIndexes.rows[0].count, 26);

  const triggers = await client.query(`
    SELECT event_object_table AS table_name, trigger_name
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    GROUP BY event_object_table, trigger_name
    ORDER BY trigger_name
  `);
  assert.deepEqual(triggers.rows, [
    { table_name: "activity_events", trigger_name: "activity_events_append_only" },
    { table_name: "approvals", trigger_name: "approval_lifecycle" },
    { table_name: "audit_findings", trigger_name: "audit_findings_append_only" },
    { table_name: "businesses", trigger_name: "businesses_append_only" },
    { table_name: "contact_attempts", trigger_name: "contact_attempt_insert_guard" },
    { table_name: "contact_attempts", trigger_name: "contact_attempt_update_guard" },
    { table_name: "contacts", trigger_name: "contacts_append_only" },
    { table_name: "lead_evidence", trigger_name: "lead_evidence_append_only" },
    { table_name: "lead_scores", trigger_name: "lead_scores_append_only" },
    { table_name: "outreach_drafts", trigger_name: "outreach_drafts_append_only" },
    { table_name: "suppressions", trigger_name: "suppressions_append_only" },
    { table_name: "websites", trigger_name: "websites_append_only" },
  ]);
});

test("retains score arithmetic, component maxima, threshold, and hard exclusions", async (t) => {
  const client = await openMigratedDatabase(t);
  const businessId = await insertBusiness(client, 800);
  const evidenceId = await insertEvidence(client, 801, businessId);
  let sequence = 802;
  const insertScore = (overrides = {}) => {
    sequence += 1;
    const row = {
      active: 15,
      website: 15,
      commercial: 15,
      contactability: 10,
      personalization: 5,
      response: 5,
      total: 65,
      hardExcluded: false,
      presentable: true,
      ...overrides,
    };
    return client.query(
      `INSERT INTO lead_scores
         (id, business_id, scoring_version, overall_confidence,
          active_business_score, active_business_evidence_id,
          website_opportunity_score, website_opportunity_evidence_id,
          commercial_fit_score, commercial_fit_evidence_id,
          contactability_score, contactability_evidence_id,
          personalization_score, personalization_evidence_id,
          response_likelihood_score, response_likelihood_evidence_id,
          total_score, hard_excluded, presentable, explanation, scored_at)
       VALUES ($1, $2, 'pilot-v1', 90, $3, $9, $4, $9, $5, $9, $6, $9, $7, $9,
               $8, $9, $10, $11, $12, 'Exact score arithmetic', now())`,
      [
        uuid(sequence),
        businessId,
        row.active,
        row.website,
        row.commercial,
        row.contactability,
        row.personalization,
        row.response,
        evidenceId,
        row.total,
        row.hardExcluded,
        row.presentable,
      ],
    );
  };

  await insertScore();
  await insertScore({
    active: 20,
    website: 25,
    commercial: 20,
    contactability: 15,
    personalization: 10,
    response: 10,
    total: 100,
  });
  await insertScore({ hardExcluded: true, presentable: false });
  await assert.rejects(insertScore({ total: 66 }), /check constraint|violates/i);
  await assert.rejects(
    insertScore({ active: 14, total: 64, presentable: true }),
    /check constraint|violates/i,
  );
  await assert.rejects(
    insertScore({ hardExcluded: true, presentable: true }),
    /check constraint|violates/i,
  );
  for (const [component, maximum] of Object.entries({
    active: 20,
    website: 25,
    commercial: 20,
    contactability: 15,
    personalization: 10,
    response: 10,
  })) {
    const zero = {
      active: 0,
      website: 0,
      commercial: 0,
      contactability: 0,
      personalization: 0,
      response: 0,
      presentable: false,
    };
    await assert.rejects(
      insertScore({ ...zero, [component]: maximum + 1, total: maximum + 1 }),
      /check constraint|violates/i,
    );
  }
});

test("retains finite audit categories and append-only finite activity events", async (t) => {
  const client = await openMigratedDatabase(t);
  const businessId = await insertBusiness(client, 850);
  await client.query(
    `INSERT INTO websites
       (id, business_id, url, source_url, normalized_url_hash, normalized_domain_hash,
        observed_at)
     VALUES ($1, $2, 'https://audit.example.invalid',
             'https://source.example.invalid/audit', $3, $4, now())`,
    [uuid(851), businessId, hash(851), hash(852)],
  );
  const evidenceId = await insertEvidence(client, 853, businessId, uuid(851));
  for (const [index, category] of database.AUDIT_FINDING_CATEGORIES.entries()) {
    await client.query(
      `INSERT INTO audit_findings
         (id, business_id, website_id, evidence_id, category, observed_problem,
          why_it_matters, recommended_improvement, confidence, observed_at)
       VALUES ($1, $2, $3, $4, $5, 'Problem', 'Impact', 'Improvement', 80, now())`,
      [uuid(860 + index), businessId, uuid(851), evidenceId, category],
    );
  }
  await assert.rejects(
    client.query(
      `INSERT INTO audit_findings
         (id, business_id, website_id, evidence_id, category, observed_problem,
          why_it_matters, recommended_improvement, confidence, observed_at)
       VALUES ($1, $2, $3, $4, 'INVENTED', 'Problem', 'Impact', 'Fix', 80, now())`,
      [uuid(880), businessId, uuid(851), evidenceId],
    ),
    /check constraint|violates/i,
  );

  for (const [index, eventType] of database.ACTIVITY_EVENT_TYPES.entries()) {
    await client.query(
      `INSERT INTO activity_events
         (id, business_id, event_type, actor, reason, correlation_id, payload, occurred_at)
       VALUES ($1, $2, $3, 'fixture', 'Reason', $4, $5::jsonb, now())`,
      [uuid(890 + index), businessId, eventType, `correlation-${index}`, JSON.stringify({ index })],
    );
  }
  await assert.rejects(
    client.query("UPDATE activity_events SET reason = 'Changed' WHERE business_id = $1", [
      businessId,
    ]),
    /append-only/i,
  );
  await assert.rejects(
    client.query("DELETE FROM activity_events WHERE business_id = $1", [businessId]),
    /append-only/i,
  );
});

test("inserts one approved synthetic path through all 11 tables without outbound behavior", async (t) => {
  const client = await openMigratedDatabase(t);
  const ids = {
    business: uuid(900),
    contact: uuid(901),
    website: uuid(902),
    evidence: uuid(903),
    finding: uuid(904),
    score: uuid(905),
    draft: uuid(906),
    approval: uuid(907),
    attempt: uuid(908),
    suppression: uuid(909),
    event: uuid(910),
  };
  const recipientHash = hash(901);
  const payloadHash = hash(906);
  await client.exec(`
    BEGIN;
    INSERT INTO businesses
      (id, name, source_url, source_provider, source_record_id, category, city, region,
       country_code, preferred_language, normalized_identity_hash, collected_at)
    VALUES
      ('${ids.business}', 'Synthetic Complete Business',
       'https://directory.example.invalid/complete', 'fixture-directory', 'complete-1',
       'Professional Services', 'Dubai', 'Dubai', 'AE', 'ar', '${hash(900)}',
       '2026-07-01T00:00:00Z');
    INSERT INTO contacts
      (id, business_id, route_type, route_value, normalized_hash, source_url, observed_at)
    VALUES
      ('${ids.contact}', '${ids.business}', 'EMAIL', 'complete@example.invalid',
       '${recipientHash}', 'https://source.example.invalid/contact',
       '2026-07-01T01:00:00Z');
    INSERT INTO websites
      (id, business_id, url, source_url, normalized_url_hash, normalized_domain_hash,
       observed_at)
    VALUES
      ('${ids.website}', '${ids.business}', 'https://complete.example.invalid',
       'https://source.example.invalid/website', '${hash(902)}', '${hash(912)}',
       '2026-07-01T01:00:00Z');
    INSERT INTO lead_evidence
      (id, business_id, website_id, source_url, observed_at, content_hash, signal_type,
       language, signal_at, review_count, review_rating, latest_review_at, summary, confidence)
    VALUES
      ('${ids.evidence}', '${ids.business}', '${ids.website}',
       'https://source.example.invalid/evidence', '2026-07-01T02:00:00Z',
       '${hash(903)}', 'WEBSITE_OBSERVATION', 'ar', '2026-07-01T01:00:00Z',
       NULL, NULL, NULL, 'Synthetic complete evidence', 90);
    INSERT INTO audit_findings
      (id, business_id, website_id, evidence_id, category, observed_problem,
       why_it_matters, recommended_improvement, confidence, observed_at)
    VALUES
      ('${ids.finding}', '${ids.business}', '${ids.website}', '${ids.evidence}',
       'HOMEPAGE_CLARITY', 'Problem', 'Impact', 'Improvement', 85,
       '2026-07-01T02:00:00Z');
    INSERT INTO lead_scores
      (id, business_id, scoring_version, overall_confidence,
       active_business_score, active_business_evidence_id,
       website_opportunity_score, website_opportunity_evidence_id,
       commercial_fit_score, commercial_fit_evidence_id,
       contactability_score, contactability_evidence_id,
       personalization_score, personalization_evidence_id,
       response_likelihood_score, response_likelihood_evidence_id,
       total_score, hard_excluded, presentable, explanation, scored_at)
    VALUES
      ('${ids.score}', '${ids.business}', 'pilot-v1', 90, 20, '${ids.evidence}',
       20, '${ids.evidence}', 15, '${ids.evidence}', 10, '${ids.evidence}',
       5, '${ids.evidence}', 5, '${ids.evidence}', 75, false, true,
       'Complete traceable score', '2026-07-01T03:00:00Z');
    INSERT INTO outreach_drafts
      (id, business_id, contact_id, language, channel, recipient_hash, subject, body,
       payload_hash, created_at)
    VALUES
      ('${ids.draft}', '${ids.business}', '${ids.contact}', 'ar', 'EMAIL',
       '${recipientHash}', 'Synthetic subject', 'Synthetic exact body', '${payloadHash}',
       '2026-07-01T04:00:00Z');
    INSERT INTO approvals
      (id, action, business_id, draft_id, subject_id, payload_hash, recipient_hash,
       channel, status, requester, approver, requested_at, decided_at, expires_at, reason)
    VALUES
      ('${ids.approval}', 'DRAFT_APPROVAL', '${ids.business}', '${ids.draft}',
       '${ids.draft}', '${payloadHash}', '${recipientHash}', 'EMAIL', 'PENDING',
       'fixture-operator', NULL, clock_timestamp() - interval '2 minutes', NULL,
       clock_timestamp() + interval '1 hour', 'Review exact artifact');
    UPDATE approvals
    SET status = 'APPROVED', approver = 'amer',
        decided_at = clock_timestamp() - interval '1 minute'
    WHERE id = '${ids.approval}';
    INSERT INTO contact_attempts
      (id, business_id, contact_id, draft_id, approval_id, payload_hash, recipient_hash,
       channel, provider, idempotency_key, status, provider_message_id,
       provider_thread_id, attempted_at, reconciled_at)
    VALUES
      ('${ids.attempt}', '${ids.business}', '${ids.contact}', '${ids.draft}',
       '${ids.approval}', '${payloadHash}', '${recipientHash}', 'EMAIL',
       'fixture-provider', 'complete-intent', 'INTENT', NULL, NULL,
       clock_timestamp(), NULL);
    INSERT INTO suppressions
      (id, scope_type, scope_hash, reason, source, created_at, active)
    VALUES
      ('${ids.suppression}', 'DOMAIN', '${hash(999)}', 'Inactive imported history',
       'fixture-import', '2026-07-01T00:00:00Z', false);
    INSERT INTO activity_events
      (id, business_id, event_type, actor, reason, correlation_id, payload, occurred_at)
    VALUES
      ('${ids.event}', '${ids.business}', 'CONTACT_ATTEMPTED', 'fixture',
       'Recorded intent only', 'complete-correlation', '{"synthetic":true}'::jsonb,
       '2026-07-01T07:00:00Z');
    COMMIT;
  `);

  for (const tableName of database.PILOT_TABLES) {
    const count = await client.query(`SELECT COUNT(*)::integer AS count FROM ${tableName}`);
    assert.equal(count.rows[0].count, 1, tableName);
  }
});
