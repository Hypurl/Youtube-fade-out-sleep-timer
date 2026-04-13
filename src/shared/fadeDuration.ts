export const FADE_DURATION_PRESETS = [
  { id: "1m", label: "1m", seconds: 60 },
  { id: "3m", label: "3m", seconds: 180 },
  { id: "5m", label: "5m", seconds: 300 },
  { id: "10m", label: "10m", seconds: 600 },
] as const;

export const DEFAULT_FADE_DURATION_SECONDS = 300;

export function sanitizeFadeDurationSeconds(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return DEFAULT_FADE_DURATION_SECONDS;
  }

  let nearest = FADE_DURATION_PRESETS[0].seconds;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const preset of FADE_DURATION_PRESETS) {
    const distance = Math.abs(preset.seconds - value);
    if (distance < nearestDistance) {
      nearest = preset.seconds;
      nearestDistance = distance;
    }
  }

  return nearest;
}
