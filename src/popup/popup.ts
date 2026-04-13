import {
  DEFAULT_FADE_CURVE_CONFIG,
  FADE_CURVE_PRESET_IDS,
  FADE_CURVE_PRESET_LABELS,
  resolveFadeCurvePoints,
  sanitizeFadeCurveConfig,
  sanitizeFadeCurvePoints,
} from "../shared/fade";
import {
  DEFAULT_FADE_DURATION_SECONDS,
  FADE_DURATION_PRESETS,
  sanitizeFadeDurationSeconds,
} from "../shared/fadeDuration";
import {
  DEFAULT_TIMER_PRESET_MINUTES,
  TIMER_PRESET_COUNT,
  sanitizeTimerPresetMinutes,
} from "../shared/timerPresets";
import type { FadeCurveConfig, FadeCurvePresetId } from "../shared/fade";

const checkbox = document.getElementById("showBanner") as HTMLInputElement;
const durationPresetContainer = document.getElementById("fadeDurationPresets") as HTMLElement;
const presetContainer = document.getElementById("curvePresets") as HTMLElement;
const slidersContainer = document.getElementById("curveSliders") as HTMLElement;
const timerPresetEditor = document.getElementById("timerPresetEditor") as HTMLElement;
const fullResetBtn = document.getElementById("fullResetBtn") as HTMLButtonElement;

let curveConfig: FadeCurveConfig = { ...DEFAULT_FADE_CURVE_CONFIG };
let fadeDurationSeconds = DEFAULT_FADE_DURATION_SECONDS;
let timerPresetMinutes: number[] = [...DEFAULT_TIMER_PRESET_MINUTES];

function saveTimerPresets(): void {
  chrome.storage.local.set({ timerPresetMinutes: [...timerPresetMinutes] });
}

function renderTimerPresetEditor(): void {
  timerPresetEditor.innerHTML = timerPresetMinutes
    .map((minutes, idx) => {
      return `
        <div class="timer-preset-item">
          <label for="timerPreset${idx}">Preset ${idx + 1}</label>
          <input id="timerPreset${idx}" type="number" min="1" max="720" step="1" value="${minutes}" data-idx="${idx}" />
        </div>
      `;
    })
    .join("");

  timerPresetEditor.querySelectorAll<HTMLInputElement>("input[data-idx]").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = Number.parseInt(input.dataset.idx ?? "0", 10);
      const parsed = Number.parseInt(input.value, 10);
      const next = [...timerPresetMinutes];
      next[idx] = Number.isNaN(parsed) ? timerPresetMinutes[idx] : parsed;
      timerPresetMinutes = sanitizeTimerPresetMinutes(next);
      renderTimerPresetEditor();
      saveTimerPresets();
    });
  });
}

function applyStateToUI(): void {
  renderTimerPresetEditor();
  renderFadeDurationPresets();
  renderPresets();
  renderSliders();
}

function saveFadeDuration(): void {
  chrome.storage.local.set({ fadeDurationSeconds });
}

function renderFadeDurationPresets(): void {
  durationPresetContainer.innerHTML = FADE_DURATION_PRESETS
    .map((preset) => {
      const active = fadeDurationSeconds === preset.seconds ? " active" : "";
      return `<button type="button" class="curve-preset-btn${active}" data-seconds="${preset.seconds}">${preset.label}</button>`;
    })
    .join("");

  durationPresetContainer.querySelectorAll<HTMLButtonElement>(".curve-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const seconds = Number.parseInt(btn.dataset.seconds ?? "0", 10);
      if (!seconds) return;
      fadeDurationSeconds = sanitizeFadeDurationSeconds(seconds);
      renderFadeDurationPresets();
      saveFadeDuration();
    });
  });
}

function saveCurveConfig(): void {
  chrome.storage.local.set({
    fadeCurveConfig: {
      preset: curveConfig.preset,
      customPoints: [...curveConfig.customPoints],
      custom2Points: [...curveConfig.custom2Points],
    },
  });
}

