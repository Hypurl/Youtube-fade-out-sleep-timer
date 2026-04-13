import {
  DEFAULT_FADE_CURVE_CONFIG,
  FADE_CURVE_PRESET_IDS,
  FADE_CURVE_PRESET_LABELS,
  resolveFadeCurvePoints,
  sanitizeFadeCurveConfig,
  sanitizeFadeCurvePoints,
} from "../shared/fade";
import type { FadeCurveConfig, FadeCurvePresetId } from "../shared/fade";

const checkbox = document.getElementById("showBanner") as HTMLInputElement;
const presetContainer = document.getElementById("curvePresets") as HTMLElement;
const slidersContainer = document.getElementById("curveSliders") as HTMLElement;

let curveConfig: FadeCurveConfig = { ...DEFAULT_FADE_CURVE_CONFIG };

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

chrome.storage.local.get(["showBanner", "fadeCurveConfig"], (data) => {
  checkbox.checked = data.showBanner !== false;
  curveConfig = sanitizeFadeCurveConfig(data.fadeCurveConfig);
  renderPresets();
  renderSliders();
});

checkbox.addEventListener("change", () => {
  chrome.storage.local.set({ showBanner: checkbox.checked });
});
