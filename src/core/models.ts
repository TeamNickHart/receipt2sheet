export const MODEL_ALIASES: Record<string, string> = {
  small: 'claude-haiku-4-5-20251001',
  medium: 'claude-sonnet-4-6',
  large: 'claude-opus-4-6',
};

const DEFAULT_MODEL = 'medium';

export function resolveModel(): string {
  const env = process.env.R2S_MODEL || DEFAULT_MODEL;
  return MODEL_ALIASES[env] || env;
}