function renderPresets(): void {
  presetContainer.innerHTML = FADE_CURVE_PRESET_IDS
    .map((preset) => {
      const active = curveConfig.preset === preset ? " active" : "";
      return `<button type="button" class="curve-preset-btn${active}" data-preset="${preset}">${FADE_CURVE_PRESET_LABELS[preset]}</button>`;
    })
    .join("");

  presetContainer.querySelectorAll<HTMLButtonElement>(".curve-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset as FadeCurvePresetId;
      if (!preset) return;
      curveConfig = {
        ...curveConfig,
        preset,
      };
      renderPresets();
      renderSliders();
      saveCurveConfig();
    });
  });
}

function renderSliders(): void {
  const editable = curveConfig.preset === "custom" || curveConfig.preset === "custom2";
  const points = resolveFadeCurvePoints(curveConfig);

  slidersContainer.innerHTML = points
    .map((point, idx) => {
      const percent = Math.round(point * 100);
      return `
        <div class="eq-col">
          <input
            class="eq-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value="${percent}"
            data-idx="${idx}"
            ${editable ? "" : "disabled"}
          />
          <div class="eq-value">${percent}%</div>
        </div>
      `;
    })
    .join("");

  slidersContainer.querySelectorAll<HTMLInputElement>(".eq-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const idx = Number.parseInt(slider.dataset.idx ?? "0", 10);
      const nextValue = Number.parseInt(slider.value, 10) / 100;

      if (curveConfig.preset === "custom2") {
        const nextPoints = [...curveConfig.custom2Points];
        nextPoints[idx] = nextValue;
        curveConfig = {
          ...curveConfig,
          preset: "custom2",
          custom2Points: sanitizeFadeCurvePoints(nextPoints),
        };
      } else {
        const nextPoints = [...curveConfig.customPoints];
        nextPoints[idx] = nextValue;
        curveConfig = {
          ...curveConfig,
          preset: "custom",
          customPoints: sanitizeFadeCurvePoints(nextPoints),
        };
      }

      const valueEl = slider.parentElement?.querySelector<HTMLElement>(".eq-value");
      if (valueEl) {
        valueEl.textContent = `${Math.round(resolveFadeCurvePoints(curveConfig)[idx] * 100)}%`;
      }

      saveCurveConfig();
    });
  });
}

chrome.storage.local.get(["showBanner", "fadeCurveConfig", "fadeDurationSeconds", "timerPresetMinutes"], (data) => {
  checkbox.checked = data.showBanner !== false;
  curveConfig = sanitizeFadeCurveConfig(data.fadeCurveConfig);
  fadeDurationSeconds = sanitizeFadeDurationSeconds(data.fadeDurationSeconds);
  timerPresetMinutes = sanitizeTimerPresetMinutes(data.timerPresetMinutes).slice(0, TIMER_PRESET_COUNT);
  applyStateToUI();
});

checkbox.addEventListener("change", () => {
  chrome.storage.local.set({ showBanner: checkbox.checked });
});

fullResetBtn.addEventListener("click", () => {
  const confirmed = window.confirm("Reset all BetterSleepTimer settings to defaults?");
  if (!confirmed) return;

  checkbox.checked = true;
  curveConfig = {
    preset: DEFAULT_FADE_CURVE_CONFIG.preset,
    customPoints: [...DEFAULT_FADE_CURVE_CONFIG.customPoints],
    custom2Points: [...DEFAULT_FADE_CURVE_CONFIG.custom2Points],
  };
  fadeDurationSeconds = DEFAULT_FADE_DURATION_SECONDS;
  timerPresetMinutes = [...DEFAULT_TIMER_PRESET_MINUTES];

  chrome.storage.local.set({
    showBanner: true,
    fadeCurveConfig: {
      preset: curveConfig.preset,
      customPoints: [...curveConfig.customPoints],
      custom2Points: [...curveConfig.custom2Points],
    },
    fadeDurationSeconds,
    timerPresetMinutes: [...timerPresetMinutes],
  });

  applyStateToUI();
});
