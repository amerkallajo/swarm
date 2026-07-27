-- Canonical forward-only pilot data model migration.

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  source_url text NOT NULL CHECK (btrim(source_url) <> ''),
  source_provider text NOT NULL CHECK (btrim(source_provider) <> ''),
  source_record_id text NOT NULL CHECK (btrim(source_record_id) <> ''),
  category text NOT NULL CHECK (btrim(category) <> ''),
  city text NOT NULL CHECK (btrim(city) <> ''),
  region text CHECK (region IS NULL OR btrim(region) <> ''),
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  preferred_language text NOT NULL CHECK (preferred_language IN ('de', 'en', 'ar')),
  normalized_identity_hash text NOT NULL
    CHECK (normalized_identity_hash ~ '^[0-9a-f]{64}$'),
  collected_at timestamptz NOT NULL,
  UNIQUE (source_provider, source_record_id),
  UNIQUE (normalized_identity_hash)
);

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  route_type text NOT NULL
    CHECK (route_type IN ('EMAIL', 'PHONE', 'CONTACT_FORM', 'OTHER')),
  route_value text NOT NULL CHECK (btrim(route_value) <> ''),
  normalized_hash text NOT NULL CHECK (normalized_hash ~ '^[0-9a-f]{64}$'),
  source_url text NOT NULL CHECK (btrim(source_url) <> ''),
  observed_at timestamptz NOT NULL,
  UNIQUE (business_id, normalized_hash),
  UNIQUE (id, business_id, route_type, normalized_hash)
);

