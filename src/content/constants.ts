export const BED_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>
</svg>`;

export const SNAP_POINTS = [
  { label: "5m", seconds: 300, position: 0.0 },
  { label: "10m", seconds: 600, position: 0.14 },
  { label: "15m", seconds: 900, position: 0.28 },
  { label: "30m", seconds: 1800, position: 0.5 },
  { label: "45m", seconds: 2700, position: 0.75 },
  { label: "1h", seconds: 3600, position: 1.0 },
] as const;
