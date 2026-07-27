export interface OutboundEnvironment {
  readonly OUTREACH_ENABLED?: string;
  readonly PREVIEW_PUBLISH_ENABLED?: string;
}

export interface OutboundSafetyFlags {
  readonly outreachEnabled: boolean;
  readonly previewPublishEnabled: boolean;
}

export function resolveOutboundSafetyFlags(
  environment: OutboundEnvironment = {},
): OutboundSafetyFlags {
  return {
    outreachEnabled: environment.OUTREACH_ENABLED === "true",
    previewPublishEnabled: environment.PREVIEW_PUBLISH_ENABLED === "true",
  };
}