CREATE TABLE public.websites (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  url text NOT NULL CHECK (btrim(url) <> ''),
  source_url text NOT NULL CHECK (btrim(source_url) <> ''),
  normalized_url_hash text NOT NULL
    CHECK (normalized_url_hash ~ '^[0-9a-f]{64}$'),
  normalized_domain_hash text NOT NULL
    CHECK (normalized_domain_hash ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz NOT NULL,
  UNIQUE (business_id, normalized_url_hash),
  UNIQUE (id, business_id)
);

CREATE TABLE public.lead_evidence (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  website_id uuid,
  source_url text NOT NULL CHECK (btrim(source_url) <> ''),
  observed_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  signal_type text NOT NULL CHECK (
    signal_type IN (
      'PUBLIC_LISTING',
      'RECENT_REVIEW',
      'OPENING_HOURS',
      'SOCIAL_ACTIVITY',
      'WEBSITE_UPDATE',
      'PORTFOLIO_PROJECT',
      'CONTACT_VALIDATION',
      'WEBSITE_OBSERVATION',
      'OTHER'
    )
  ),
  language text NOT NULL CHECK (language IN ('de', 'en', 'ar')),
  signal_at timestamptz,
  review_count integer,
  review_rating numeric,
  latest_review_at timestamptz,
  summary text NOT NULL CHECK (btrim(summary) <> ''),
  confidence smallint NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  CHECK (
    website_id IS NOT NULL
    OR signal_type NOT IN ('WEBSITE_UPDATE', 'WEBSITE_OBSERVATION')
  ),
  CHECK (signal_at IS NULL OR signal_at <= observed_at),
  CHECK (
    (
      signal_type = 'RECENT_REVIEW'
      AND (review_count IS NULL OR review_count >= 0)
      AND (review_rating IS NULL OR review_rating BETWEEN 0 AND 5)
      AND (
        review_count IS NOT NULL
        OR (review_rating IS NULL AND latest_review_at IS NULL)
      )
      AND (
        review_count IS NULL
        OR review_count > 0
        OR (review_rating IS NULL AND latest_review_at IS NULL)
      )
      AND (
        review_rating IS NULL
        OR (review_count IS NOT NULL AND review_count > 0)
      )
      AND (
        latest_review_at IS NULL
        OR (review_count IS NOT NULL AND review_count > 0)
      )
      AND (latest_review_at IS NULL OR latest_review_at <= observed_at)
    )
    OR (
      signal_type <> 'RECENT_REVIEW'
      AND review_count IS NULL
      AND review_rating IS NULL
      AND latest_review_at IS NULL
    )
  ),
  UNIQUE (id, business_id),
  UNIQUE (id, website_id, business_id),
  FOREIGN KEY (website_id, business_id)
    REFERENCES public.websites(id, business_id) ON DELETE RESTRICT
);

CREATE TABLE public.audit_findings (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  website_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  category text NOT NULL CHECK (
    category IN (
      'MOBILE_USABILITY',
      'HOMEPAGE_CLARITY',
      'LOADING_PERFORMANCE',
      'HTTPS_TECHNICAL',
      'CTA_CONTACT',
      'SERVICE_PRESENTATION',
      'TRUST_SIGNALS',
      'SEO_FUNDAMENTALS',
      'BROKEN_INTERACTIONS',
      'CONVERSION_PATH'
    )
  ),
  observed_problem text NOT NULL CHECK (btrim(observed_problem) <> ''),
  why_it_matters text NOT NULL CHECK (btrim(why_it_matters) <> ''),
  recommended_improvement text NOT NULL CHECK (btrim(recommended_improvement) <> ''),
  confidence smallint NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  observed_at timestamptz NOT NULL,
  FOREIGN KEY (website_id, business_id)
    REFERENCES public.websites(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (evidence_id, website_id, business_id)
    REFERENCES public.lead_evidence(id, website_id, business_id) ON DELETE RESTRICT
);

CREATE TABLE public.lead_scores (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  scoring_version text NOT NULL CHECK (btrim(scoring_version) <> ''),
  overall_confidence smallint NOT NULL CHECK (overall_confidence BETWEEN 0 AND 100),
  active_business_score integer NOT NULL
    CHECK (active_business_score BETWEEN 0 AND 20),
  active_business_evidence_id uuid NOT NULL,
  website_opportunity_score integer NOT NULL
    CHECK (website_opportunity_score BETWEEN 0 AND 25),
  website_opportunity_evidence_id uuid NOT NULL,
  commercial_fit_score integer NOT NULL
    CHECK (commercial_fit_score BETWEEN 0 AND 20),
  commercial_fit_evidence_id uuid NOT NULL,
  contactability_score integer NOT NULL
    CHECK (contactability_score BETWEEN 0 AND 15),
  contactability_evidence_id uuid NOT NULL,
  personalization_score integer NOT NULL
    CHECK (personalization_score BETWEEN 0 AND 10),
  personalization_evidence_id uuid NOT NULL,
  response_likelihood_score integer NOT NULL
    CHECK (response_likelihood_score BETWEEN 0 AND 10),
  response_likelihood_evidence_id uuid NOT NULL,
  total_score integer NOT NULL CHECK (
    total_score BETWEEN 0 AND 100
    AND total_score = (
      active_business_score
      + website_opportunity_score
      + commercial_fit_score
      + contactability_score
      + personalization_score
      + response_likelihood_score
    )
  ),
  hard_excluded boolean NOT NULL,
  presentable boolean NOT NULL CHECK (
    NOT presentable OR (total_score >= 65 AND NOT hard_excluded)
  ),
  explanation text NOT NULL CHECK (btrim(explanation) <> ''),
  scored_at timestamptz NOT NULL,
  FOREIGN KEY (active_business_evidence_id, business_id)
    REFERENCES public.lead_evidence(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (website_opportunity_evidence_id, business_id)
    REFERENCES public.lead_evidence(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (commercial_fit_evidence_id, business_id)
    REFERENCES public.lead_evidence(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (contactability_evidence_id, business_id)
    REFERENCES public.lead_evidence(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (personalization_evidence_id, business_id)
    REFERENCES public.lead_evidence(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (response_likelihood_evidence_id, business_id)
    REFERENCES public.lead_evidence(id, business_id) ON DELETE RESTRICT
);

CREATE TABLE public.outreach_drafts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL,
  language text NOT NULL CHECK (language IN ('de', 'en', 'ar')),
  channel text NOT NULL CHECK (channel IN ('EMAIL', 'PHONE', 'CONTACT_FORM', 'OTHER')),
  recipient_hash text NOT NULL CHECK (recipient_hash ~ '^[0-9a-f]{64}$'),
  subject text CHECK (
    (channel = 'EMAIL' AND subject IS NOT NULL AND btrim(subject) <> '')
    OR (channel <> 'EMAIL' AND (subject IS NULL OR btrim(subject) <> ''))
  ),
  body text NOT NULL CHECK (btrim(body) <> ''),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  UNIQUE (id, business_id, contact_id, channel, recipient_hash, payload_hash),
  UNIQUE (id, business_id, channel, recipient_hash, payload_hash),
  FOREIGN KEY (contact_id, business_id, channel, recipient_hash)
    REFERENCES public.contacts(id, business_id, route_type, normalized_hash)
    ON DELETE RESTRICT
);

CREATE TABLE public.approvals (
  id uuid PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('LEAD_APPROVAL', 'DRAFT_APPROVAL')),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  draft_id uuid,
  subject_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  recipient_hash text CHECK (
    recipient_hash IS NULL OR recipient_hash ~ '^[0-9a-f]{64}$'
  ),
  channel text CHECK (
    channel IS NULL OR channel IN ('EMAIL', 'PHONE', 'CONTACT_FORM', 'OTHER')
  ),
  status text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  requester text NOT NULL CHECK (btrim(requester) <> ''),
  approver text CHECK (approver IS NULL OR btrim(approver) <> ''),
  requested_at timestamptz NOT NULL,
  decided_at timestamptz,
  expires_at timestamptz NOT NULL CHECK (
    isfinite(expires_at) AND expires_at > requested_at
  ),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  CHECK (
    (
      action = 'LEAD_APPROVAL'
      AND draft_id IS NULL
      AND subject_id = business_id
      AND recipient_hash IS NULL
      AND channel IS NULL
    )
    OR (
      action = 'DRAFT_APPROVAL'
      AND draft_id IS NOT NULL
      AND subject_id = draft_id
      AND recipient_hash IS NOT NULL
      AND channel IS NOT NULL
    )
  ),
  CHECK (
    (status = 'PENDING' AND approver IS NULL AND decided_at IS NULL)
    OR (
      status IN ('APPROVED', 'REJECTED')
      AND approver IS NOT NULL
      AND decided_at BETWEEN requested_at AND expires_at
    )
    OR (
      status = 'EXPIRED'
      AND approver IS NULL
      AND decided_at >= expires_at
    )
  ),
  UNIQUE (action, subject_id, payload_hash),
  UNIQUE (id, business_id, draft_id, payload_hash, recipient_hash, channel),
  FOREIGN KEY (draft_id, business_id, channel, recipient_hash, payload_hash)
    REFERENCES public.outreach_drafts(
      id, business_id, channel, recipient_hash, payload_hash
    ) ON DELETE RESTRICT
);

CREATE TABLE public.contact_attempts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  draft_id uuid NOT NULL UNIQUE,
  approval_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  recipient_hash text NOT NULL UNIQUE CHECK (recipient_hash ~ '^[0-9a-f]{64}$'),
  channel text NOT NULL CHECK (channel IN ('EMAIL', 'PHONE', 'CONTACT_FORM', 'OTHER')),
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  idempotency_key text NOT NULL UNIQUE CHECK (btrim(idempotency_key) <> ''),
  status text NOT NULL CHECK (
    status IN ('INTENT', 'ACCEPTED', 'RECONCILED', 'FAILED', 'UNCERTAIN')
  ),
  provider_message_id text
    CHECK (provider_message_id IS NULL OR btrim(provider_message_id) <> ''),
  provider_thread_id text
    CHECK (provider_thread_id IS NULL OR btrim(provider_thread_id) <> ''),
  attempted_at timestamptz NOT NULL,
  reconciled_at timestamptz,
  CHECK (
    (
      status = 'RECONCILED'
      AND reconciled_at IS NOT NULL
      AND (provider_message_id IS NOT NULL OR provider_thread_id IS NOT NULL)
    )
    OR (status <> 'RECONCILED' AND reconciled_at IS NULL)
  ),
  FOREIGN KEY (
    draft_id, business_id, contact_id, channel, recipient_hash, payload_hash
  ) REFERENCES public.outreach_drafts(
    id, business_id, contact_id, channel, recipient_hash, payload_hash
  ) ON DELETE RESTRICT,
  FOREIGN KEY (
    approval_id, business_id, draft_id, payload_hash, recipient_hash, channel
  ) REFERENCES public.approvals(
    id, business_id, draft_id, payload_hash, recipient_hash, channel
  ) ON DELETE RESTRICT
);

CREATE TABLE public.suppressions (
  id uuid PRIMARY KEY,
  scope_type text NOT NULL CHECK (scope_type IN ('CONTACT', 'BUSINESS', 'DOMAIN', 'GLOBAL')),
  scope_hash text NOT NULL CHECK (scope_hash ~ '^[0-9a-f]{64}$'),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  source text NOT NULL CHECK (btrim(source) <> ''),
  created_at timestamptz NOT NULL,
  active boolean NOT NULL
);

CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (
    event_type IN (
      'BUSINESS_DISCOVERED',
      'EVIDENCE_OBSERVED',
      'AUDIT_FINDING_RECORDED',
      'LEAD_SCORED',
      'DRAFT_CREATED',
      'APPROVAL_REQUESTED',
      'APPROVAL_DECIDED',
      'CONTACT_ATTEMPTED',
      'CONTACT_RECONCILED',
      'SUPPRESSION_RECORDED'
    )
  ),
  actor text NOT NULL CHECK (btrim(actor) <> ''),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  correlation_id text NOT NULL CHECK (btrim(correlation_id) <> ''),
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX suppressions_active_scope_uidx
ON public.suppressions (scope_type, scope_hash)
WHERE active;

CREATE INDEX websites_business_domain_idx
ON public.websites (business_id, normalized_domain_hash);

CREATE INDEX lead_evidence_business_recency_idx
ON public.lead_evidence (business_id, observed_at DESC);

CREATE INDEX lead_scores_presentable_ranking_idx
ON public.lead_scores (total_score DESC, scored_at DESC)
WHERE presentable;

CREATE INDEX contact_attempts_status_idx
ON public.contact_attempts (status, attempted_at);

CREATE FUNCTION public.deny_append_only_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE FUNCTION public.enforce_approval_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  decision_time timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING' THEN
      RAISE EXCEPTION 'approval must begin PENDING';
    END IF;

    NEW.requested_at := clock_timestamp();
    IF NEW.expires_at <= NEW.requested_at THEN
      RAISE EXCEPTION 'approval expires_at must be in the future at current time';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'approval cannot be deleted';
  END IF;

  IF ROW(
    OLD.id,
    OLD.action,
    OLD.business_id,
    OLD.draft_id,
    OLD.subject_id,
    OLD.payload_hash,
    OLD.recipient_hash,
    OLD.channel,
    OLD.requester,
    OLD.requested_at,
    OLD.expires_at,
    OLD.reason
  ) IS DISTINCT FROM ROW(
    NEW.id,
    NEW.action,
    NEW.business_id,
    NEW.draft_id,
    NEW.subject_id,
    NEW.payload_hash,
    NEW.recipient_hash,
    NEW.channel,
    NEW.requester,
    NEW.requested_at,
    NEW.expires_at,
    NEW.reason
  ) THEN
    RAISE EXCEPTION 'approval identity and request binding are immutable';
  END IF;

  IF OLD.status <> 'PENDING' THEN
    RAISE EXCEPTION 'terminal approval decision is immutable';
  END IF;

  IF NEW.status NOT IN ('APPROVED', 'REJECTED', 'EXPIRED') THEN
    RAISE EXCEPTION 'approval transition must leave PENDING for one terminal decision';
  END IF;

  decision_time := clock_timestamp();
  IF NEW.status IN ('APPROVED', 'REJECTED') THEN
    IF decision_time >= OLD.expires_at THEN
      RAISE EXCEPTION 'approval is already expired at current time';
    END IF;
  ELSIF decision_time <= OLD.expires_at THEN
    RAISE EXCEPTION 'approval cannot be marked EXPIRED before expiry has passed';
  END IF;

  NEW.decided_at := decision_time;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.enforce_contact_attempt_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  approval_status text;
  approval_decided_at timestamptz;
  approval_expires_at timestamptz;
BEGIN
  IF NEW.status <> 'INTENT' THEN
    RAISE EXCEPTION 'contact attempt must begin as INTENT';
  END IF;

  IF NEW.provider_message_id IS NOT NULL OR NEW.provider_thread_id IS NOT NULL THEN
    RAISE EXCEPTION 'INTENT cannot contain provider reconciliation identifiers';
  END IF;

  NEW.attempted_at := clock_timestamp();

  SELECT status, decided_at, expires_at
  INTO approval_status, approval_decided_at, approval_expires_at
  FROM public.approvals
  WHERE id = NEW.approval_id
    AND action = 'DRAFT_APPROVAL'
    AND business_id = NEW.business_id
    AND draft_id = NEW.draft_id
    AND subject_id = NEW.draft_id
    AND payload_hash = NEW.payload_hash
    AND recipient_hash = NEW.recipient_hash
    AND channel = NEW.channel;

  IF NOT FOUND OR approval_status <> 'APPROVED' THEN
    RAISE EXCEPTION 'contact intent requires an exact APPROVED DRAFT_APPROVAL';
  END IF;

  IF NEW.attempted_at <= approval_decided_at OR NEW.attempted_at >= approval_expires_at THEN
    RAISE EXCEPTION 'contact intent is outside the approval window';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.suppressions AS suppression
    WHERE suppression.active
      AND (
        suppression.scope_type = 'GLOBAL'
        OR (
          suppression.scope_type = 'CONTACT'
          AND suppression.scope_hash = NEW.recipient_hash
        )
        OR (
          suppression.scope_type = 'BUSINESS'
          AND suppression.scope_hash = (
            SELECT business.normalized_identity_hash
            FROM public.businesses AS business
            WHERE business.id = NEW.business_id
          )
        )
        OR (
          suppression.scope_type = 'DOMAIN'
          AND EXISTS (
            SELECT 1
            FROM public.websites AS website
            WHERE website.business_id = NEW.business_id
              AND website.normalized_domain_hash = suppression.scope_hash
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'contact intent is blocked by an active suppression';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.enforce_contact_attempt_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'contact attempt cannot be deleted';
  END IF;

  IF ROW(
    OLD.id,
    OLD.business_id,
    OLD.contact_id,
    OLD.draft_id,
    OLD.approval_id,
    OLD.payload_hash,
    OLD.recipient_hash,
    OLD.channel,
    OLD.provider,
    OLD.idempotency_key,
    OLD.attempted_at
  ) IS DISTINCT FROM ROW(
    NEW.id,
    NEW.business_id,
    NEW.contact_id,
    NEW.draft_id,
    NEW.approval_id,
    NEW.payload_hash,
    NEW.recipient_hash,
    NEW.channel,
    NEW.provider,
    NEW.idempotency_key,
    NEW.attempted_at
  ) THEN
    RAISE EXCEPTION 'contact attempt identity and original intent are immutable';
  END IF;

  IF (
    OLD.provider_message_id IS NOT NULL
    AND NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id
  ) OR (
    OLD.provider_thread_id IS NOT NULL
    AND NEW.provider_thread_id IS DISTINCT FROM OLD.provider_thread_id
  ) THEN
    RAISE EXCEPTION 'provider identifiers cannot be changed or cleared';
  END IF;

  IF NOT (
    (
      OLD.status = 'INTENT'
      AND NEW.status IN ('ACCEPTED', 'FAILED', 'UNCERTAIN')
    )
    OR (
      OLD.status IN ('ACCEPTED', 'FAILED', 'UNCERTAIN')
      AND NEW.status = 'RECONCILED'
    )
  ) THEN
    RAISE EXCEPTION 'invalid contact attempt status transition';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER businesses_append_only
BEFORE UPDATE OR DELETE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

CREATE TRIGGER websites_append_only
BEFORE UPDATE OR DELETE ON public.websites
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

CREATE TRIGGER contacts_append_only
BEFORE UPDATE OR DELETE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

CREATE TRIGGER lead_evidence_append_only
BEFORE UPDATE OR DELETE ON public.lead_evidence
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

CREATE TRIGGER audit_findings_append_only
BEFORE UPDATE OR DELETE ON public.audit_findings
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

CREATE TRIGGER lead_scores_append_only
BEFORE UPDATE OR DELETE ON public.lead_scores
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

CREATE TRIGGER outreach_drafts_append_only
BEFORE UPDATE OR DELETE ON public.outreach_drafts
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

CREATE TRIGGER approval_lifecycle
BEFORE INSERT OR UPDATE OR DELETE ON public.approvals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_approval_lifecycle();

CREATE TRIGGER contact_attempt_insert_guard
BEFORE INSERT ON public.contact_attempts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_contact_attempt_insert();

CREATE TRIGGER contact_attempt_update_guard
BEFORE UPDATE OR DELETE ON public.contact_attempts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_contact_attempt_update();

CREATE TRIGGER suppressions_append_only
BEFORE UPDATE OR DELETE ON public.suppressions
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

CREATE TRIGGER activity_events_append_only
BEFORE UPDATE OR DELETE ON public.activity_events
FOR EACH ROW
EXECUTE FUNCTION public.deny_append_only_change();

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lead_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events FORCE ROW LEVEL SECURITY;
