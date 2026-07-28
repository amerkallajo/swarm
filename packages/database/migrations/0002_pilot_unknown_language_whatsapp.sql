-- Preserve unknown language truth and make WhatsApp an exact channel.

ALTER TABLE public.businesses
  DROP CONSTRAINT businesses_preferred_language_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_preferred_language_check
  CHECK (preferred_language IN ('de', 'en', 'ar', 'unknown'));

ALTER TABLE public.lead_evidence
  DROP CONSTRAINT lead_evidence_language_check;
ALTER TABLE public.lead_evidence
  ADD CONSTRAINT lead_evidence_language_check
  CHECK (language IN ('de', 'en', 'ar', 'unknown'));

ALTER TABLE public.contacts
  DROP CONSTRAINT contacts_route_type_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_route_type_check
  CHECK (route_type IN ('EMAIL', 'PHONE', 'WHATSAPP', 'CONTACT_FORM', 'OTHER'));

ALTER TABLE public.outreach_drafts
  DROP CONSTRAINT outreach_drafts_channel_check;
ALTER TABLE public.outreach_drafts
  ADD CONSTRAINT outreach_drafts_channel_check
  CHECK (channel IN ('EMAIL', 'PHONE', 'WHATSAPP', 'CONTACT_FORM', 'OTHER'));

ALTER TABLE public.approvals
  DROP CONSTRAINT approvals_channel_check;
ALTER TABLE public.approvals
  ADD CONSTRAINT approvals_channel_check
  CHECK (
    channel IS NULL
    OR channel IN ('EMAIL', 'PHONE', 'WHATSAPP', 'CONTACT_FORM', 'OTHER')
  );

ALTER TABLE public.contact_attempts
  DROP CONSTRAINT contact_attempts_channel_check;
ALTER TABLE public.contact_attempts
  ADD CONSTRAINT contact_attempts_channel_check
  CHECK (channel IN ('EMAIL', 'PHONE', 'WHATSAPP', 'CONTACT_FORM', 'OTHER'));
