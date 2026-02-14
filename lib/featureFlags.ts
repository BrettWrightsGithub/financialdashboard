const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ENABLED_VALUES.has(value.trim().toLowerCase());
}

export const featureFlags = {
  assistantPanelV2: parseBooleanFlag(process.env.NEXT_PUBLIC_ASSISTANT_V2_ENABLED),
} as const;

export function isAssistantPanelV2Enabled(): boolean {
  return featureFlags.assistantPanelV2;
}
