import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

const MIGRATION_SQL = await readFile(
  new URL("../migrations/0001_pilot_data_model.sql", import.meta.url),
  "utf8",
);

const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const hash = (number) => number.toString(16).padStart(64, "0");
const futureIso = (milliseconds) => new Date(Date.now() + milliseconds).toISOString();

async function waitUntilAfter(timestamp) {
  const delay = new Date(timestamp).getTime() - Date.now() + 25;
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function openMigratedDatabase(t) {
  const client = new PGlite();
  t.after(async () => {
    await client.close();
  });
  await client.exec(MIGRATION_SQL);
  return client;
}

async function insertBusiness(client, number, overrides = {}) {
  const row = {
    id: uuid(number),
    name: `Synthetic Business ${number}`,
    sourceUrl: `https://directory-${number}.example.invalid/business`,
    sourceProvider: "fixture-directory",
    sourceRecordId: `record-${number}`,
    category: "Professional Services",
    city: "Synthetic City",
    region: null,
    countryCode: "GB",
    preferredLanguage: "en",
    identityHash: hash(number),
    collectedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
  await client.query(
    `INSERT INTO businesses
       (id, name, source_url, source_provider, source_record_id, category, city, region,
        country_code, preferred_language, normalized_identity_hash, collected_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      row.id,
      row.name,
      row.sourceUrl,
      row.sourceProvider,
      row.sourceRecordId,
      row.category,
      row.city,
      row.region,
      row.countryCode,
      row.preferredLanguage,
      row.identityHash,
      row.collectedAt,
    ],
  );
  return row;
}

async function insertWebsite(client, number, businessId, overrides = {}) {
  const row = {
    id: uuid(number),
    businessId,
    url: `https://website-${number}.example.invalid/path`,
    sourceUrl: `https://directory-${number}.example.invalid/website`,
    urlHash: hash(number + 100_000),
    domainHash: hash(number + 200_000),
    observedAt: "2026-07-01T01:00:00Z",
    ...overrides,
  };
  await client.query(
    `INSERT INTO websites
       (id, business_id, url, source_url, normalized_url_hash, normalized_domain_hash,
        observed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [row.id, row.businessId, row.url, row.sourceUrl, row.urlHash, row.domainHash, row.observedAt],
  );
  return row;
}

async function insertEvidence(client, number, businessId, overrides = {}) {
  const row = {
    id: uuid(number),
    businessId,
    websiteId: null,
    sourceUrl: `https://evidence-${number}.example.invalid/observation`,
    observedAt: "2026-07-01T02:00:00Z",
    contentHash: hash(number + 300_000),
    signalType: "PUBLIC_LISTING",
    language: "en",
    signalAt: null,
    reviewCount: null,
    reviewRating: null,
    latestReviewAt: null,
    summary: `Synthetic evidence ${number}`,
    confidence: 90,
    ...overrides,
  };
  await client.query(
    `INSERT INTO lead_evidence
       (id, business_id, website_id, source_url, observed_at, content_hash, signal_type,
        language, signal_at, review_count, review_rating, latest_review_at, summary, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      row.id,
      row.businessId,
      row.websiteId,
      row.sourceUrl,
      row.observedAt,
      row.contentHash,
      row.signalType,
      row.language,
      row.signalAt,
      row.reviewCount,
      row.reviewRating,
      row.latestReviewAt,
      row.summary,
      row.confidence,
    ],
  );
  return row;
}

async function insertContact(client, number, businessId, overrides = {}) {
  const row = {
    id: uuid(number),
    businessId,
    routeType: "EMAIL",
    routeValue: `pilot-${number}@example.invalid`,
    recipientHash: hash(number + 400_000),
    sourceUrl: `https://contact-${number}.example.invalid/public`,
    observedAt: "2026-07-01T03:00:00Z",
    ...overrides,
  };
  await client.query(
    `INSERT INTO contacts
       (id, business_id, route_type, route_value, normalized_hash, source_url, observed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      row.id,
      row.businessId,
      row.routeType,
      row.routeValue,
      row.recipientHash,
      row.sourceUrl,
      row.observedAt,
    ],
  );
  return row;
}

async function insertDraft(client, number, businessId, contact, overrides = {}) {
  const row = {
    id: uuid(number),
    businessId,
    contactId: contact.id,
    language: "en",
    channel: contact.routeType,
    recipientHash: contact.recipientHash,
    subject: contact.routeType === "EMAIL" ? "Synthetic subject" : null,
    body: `Synthetic exact body ${number}`,
    payloadHash: hash(number + 500_000),
    createdAt: "2026-07-01T04:00:00Z",
    ...overrides,
  };
  await client.query(
    `INSERT INTO outreach_drafts
       (id, business_id, contact_id, language, channel, recipient_hash, subject, body,
        payload_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      row.id,
      row.businessId,
      row.contactId,
      row.language,
      row.channel,
      row.recipientHash,
      row.subject,
      row.body,
      row.payloadHash,
      row.createdAt,
    ],
  );
  return row;
}

async function insertPendingDraftApproval(client, number, draft, overrides = {}) {
  const row = {
    id: uuid(number),
    action: "DRAFT_APPROVAL",
    businessId: draft.businessId,
    draftId: draft.id,
    subjectId: draft.id,
    payloadHash: draft.payloadHash,
    recipientHash: draft.recipientHash,
    channel: draft.channel,
    requester: "fixture-operator",
    requestedAt: "2026-07-01T05:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
    reason: "Review exact immutable draft",
    ...overrides,
  };
  await client.query(
    `INSERT INTO approvals
       (id, action, business_id, draft_id, subject_id, payload_hash, recipient_hash,
        channel, status, requester, approver, requested_at, decided_at, expires_at, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, NULL, $10, NULL, $11, $12)`,
    [
      row.id,
      row.action,
      row.businessId,
      row.draftId,
      row.subjectId,
      row.payloadHash,
      row.recipientHash,
      row.channel,
      row.requester,
      row.requestedAt,
      row.expiresAt,
      row.reason,
    ],
  );
  const stored = await client.query(
    "SELECT requested_at, expires_at FROM approvals WHERE id = $1",
    [row.id],
  );
  return {
    ...row,
    requestedAt: stored.rows[0].requested_at,
    expiresAt: stored.rows[0].expires_at,
  };
}

async function decideApproval(client, approval, status, overrides = {}) {
  const terminal = {
    APPROVED: {
      approver: "amer",
      decidedAt: "2026-07-01T06:00:00Z",
    },
    REJECTED: {
      approver: "amer",
      decidedAt: "2026-07-01T06:00:00Z",
    },
    EXPIRED: {
      approver: null,
      decidedAt: approval.expiresAt,
    },
  }[status];
  const decision = { ...terminal, ...overrides };
  await client.query(
    `UPDATE approvals SET status = $1, approver = $2, decided_at = $3 WHERE id = $4`,
    [status, decision.approver, decision.decidedAt, approval.id],
  );
  const stored = await client.query("SELECT decided_at FROM approvals WHERE id = $1", [
    approval.id,
  ]);
  return { ...approval, status, ...decision, decidedAt: stored.rows[0].decided_at };
}

async function insertAttempt(client, number, fixture, overrides = {}) {
  if (fixture.approval.decidedAt !== undefined) {
    await waitUntilAfter(fixture.approval.decidedAt);
  }
  const row = {
    id: uuid(number),
    businessId: fixture.business.id,
    contactId: fixture.contact.id,
    draftId: fixture.draft.id,
    approvalId: fixture.approval.id,
    payloadHash: fixture.draft.payloadHash,
    recipientHash: fixture.contact.recipientHash,
    channel: fixture.contact.routeType,
    provider: "fixture-provider",
    idempotencyKey: `fixture-intent-${number}`,
    status: "INTENT",
    providerMessageId: null,
    providerThreadId: null,
    attemptedAt: "2026-07-01T07:00:00Z",
    reconciledAt: null,
    ...overrides,
  };
  await client.query(
    `INSERT INTO contact_attempts
       (id, business_id, contact_id, draft_id, approval_id, payload_hash, recipient_hash,
        channel, provider, idempotency_key, status, provider_message_id,
        provider_thread_id, attempted_at, reconciled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      row.id,
      row.businessId,
      row.contactId,
      row.draftId,
      row.approvalId,
      row.payloadHash,
      row.recipientHash,
      row.channel,
      row.provider,
      row.idempotencyKey,
      row.status,
      row.providerMessageId,
      row.providerThreadId,
      row.attemptedAt,
      row.reconciledAt,
    ],
  );
  const stored = await client.query("SELECT attempted_at FROM contact_attempts WHERE id = $1", [
    row.id,
  ]);
  return { ...row, attemptedAt: stored.rows[0].attempted_at };
}

async function createOutreachFixture(client, base, overrides = {}) {
  const business = await insertBusiness(client, base, overrides.business);
  if (overrides.website !== false) {
    await insertWebsite(client, base + 1, business.id, overrides.website);
  }
  const contact = await insertContact(client, base + 2, business.id, overrides.contact);
  const draft = await insertDraft(client, base + 3, business.id, contact, overrides.draft);
  const approvalOverrides = { ...overrides.approval };
  if (overrides.approvalStatus === "EXPIRED" && approvalOverrides.expiresAt === undefined) {
    approvalOverrides.expiresAt = futureIso(100);
  }
  let approval = await insertPendingDraftApproval(client, base + 4, draft, approvalOverrides);
  if (overrides.approvalStatus && overrides.approvalStatus !== "PENDING") {
    if (overrides.approvalStatus === "EXPIRED") {
      await waitUntilAfter(approval.expiresAt);
    }
    approval = await decideApproval(client, approval, overrides.approvalStatus);
  }
  return { business, contact, draft, approval };
}

test("Issue 28 A - stores worldwide DE GB AE fixtures across de en ar including Arabic Unicode", async (t) => {
  const client = await openMigratedDatabase(t);
  const fixtures = [
    {
      number: 1,
      name: "Atelier Berlin",
      city: "Berlin",
      region: "Berlin",
      countryCode: "DE",
      preferredLanguage: "de",
      category: "Architecture",
    },
    {
      number: 2,
      name: "London Dental Studio",
      city: "London",
      region: null,
      countryCode: "GB",
      preferredLanguage: "en",
      category: "Dentistry",
    },
    {
      number: 3,
      name: "\u0639\u064a\u0627\u062f\u0629 \u062f\u0628\u064a \u0627\u0644\u062d\u062f\u064a\u062b\u0629",
      city: "\u062f\u0628\u064a",
      region: "\u062f\u0628\u064a",
      countryCode: "AE",
      preferredLanguage: "ar",
      category: "\u0639\u064a\u0627\u062f\u0629 \u0637\u0628\u064a\u0629",
    },
  ];

  for (const fixture of fixtures) {
    const business = await insertBusiness(client, fixture.number, fixture);
    await insertEvidence(client, fixture.number + 10, business.id, {
      language: fixture.preferredLanguage,
      summary:
        fixture.preferredLanguage === "ar"
          ? "\u0646\u0634\u0627\u0637 \u062a\u062c\u0627\u0631\u064a \u062d\u062f\u064a\u062b \u0648\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0639\u0644\u0646\u064a\u0629"
          : `Current ${fixture.preferredLanguage} public listing`,
    });
  }

  const stored = await client.query(`
    SELECT country_code, preferred_language, city, name
    FROM businesses
    ORDER BY source_record_id
  `);
  assert.deepEqual(
    stored.rows.map(({ country_code, preferred_language }) => ({
      country_code,
      preferred_language,
    })),
    [
      { country_code: "DE", preferred_language: "de" },
      { country_code: "GB", preferred_language: "en" },
      { country_code: "AE", preferred_language: "ar" },
    ],
  );
  assert.equal(
    stored.rows[2].name,
    "\u0639\u064a\u0627\u062f\u0629 \u062f\u0628\u064a \u0627\u0644\u062d\u062f\u064a\u062b\u0629",
  );
});

test("Issue 28 A - rejects invalid worldwide shapes, duplicates, and incoherent review facts", async (t) => {
  const client = await openMigratedDatabase(t);
  const business = await insertBusiness(client, 20);

  for (const overrides of [
    { number: 21, sourceProvider: " " },
    { number: 22, sourceRecordId: " " },
    { number: 23, category: " " },
    { number: 24, city: " " },
    { number: 25, region: " " },
    { number: 26, countryCode: "gB" },
    { number: 27, countryCode: "GBR" },
    { number: 28, preferredLanguage: "fr" },
    { number: 29, identityHash: "ABC" },
  ]) {
    const { number, ...values } = overrides;
    await assert.rejects(insertBusiness(client, number, values), /check constraint|violates/i);
  }

  await assert.rejects(
    insertBusiness(client, 30, {
      sourceProvider: business.sourceProvider,
      sourceRecordId: business.sourceRecordId,
    }),
    /unique constraint|duplicate key/i,
  );
  await assert.rejects(
    insertBusiness(client, 31, { identityHash: business.identityHash }),
    /unique constraint|duplicate key/i,
  );
  await assert.rejects(
    insertEvidence(client, 32, business.id, { language: "fr" }),
    /check constraint|violates/i,
  );
  await assert.rejects(
    insertEvidence(client, 33, business.id, {
      signalType: "UNBOUNDED_SIGNAL",
    }),
    /check constraint|violates/i,
  );
  await assert.rejects(
    insertEvidence(client, 34, business.id, {
      signalType: "PUBLIC_LISTING",
      reviewCount: 10,
    }),
    /check constraint|violates/i,
  );
  await assert.rejects(
    insertEvidence(client, 35, business.id, {
      signalType: "RECENT_REVIEW",
      reviewCount: 0,
      reviewRating: 4.5,
    }),
    /check constraint|violates/i,
  );
  await assert.rejects(
    insertEvidence(client, 36, business.id, {
      signalType: "RECENT_REVIEW",
      reviewCount: 4,
      reviewRating: 5.1,
    }),
    /check constraint|violates/i,
  );
  await assert.rejects(
    insertEvidence(client, 361, business.id, {
      signalType: "RECENT_REVIEW",
      reviewRating: 4.5,
    }),
    /check constraint|violates/i,
  );
  await assert.rejects(
    insertEvidence(client, 37, business.id, {
      signalAt: "2027-01-01T00:00:00Z",
    }),
    /check constraint|violates/i,
  );
});

test("Issue 28 A - scopes normalized websites and contacts to businesses while preserving branches", async (t) => {
  const client = await openMigratedDatabase(t);
  const businessA = await insertBusiness(client, 40);
  const businessB = await insertBusiness(client, 41);
  const sharedUrlHash = hash(900_001);
  const sharedDomainHash = hash(900_002);
  const sharedRecipientHash = hash(900_003);

  await insertWebsite(client, 42, businessA.id, {
    url: "https://shared.example.invalid/contact",
    urlHash: sharedUrlHash,
    domainHash: sharedDomainHash,
  });
  await insertWebsite(client, 43, businessB.id, {
    url: "https://shared.example.invalid/contact",
    urlHash: sharedUrlHash,
    domainHash: sharedDomainHash,
  });
  await assert.rejects(
    insertWebsite(client, 44, businessA.id, { urlHash: sharedUrlHash }),
    /unique constraint|duplicate key/i,
  );
  for (const overrides of [
    { sourceUrl: " " },
    { urlHash: "A".repeat(64) },
    { domainHash: "not-a-sha256" },
  ]) {
    await assert.rejects(
      insertWebsite(client, 440 + Object.keys(overrides)[0].length, businessA.id, overrides),
      /check constraint|violates/i,
    );
  }

  await insertContact(client, 45, businessA.id, {
    routeValue: "shared@example.invalid",
    recipientHash: sharedRecipientHash,
  });
  await insertContact(client, 46, businessB.id, {
    routeValue: "shared@example.invalid",
    recipientHash: sharedRecipientHash,
  });
  await assert.rejects(
    insertContact(client, 47, businessA.id, { recipientHash: sharedRecipientHash }),
    /unique constraint|duplicate key/i,
  );
});

test("Issue 28 B - rejects evidence and findings crossing business or website identities", async (t) => {
  const client = await openMigratedDatabase(t);
  const businessA = await insertBusiness(client, 50);
  const businessB = await insertBusiness(client, 51);
  const websiteA = await insertWebsite(client, 52, businessA.id);
  const websiteB = await insertWebsite(client, 53, businessB.id);
  const evidenceA = await insertEvidence(client, 54, businessA.id, {
    websiteId: websiteA.id,
    signalType: "WEBSITE_OBSERVATION",
  });

  await assert.rejects(
    insertEvidence(client, 55, businessA.id, {
      websiteId: websiteB.id,
      signalType: "WEBSITE_OBSERVATION",
    }),
    /foreign key|constraint|violates/i,
  );
  await assert.rejects(
    client.query(
      `INSERT INTO audit_findings
         (id, business_id, website_id, evidence_id, category, observed_problem,
          why_it_matters, recommended_improvement, confidence, observed_at)
       VALUES ($1, $2, $3, $4, 'HOMEPAGE_CLARITY', 'Cross-business problem',
               'Misattributes evidence', 'Bind exact evidence', 95, now())`,
      [uuid(56), businessB.id, websiteB.id, evidenceA.id],
    ),
    /foreign key|constraint|violates/i,
  );
  await assert.rejects(
    client.query(
      `INSERT INTO audit_findings
         (id, business_id, website_id, evidence_id, category, observed_problem,
          why_it_matters, recommended_improvement, confidence, observed_at)
       VALUES ($1, $2, $3, $4, 'HOMEPAGE_CLARITY', 'Cross-website problem',
               'Misattributes evidence', 'Bind exact website', 95, now())`,
      [uuid(57), businessA.id, websiteB.id, evidenceA.id],
    ),
    /foreign key|constraint|violates/i,
  );
});

test("Issue 28 B - requires a website identity for website-specific signals", async (t) => {
  const client = await openMigratedDatabase(t);
  const business = await insertBusiness(client, 58);
  const website = await insertWebsite(client, 59, business.id);

  for (const [number, signalType] of [
    [580, "WEBSITE_UPDATE"],
    [581, "WEBSITE_OBSERVATION"],
  ]) {
    await assert.rejects(
      insertEvidence(client, number, business.id, { signalType }),
      /check constraint|violates/i,
    );
    await insertEvidence(client, number + 10, business.id, {
      websiteId: website.id,
      signalType,
    });
  }

  await insertEvidence(client, 582, business.id, { signalType: "PUBLIC_LISTING" });
});

test("Issue 28 C - binds draft channel and recipient to an exact immutable contact artifact", async (t) => {
  const client = await openMigratedDatabase(t);
  const business = await insertBusiness(client, 60);
  const email = await insertContact(client, 61, business.id);
  await insertDraft(client, 62, business.id, email);

  await assert.rejects(
    insertDraft(client, 63, business.id, email, { channel: "PHONE", subject: null }),
    /foreign key|constraint|violates/i,
  );
  await assert.rejects(
    insertDraft(client, 64, business.id, email, { recipientHash: hash(999_001) }),
    /foreign key|constraint|violates/i,
  );
  await assert.rejects(
    insertDraft(client, 65, business.id, email, { language: "fr" }),
    /check constraint|violates/i,
  );
  await assert.rejects(
    insertDraft(client, 66, business.id, email, { subject: null }),
    /check constraint|violates/i,
  );

  const phone = await insertContact(client, 67, business.id, {
    routeType: "PHONE",
    routeValue: "+000000000",
  });
  await insertDraft(client, 68, business.id, phone, { subject: null });
  await insertDraft(client, 69, business.id, phone, { subject: "Optional call note" });
  await assert.rejects(
    insertDraft(client, 70, business.id, phone, { subject: " " }),
    /check constraint|violates/i,
  );

  for (const statement of [
    `UPDATE contacts SET route_value = 'changed@example.invalid' WHERE id = '${email.id}'`,
    `UPDATE contacts SET normalized_hash = '${hash(999_002)}' WHERE id = '${email.id}'`,
    `DELETE FROM contacts WHERE id = '${email.id}'`,
    `UPDATE outreach_drafts SET body = 'Changed body' WHERE id = '${uuid(62)}'`,
    `UPDATE outreach_drafts SET payload_hash = '${hash(999_003)}' WHERE id = '${uuid(62)}'`,
    `DELETE FROM outreach_drafts WHERE id = '${uuid(62)}'`,
  ]) {
    await assert.rejects(client.exec(statement), /append-only/i);
  }
});

test("Issue 28 D - validates action-specific subject type and exact draft binding", async (t) => {
  const client = await openMigratedDatabase(t);
  const fixture = await createOutreachFixture(client, 80);

  await assert.rejects(
    insertPendingDraftApproval(client, 85, {
      ...fixture.draft,
      id: uuid(999_100),
    }),
    /foreign key|constraint|violates/i,
  );
  await assert.rejects(
    insertPendingDraftApproval(client, 86, fixture.draft, {
      payloadHash: hash(999_101),
    }),
    /foreign key|constraint|violates/i,
  );
  await assert.rejects(
    insertPendingDraftApproval(client, 87, fixture.draft, {
      recipientHash: hash(999_102),
    }),
    /foreign key|constraint|violates/i,
  );
  await assert.rejects(
    insertPendingDraftApproval(client, 88, fixture.draft, { channel: "PHONE" }),
    /foreign key|constraint|violates/i,
  );

  await assert.rejects(
    client.query(
      `INSERT INTO approvals
         (id, action, business_id, draft_id, subject_id, payload_hash, recipient_hash,
          channel, status, requester, requested_at, expires_at, reason)
       VALUES ($1, 'LEAD_APPROVAL', $2, NULL, $3, $4, NULL, NULL, 'PENDING',
               'operator', now(), now() + interval '1 hour', 'Mistyped subject')`,
      [uuid(89), fixture.business.id, fixture.draft.id, hash(999_103)],
    ),
    /check constraint|violates/i,
  );
  await assert.rejects(
    client.query(
      `INSERT INTO approvals
         (id, action, business_id, draft_id, subject_id, payload_hash, recipient_hash,
          channel, status, requester, requested_at, expires_at, reason)
       VALUES ($1, 'LEAD_APPROVAL', $2, NULL, $2, $3, NULL, NULL, 'PENDING',
               'operator', now(), now() + interval '1 hour', 'Missing business')`,
      [uuid(90), uuid(999_104), hash(999_105)],
    ),
    /foreign key|constraint|violates/i,
  );
});

test("Issue 28 D - prevents contradictory decisions and enforces one-way immutable lifecycle", async (t) => {
  const client = await openMigratedDatabase(t);
  const fixture = await createOutreachFixture(client, 100);
  const approval = fixture.approval;

  await assert.rejects(
    insertPendingDraftApproval(client, 105, fixture.draft),
    /unique constraint|duplicate key/i,
  );
  await assert.rejects(
    client.query(
      `INSERT INTO approvals
         (id, action, business_id, draft_id, subject_id, payload_hash, recipient_hash,
          channel, status, requester, approver, requested_at, decided_at, expires_at, reason)
       VALUES ($1, 'DRAFT_APPROVAL', $2, $3, $3, $4, $5, 'EMAIL', 'APPROVED',
               'operator', 'amer', '2026-07-01T05:00:00Z', '2026-07-01T06:00:00Z',
               '2026-07-03T00:00:00Z', 'Direct terminal')`,
      [
        uuid(106),
        fixture.business.id,
        fixture.draft.id,
        fixture.draft.payloadHash,
        fixture.draft.recipientHash,
      ],
    ),
    /begin PENDING/i,
  );
  await assert.rejects(
    client.query("UPDATE approvals SET requester = 'replacement' WHERE id = $1", [approval.id]),
    /immutable/i,
  );
  await assert.rejects(
    client.query("UPDATE approvals SET expires_at = expires_at + interval '1 day' WHERE id = $1", [
      approval.id,
    ]),
    /immutable/i,
  );

  await decideApproval(client, approval, "APPROVED");
  for (const statement of [
    `UPDATE approvals SET status = 'REJECTED' WHERE id = '${approval.id}'`,
    `UPDATE approvals SET payload_hash = '${hash(999_106)}' WHERE id = '${approval.id}'`,
    `DELETE FROM approvals WHERE id = '${approval.id}'`,
  ]) {
    await assert.rejects(client.exec(statement), /terminal|immutable|cannot be deleted/i);
  }
});

test("Issue 28 D - permits only coherent PENDING terminal decisions", async (t) => {
  const client = await openMigratedDatabase(t);
  const approved = await createOutreachFixture(client, 110);
  const rejected = await createOutreachFixture(client, 120);
  const expired = await createOutreachFixture(client, 130, {
    approval: { expiresAt: futureIso(100) },
  });
  const approvedDecision = await decideApproval(client, approved.approval, "APPROVED");
  const rejectedDecision = await decideApproval(client, rejected.approval, "REJECTED");
  await assert.rejects(
    decideApproval(client, expired.approval, "EXPIRED"),
    /before expiry has passed/i,
  );
  await waitUntilAfter(expired.approval.expiresAt);
  const expiredDecision = await decideApproval(client, expired.approval, "EXPIRED");

  assert.notEqual(new Date(approvedDecision.decidedAt).toISOString(), "2026-07-01T06:00:00.000Z");
  assert.notEqual(new Date(rejectedDecision.decidedAt).toISOString(), "2026-07-01T06:00:00.000Z");
  assert.ok(
    new Date(expiredDecision.decidedAt).getTime() > new Date(expired.approval.expiresAt).getTime(),
  );

  const decisions = await client.query(
    "SELECT status, approver, decided_at IS NOT NULL AS decided FROM approvals ORDER BY status",
  );
  assert.deepEqual(decisions.rows, [
    { status: "APPROVED", approver: "amer", decided: true },
    { status: "EXPIRED", approver: null, decided: true },
    { status: "REJECTED", approver: "amer", decided: true },
  ]);
});

test("Issue 28 E - requires exact approved unexpired approval and INTENT-only insertion", async (t) => {
  const client = await openMigratedDatabase(t);
  const approved = await createOutreachFixture(client, 140, { approvalStatus: "APPROVED" });
  const pending = await createOutreachFixture(client, 150);
  const rejected = await createOutreachFixture(client, 160, { approvalStatus: "REJECTED" });
  const expired = await createOutreachFixture(client, 170, { approvalStatus: "EXPIRED" });

  await assert.rejects(
    insertAttempt(client, 145, approved, { approvalId: uuid(999_200) }),
    /exact APPROVED|foreign key|constraint/i,
  );
  await assert.rejects(insertAttempt(client, 155, pending), /exact APPROVED/i);
  await assert.rejects(insertAttempt(client, 165, rejected), /exact APPROVED/i);
  await assert.rejects(insertAttempt(client, 175, expired), /exact APPROVED/i);
  for (const overrides of [
    { payloadHash: hash(999_201) },
    { recipientHash: hash(999_202) },
    { channel: "PHONE" },
    { contactId: uuid(999_203) },
    { draftId: uuid(999_204) },
  ]) {
    await assert.rejects(
      insertAttempt(client, 176 + Object.keys(overrides)[0].length, approved, overrides),
      /exact APPROVED|foreign key|constraint/i,
    );
  }
  await assert.rejects(
    insertAttempt(client, 182, approved, { status: "ACCEPTED" }),
    /begin as INTENT/i,
  );
  const attempt = await insertAttempt(client, 180, approved, {
    attemptedAt: "2000-01-01T00:00:00Z",
  });
  assert.notEqual(new Date(attempt.attemptedAt).toISOString(), "2000-01-01T00:00:00.000Z");
  assert.ok(
    new Date(attempt.attemptedAt).getTime() > new Date(approved.approval.decidedAt).getTime(),
  );
  assert.ok(
    new Date(attempt.attemptedAt).getTime() < new Date(approved.approval.expiresAt).getTime(),
  );
});

test("Issue 28 E - rejects caller timestamps that revive a historically expired approval window", async (t) => {
  const client = await openMigratedDatabase(t);

  await assert.rejects(async () => {
    const fixture = await createOutreachFixture(client, 190, {
      approval: {
        requestedAt: "2000-01-01T00:00:00Z",
        expiresAt: "2000-01-02T00:00:00Z",
      },
    });
    await decideApproval(client, fixture.approval, "APPROVED", {
      decidedAt: "2000-01-01T01:00:00Z",
    });
    await insertAttempt(client, 195, fixture, {
      attemptedAt: "2000-01-01T02:00:00Z",
    });
  }, /current[- ]time|must be in the future|already expired|historical approval|approval window/i);
});

test("Issue 28 E - rejects non-finite approval expiry timestamps", async (t) => {
  const client = await openMigratedDatabase(t);

  for (const [index, expiresAt] of ["infinity", "-infinity"].entries()) {
    await assert.rejects(
      createOutreachFixture(client, 196 + index, {
        approval: { expiresAt },
      }),
      /finite|future|check constraint|violates/i,
      expiresAt,
    );
  }
});

test("Issue 28 E - active GLOBAL CONTACT BUSINESS and DOMAIN suppressions all fail closed", async (t) => {
  for (const [index, scopeType] of ["GLOBAL", "CONTACT", "BUSINESS", "DOMAIN"].entries()) {
    await t.test(scopeType, async (child) => {
      const client = await openMigratedDatabase(child);
      const fixture = await createOutreachFixture(client, 200 + index * 10, {
        approvalStatus: "APPROVED",
      });
      const website = await client.query(
        "SELECT normalized_domain_hash FROM websites WHERE business_id = $1",
        [fixture.business.id],
      );
      const scopeHash = {
        GLOBAL: hash(999_300),
        CONTACT: fixture.contact.recipientHash,
        BUSINESS: fixture.business.identityHash,
        DOMAIN: website.rows[0].normalized_domain_hash,
      }[scopeType];
      await client.query(
        `INSERT INTO suppressions
           (id, scope_type, scope_hash, reason, source, created_at, active)
         VALUES ($1, $2, $3, 'Active opt out', 'fixture-operator', now(), true)`,
        [uuid(205 + index * 10), scopeType, scopeHash],
      );
      await assert.rejects(insertAttempt(client, 206 + index * 10, fixture), /active suppression/i);
    });
  }
});

test("Issue 28 E - globally deduplicates attempted recipients even across shared branches", async (t) => {
  const client = await openMigratedDatabase(t);
  const sharedRecipientHash = hash(999_400);
  const first = await createOutreachFixture(client, 250, {
    approvalStatus: "APPROVED",
    contact: {
      routeValue: "shared-branch@example.invalid",
      recipientHash: sharedRecipientHash,
    },
  });
  const second = await createOutreachFixture(client, 260, {
    approvalStatus: "APPROVED",
    contact: {
      routeValue: "shared-branch@example.invalid",
      recipientHash: sharedRecipientHash,
    },
  });
  await insertAttempt(client, 255, first);
  await assert.rejects(insertAttempt(client, 265, second), /unique constraint|duplicate key/i);
});

test("Issue 28 E - enforces the exhaustive contact-attempt transition matrix", async (t) => {
  const client = await openMigratedDatabase(t);
  const statuses = ["INTENT", "ACCEPTED", "FAILED", "UNCERTAIN", "RECONCILED"];
  const allowed = new Set([
    "INTENT->ACCEPTED",
    "INTENT->FAILED",
    "INTENT->UNCERTAIN",
    "ACCEPTED->RECONCILED",
    "FAILED->RECONCILED",
    "UNCERTAIN->RECONCILED",
  ]);
  let sequence = 300;

  for (const from of statuses) {
    for (const to of statuses) {
      sequence += 10;
      const fixture = await createOutreachFixture(client, sequence, {
        approvalStatus: "APPROVED",
      });
      const attempt = await insertAttempt(client, sequence + 5, fixture);
      if (from !== "INTENT") {
        const first = from === "RECONCILED" ? "ACCEPTED" : from;
        await client.query("UPDATE contact_attempts SET status = $1 WHERE id = $2", [
          first,
          attempt.id,
        ]);
        if (from === "RECONCILED") {
          await client.query(
            `UPDATE contact_attempts
             SET status = 'RECONCILED', provider_message_id = $1, reconciled_at = $2
             WHERE id = $3`,
            [`message-${sequence}`, "2026-07-01T08:00:00Z", attempt.id],
          );
        }
      }

      const transition = `${from}->${to}`;
      const values =
        to === "RECONCILED"
          ? [to, `message-${sequence}`, "2026-07-01T08:00:00Z", attempt.id]
          : [to, from === "RECONCILED" ? `message-${sequence}` : null, null, attempt.id];
      const operation = client.query(
        `UPDATE contact_attempts
         SET status = $1, provider_message_id = $2, reconciled_at = $3
         WHERE id = $4`,
        values,
      );
      if (allowed.has(transition)) {
        await operation;
      } else {
        await assert.rejects(operation, /invalid contact attempt status transition/i, transition);
      }
    }
  }
});

test("Issue 28 E - rejects reviewer mutation probe, missing reconciliation evidence, rewrites, and deletion", async (t) => {
  const client = await openMigratedDatabase(t);
  const uncertainFixture = await createOutreachFixture(client, 600, {
    approvalStatus: "APPROVED",
  });
  const uncertain = await insertAttempt(client, 605, uncertainFixture);
  await client.query("UPDATE contact_attempts SET status = 'UNCERTAIN' WHERE id = $1", [
    uncertain.id,
  ]);

  await assert.rejects(
    client.query(
      `UPDATE contact_attempts
       SET channel = 'PHONE', provider = 'replacement-provider', status = 'FAILED',
           provider_message_id = NULL, provider_thread_id = NULL,
           attempted_at = '2030-01-01T00:00:00Z', reconciled_at = NULL
       WHERE id = $1`,
      [uncertain.id],
    ),
    /immutable/i,
  );
  for (const statement of [
    `UPDATE contact_attempts SET business_id = '${uuid(999_601)}' WHERE id = '${uncertain.id}'`,
    `UPDATE contact_attempts SET contact_id = '${uuid(999_602)}' WHERE id = '${uncertain.id}'`,
    `UPDATE contact_attempts SET draft_id = '${uuid(999_603)}' WHERE id = '${uncertain.id}'`,
    `UPDATE contact_attempts SET approval_id = '${uuid(999_604)}' WHERE id = '${uncertain.id}'`,
    `UPDATE contact_attempts SET payload_hash = '${hash(999_605)}' WHERE id = '${uncertain.id}'`,
    `UPDATE contact_attempts SET recipient_hash = '${hash(999_606)}' WHERE id = '${uncertain.id}'`,
    `UPDATE contact_attempts SET idempotency_key = 'replacement-key' WHERE id = '${uncertain.id}'`,
  ]) {
    await assert.rejects(client.exec(statement), /immutable/i);
  }
  await assert.rejects(
    client.query(
      `UPDATE contact_attempts
       SET status = 'RECONCILED', reconciled_at = '2026-07-01T08:00:00Z'
       WHERE id = $1`,
      [uncertain.id],
    ),
    /check constraint|violates/i,
  );
  await assert.rejects(
    client.query("UPDATE contact_attempts SET status = 'FAILED' WHERE id = $1", [uncertain.id]),
    /invalid contact attempt status transition/i,
  );
  await assert.rejects(
    client.query("DELETE FROM contact_attempts WHERE id = $1", [uncertain.id]),
    /cannot be deleted/i,
  );

  const acceptedFixture = await createOutreachFixture(client, 610, {
    approvalStatus: "APPROVED",
  });
  const accepted = await insertAttempt(client, 615, acceptedFixture);
  await client.query(
    `UPDATE contact_attempts
     SET status = 'ACCEPTED', provider_message_id = 'provider-message'
     WHERE id = $1`,
    [accepted.id],
  );
  await assert.rejects(
    client.query(
      `UPDATE contact_attempts
       SET status = 'RECONCILED', provider_message_id = 'changed-message',
           reconciled_at = '2026-07-01T08:00:00Z'
       WHERE id = $1`,
      [accepted.id],
    ),
    /cannot be changed or cleared/i,
  );
  await assert.rejects(
    client.query(
      `UPDATE contact_attempts
       SET status = 'RECONCILED', provider_message_id = NULL,
           reconciled_at = '2026-07-01T08:00:00Z'
       WHERE id = $1`,
      [accepted.id],
    ),
    /cannot be changed or cleared/i,
  );
  await client.query(
    `UPDATE contact_attempts
     SET status = 'RECONCILED', reconciled_at = '2026-07-01T08:00:00Z'
     WHERE id = $1`,
    [accepted.id],
  );
});

test("Issue 28 F - preserves suppressions and historical audit and score outputs append-only", async (t) => {
  const client = await openMigratedDatabase(t);
  const business = await insertBusiness(client, 700);
  const website = await insertWebsite(client, 701, business.id);
  const evidence = await insertEvidence(client, 702, business.id, {
    websiteId: website.id,
    signalType: "WEBSITE_OBSERVATION",
  });
  const findingId = uuid(703);
  const scoreId = uuid(704);
  const suppressionId = uuid(705);
  await client.query(
    `INSERT INTO audit_findings
       (id, business_id, website_id, evidence_id, category, observed_problem,
        why_it_matters, recommended_improvement, confidence, observed_at)
     VALUES ($1, $2, $3, $4, 'HOMEPAGE_CLARITY', 'Problem', 'Impact',
             'Improvement', 90, now())`,
    [findingId, business.id, website.id, evidence.id],
  );
  await client.query(
    `INSERT INTO lead_scores
       (id, business_id, scoring_version, overall_confidence,
        active_business_score, active_business_evidence_id,
        website_opportunity_score, website_opportunity_evidence_id,
        commercial_fit_score, commercial_fit_evidence_id,
        contactability_score, contactability_evidence_id,
        personalization_score, personalization_evidence_id,
        response_likelihood_score, response_likelihood_evidence_id,
        total_score, hard_excluded, presentable, explanation, scored_at)
     VALUES ($1, $2, 'pilot-v1', 90, 20, $3, 20, $3, 15, $3, 10, $3, 5, $3,
             5, $3, 75, false, true, 'Traceable synthetic score', now())`,
    [scoreId, business.id, evidence.id],
  );
  await client.query(
    `INSERT INTO suppressions
       (id, scope_type, scope_hash, reason, source, created_at, active)
     VALUES ($1, 'CONTACT', $2, 'Opt out', 'fixture-operator', now(), true)`,
    [suppressionId, hash(999_500)],
  );
  await client.query(
    `INSERT INTO suppressions
       (id, scope_type, scope_hash, reason, source, created_at, active)
     VALUES ($1, 'CONTACT', $2, 'Older inactive history', 'fixture-import', now(), false)`,
    [uuid(706), hash(999_500)],
  );

  for (const statement of [
    `UPDATE suppressions SET active = false WHERE id = '${suppressionId}'`,
    `DELETE FROM suppressions WHERE id = '${suppressionId}'`,
    `UPDATE audit_findings SET observed_problem = 'Rewritten' WHERE id = '${findingId}'`,
    `DELETE FROM audit_findings WHERE id = '${findingId}'`,
    `UPDATE lead_scores SET explanation = 'Rewritten' WHERE id = '${scoreId}'`,
    `DELETE FROM lead_scores WHERE id = '${scoreId}'`,
  ]) {
    await assert.rejects(client.exec(statement), /append-only/i);
  }
  await assert.rejects(
    client.query(
      `INSERT INTO suppressions
         (id, scope_type, scope_hash, reason, source, created_at, active)
       VALUES ($1, 'CONTACT', $2, 'Contradictory active row', 'fixture', now(), true)`,
      [uuid(707), hash(999_500)],
    ),
    /unique constraint|duplicate key/i,
  );
});

test("Issue 28 G - binds all six versioned score components to same-business evidence", async (t) => {
  const client = await openMigratedDatabase(t);
  const businessA = await insertBusiness(client, 720);
  const businessB = await insertBusiness(client, 721);
  const evidenceA = await insertEvidence(client, 722, businessA.id);
  const evidenceB = await insertEvidence(client, 723, businessB.id);

  const insertScore = (number, evidenceIds, overrides = {}) =>
    client.query(
      `INSERT INTO lead_scores
         (id, business_id, scoring_version, overall_confidence,
          active_business_score, active_business_evidence_id,
          website_opportunity_score, website_opportunity_evidence_id,
          commercial_fit_score, commercial_fit_evidence_id,
          contactability_score, contactability_evidence_id,
          personalization_score, personalization_evidence_id,
          response_likelihood_score, response_likelihood_evidence_id,
          total_score, hard_excluded, presentable, explanation, scored_at)
       VALUES ($1, $2, $3, $4, 20, $5, 20, $6, 15, $7, 10, $8, 5, $9, 5, $10,
               75, false, true, 'Six traceable components', now())`,
      [
        uuid(number),
        businessA.id,
        overrides.scoringVersion ?? "pilot-v1",
        overrides.confidence ?? 90,
        ...evidenceIds,
      ],
    );
  const allA = Array(6).fill(evidenceA.id);
  await insertScore(724, allA);

  for (let index = 0; index < 6; index += 1) {
    const mixed = [...allA];
    mixed[index] = evidenceB.id;
    await assert.rejects(insertScore(725 + index, mixed), /foreign key|constraint|violates/i);
  }
  await assert.rejects(
    insertScore(731, allA, { scoringVersion: " " }),
    /check constraint|violates/i,
  );
  await assert.rejects(insertScore(732, allA, { confidence: 101 }), /check constraint|violates/i);
});

test("Issue 28 H - non-owner non-superuser gets zero SELECT rows and denied INSERT despite grants", async (t) => {
  const client = await openMigratedDatabase(t);
  await insertBusiness(client, 740);
  await client.exec(`
    CREATE ROLE issue28_browser NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    GRANT USAGE ON SCHEMA public TO issue28_browser;
    GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO issue28_browser;
    SET ROLE issue28_browser;
  `);
  const hidden = await client.query("SELECT COUNT(*)::integer AS row_count FROM businesses");
  assert.equal(hidden.rows[0].row_count, 0);
  await assert.rejects(
    client.query(
      `INSERT INTO businesses
         (id, name, source_url, source_provider, source_record_id, category, city, region,
          country_code, preferred_language, normalized_identity_hash, collected_at)
       VALUES ($1, 'Blocked', 'https://blocked.example.invalid/source', 'fixture',
               'blocked', 'Blocked', 'Blocked', NULL, 'AE', 'ar', $2, now())`,
      [uuid(741), hash(741)],
    ),
    /row-level security|policy/i,
  );
  await client.exec("RESET ROLE");
  const visible = await client.query("SELECT COUNT(*)::integer AS row_count FROM businesses");
  assert.equal(visible.rows[0].row_count, 1);
});

test("Issue 28 - keeps business and website suppression and dedupe identities append-only", async (t) => {
  const client = await openMigratedDatabase(t);
  const fixture = await createOutreachFixture(client, 800, {
    approvalStatus: "APPROVED",
    approval: { expiresAt: "2099-01-01T00:00:00Z" },
  });
  const website = await client.query(
    `SELECT id, normalized_url_hash, normalized_domain_hash
     FROM websites
     WHERE business_id = $1`,
    [fixture.business.id],
  );
  const discoveredWebsite = website.rows[0];

  await client.query(
    `INSERT INTO suppressions
       (id, scope_type, scope_hash, reason, source, created_at, active)
     VALUES
       ($1, 'BUSINESS', $2, 'Stable business identity', 'fixture-operator', now(), true),
       ($3, 'DOMAIN', $4, 'Stable domain identity', 'fixture-operator', now(), true)`,
    [uuid(806), fixture.business.identityHash, uuid(807), discoveredWebsite.normalized_domain_hash],
  );

  const deletionBusiness = await insertBusiness(client, 820);
  const websiteOwner = await insertBusiness(client, 830);
  const deletionWebsite = await insertWebsite(client, 831, websiteOwner.id);

  const outcome = async (operation) => {
    try {
      await operation();
      return "accepted";
    } catch (error) {
      const message = String(error?.message ?? error);
      if (/append-only/i.test(message)) {
        return "rejected by append-only guard";
      }
      if (/active suppression/i.test(message)) {
        return "rejected by active suppression";
      }
      return `rejected for another reason: ${message}`;
    }
  };

  const observed = {
    businessIdentityHashUpdate: await outcome(() =>
      client.query(
        "UPDATE businesses SET normalized_identity_hash = $1 WHERE id = $2 RETURNING id",
        [hash(999_801), fixture.business.id],
      ),
    ),
    businessSourceProviderUpdate: await outcome(() =>
      client.query("UPDATE businesses SET source_provider = $1 WHERE id = $2 RETURNING id", [
        "corrected-directory",
        fixture.business.id,
      ]),
    ),
    businessSourceRecordIdUpdate: await outcome(() =>
      client.query("UPDATE businesses SET source_record_id = $1 WHERE id = $2 RETURNING id", [
        "corrected-record-800",
        fixture.business.id,
      ]),
    ),
    websiteDomainHashUpdate: await outcome(() =>
      client.query("UPDATE websites SET normalized_domain_hash = $1 WHERE id = $2 RETURNING id", [
        hash(999_802),
        discoveredWebsite.id,
      ]),
    ),
    websiteUrlHashUpdate: await outcome(() =>
      client.query("UPDATE websites SET normalized_url_hash = $1 WHERE id = $2 RETURNING id", [
        hash(999_803),
        discoveredWebsite.id,
      ]),
    ),
    websiteUrlUpdate: await outcome(() =>
      client.query("UPDATE websites SET url = $1 WHERE id = $2 RETURNING id", [
        "https://corrected.example.invalid/path",
        discoveredWebsite.id,
      ]),
    ),
    laterSuppressionCheck: await outcome(() =>
      insertAttempt(client, 808, fixture, {
        attemptedAt: "2026-07-27T00:00:00Z",
      }),
    ),
    discoveredWebsiteDelete: await outcome(() =>
      client.query("DELETE FROM websites WHERE id = $1 RETURNING id", [deletionWebsite.id]),
    ),
    discoveredBusinessDelete: await outcome(() =>
      client.query("DELETE FROM businesses WHERE id = $1 RETURNING id", [deletionBusiness.id]),
    ),
  };

  assert.deepEqual(observed, {
    businessIdentityHashUpdate: "rejected by append-only guard",
    businessSourceProviderUpdate: "rejected by append-only guard",
    businessSourceRecordIdUpdate: "rejected by append-only guard",
    websiteDomainHashUpdate: "rejected by append-only guard",
    websiteUrlHashUpdate: "rejected by append-only guard",
    websiteUrlUpdate: "rejected by append-only guard",
    laterSuppressionCheck: "rejected by active suppression",
    discoveredWebsiteDelete: "rejected by append-only guard",
    discoveredBusinessDelete: "rejected by append-only guard",
  });
});
