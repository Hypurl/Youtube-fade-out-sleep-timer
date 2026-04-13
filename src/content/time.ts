import { SNAP_POINTS } from "./constants";

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}:${String(rm).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(seconds / 60)}m`;
}

export function fadeCurve(t: number): number {
  return Math.cos(t * Math.PI * 0.5);
}

export function secondsToSlider(seconds: number): number {
  for (let i = 0; i < SNAP_POINTS.length - 1; i++) {
    const a = SNAP_POINTS[i], b = SNAP_POINTS[i + 1];
    if (seconds <= a.seconds) return a.position;
    if (seconds <= b.seconds) {
      const t = (seconds - a.seconds) / (b.seconds - a.seconds);
      return a.position + t * (b.position - a.position);
    }
  }
  return SNAP_POINTS[SNAP_POINTS.length - 1].position;
}

export function sliderToSeconds(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  for (let i = 0; i < SNAP_POINTS.length - 1; i++) {
    const a = SNAP_POINTS[i], b = SNAP_POINTS[i + 1];
    if (v <= a.position) return a.seconds;
    if (v <= b.position) {
      const t = (v - a.position) / (b.position - a.position);
      return Math.round(a.seconds + t * (b.seconds - a.seconds));
    }
  }
  return SNAP_POINTS[SNAP_POINTS.length - 1].seconds;
}

export function nearestPresetIndexFromSlider(sliderVal: number): number {
  let nearestIdx = 0;
  let nearestDist = Number.POSITIVE_INFINITY;

  SNAP_POINTS.forEach((p, i) => {
    const d = Math.abs(sliderVal - p.position);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  });

  return nearestIdx;
}

export function snapSeconds(seconds: number): number {
  const SNAP_RADIUS = 0.045;
  const HARD_LOCK_RADIUS = 0.02;
  const MAX_PULL = 0.9;

  const sliderVal = secondsToSlider(seconds);
  const nearest = nearestPresetIndexFromSlider(sliderVal);

  const distance = Math.abs(sliderVal - SNAP_POINTS[nearest].position);
  const target = SNAP_POINTS[nearest].seconds;

  if (distance <= HARD_LOCK_RADIUS) return target;
  if (distance >= SNAP_RADIUS) return seconds;

  const influence = Math.pow(1 - distance / SNAP_RADIUS, 2) * MAX_PULL;
  return Math.round(seconds + (target - seconds) * influence);
}

export function activePresetIndex(seconds: number): number {
  const ACTIVE_RADIUS = 0.012;
  const sliderVal = secondsToSlider(seconds);
  const nearest = nearestPresetIndexFromSlider(sliderVal);
  return Math.abs(sliderVal - SNAP_POINTS[nearest].position) <= ACTIVE_RADIUS ? nearest : -1;
}
