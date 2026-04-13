export interface TimerPresetPoint {
  label: string;
  seconds: number;
  position: number;
}

export const TIMER_PRESET_COUNT = 6;

export const DEFAULT_TIMER_PRESET_MINUTES = [5, 10, 15, 30, 45, 60] as const;

function formatMinutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function sanitizeTimerPresetMinutes(input: unknown): number[] {
  const fallback = [...DEFAULT_TIMER_PRESET_MINUTES];
  if (!Array.isArray(input)) return fallback;

  const cleaned = input
    .map((value) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null))
    .filter((value): value is number => value != null)
    .map((value) => Math.max(1, Math.min(720, value)))
    .slice(0, TIMER_PRESET_COUNT);

  while (cleaned.length < TIMER_PRESET_COUNT) {
    cleaned.push(fallback[cleaned.length]);
  }

  cleaned.sort((a, b) => a - b);
  return cleaned;
}

export function createTimerPresetsFromMinutes(minutesInput: unknown): TimerPresetPoint[] {
  const minutes = sanitizeTimerPresetMinutes(minutesInput);
  const seconds = minutes.map((m) => m * 60);
  const min = seconds[0];
  const max = seconds[seconds.length - 1];
  const span = Math.max(1, max - min);

  return seconds.map((value, index) => ({
    label: formatMinutesLabel(minutes[index]),
    seconds: value,
    position: (value - min) / span,
  }));
}

export const DEFAULT_TIMER_PRESETS = createTimerPresetsFromMinutes(DEFAULT_TIMER_PRESET_MINUTES);
