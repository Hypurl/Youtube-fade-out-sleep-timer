export const FADE_CURVE_PRESET_IDS = ["linear", "gentle", "abrupt", "early", "custom", "custom2"] as const;

export type FadeCurvePresetId = (typeof FADE_CURVE_PRESET_IDS)[number];

export interface FadeCurveConfig {
  preset: FadeCurvePresetId;
  customPoints: number[];
  custom2Points: number[];
}

export const FADE_CURVE_PRESETS: Record<Exclude<FadeCurvePresetId, "custom" | "custom2">, { label: string; points: number[] }> = {
  linear: { label: "Linear", points: [1, 0.75, 0.5, 0.25, 0] },
  gentle: { label: "Gentle", points: [1, 0.9, 0.72, 0.42, 0] },
  abrupt: { label: "Abrupt", points: [1, 1, 1, 0.9, 0] },
  early: { label: "Early", points: [1, 0.58, 0.3, 0.14, 0] },
};

export const FADE_CURVE_PRESET_LABELS: Record<FadeCurvePresetId, string> = {
  linear: "Linear",
  gentle: "Gentle",
  abrupt: "Abrupt",
  early: "Early",
  custom: "Custom",
  custom2: "Custom 2",
};

export const DEFAULT_FADE_CURVE_CONFIG: FadeCurveConfig = {
  preset: "linear",
  customPoints: [...FADE_CURVE_PRESETS.linear.points],
  custom2Points: [...FADE_CURVE_PRESETS.gentle.points],
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function sanitizeFadeCurvePoints(points: number[] | undefined): number[] {
  const fallback = [...FADE_CURVE_PRESETS.linear.points];
  if (!Array.isArray(points) || points.length !== 5) return fallback;
  return points.map((point) => {
    if (typeof point !== "number" || Number.isNaN(point)) return 0;
    return clamp01(point);
  });
}

export function sanitizeFadeCurveConfig(config: unknown): FadeCurveConfig {
  if (!config || typeof config !== "object") return { ...DEFAULT_FADE_CURVE_CONFIG };
  const candidate = config as Partial<FadeCurveConfig>;
  const preset = FADE_CURVE_PRESET_IDS.includes(candidate.preset as FadeCurvePresetId)
    ? (candidate.preset as FadeCurvePresetId)
    : DEFAULT_FADE_CURVE_CONFIG.preset;

  return {
    preset,
    customPoints: sanitizeFadeCurvePoints(candidate.customPoints),
    custom2Points: sanitizeFadeCurvePoints(candidate.custom2Points),
  };
}

export function resolveFadeCurvePoints(config: FadeCurveConfig): number[] {
  if (config.preset === "custom") return sanitizeFadeCurvePoints(config.customPoints);
  if (config.preset === "custom2") return sanitizeFadeCurvePoints(config.custom2Points);
  return [...FADE_CURVE_PRESETS[config.preset].points];
}

export function evaluateFadeCurve(t: number, points: number[]): number {
  const p = sanitizeFadeCurvePoints(points);
  const clampedT = clamp01(t);
  const scaled = clampedT * (p.length - 1);
  const idx = Math.floor(scaled);
  const nextIdx = Math.min(p.length - 1, idx + 1);
  const localT = scaled - idx;
  return p[idx] + (p[nextIdx] - p[idx]) * localT;
}
