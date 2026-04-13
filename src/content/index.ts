import { getFadeCurvePreference, getFadeDurationPreference, getShowBannerPreference, getTimerPresetPreference, getTimerState, onStartFade, sendCancelTimer, sendSetTimer } from "./chrome";
import { BED_ICON } from "./constants";
import { DEFAULT_FADE_CURVE_CONFIG, evaluateFadeCurve, resolveFadeCurvePoints } from "../shared/fade";
import { DEFAULT_FADE_DURATION_SECONDS } from "../shared/fadeDuration";
import { DEFAULT_TIMER_PRESETS } from "../shared/timerPresets";
import {
  activePresetIndex,
  formatDuration,
  formatTime,
  getTimerPresets,
  secondsToSlider,
  setTimerPresets,
  sliderToSeconds,
  snapSeconds,
} from "./time";
import type { ContentTimerState, PersistedTimerState } from "../shared/types";

(function () {
  "use strict";

  if ((window as { __sleepFadeLoaded?: boolean }).__sleepFadeLoaded) return;
  (window as { __sleepFadeLoaded?: boolean }).__sleepFadeLoaded = true;

  const state: ContentTimerState = {
    panelOpen: false,
    timerActive: false,
    selectedSeconds: 30 * 60,
    timerPresets: DEFAULT_TIMER_PRESETS,
    fadeDuration: DEFAULT_FADE_DURATION_SECONDS,
    fadeCurveConfig: DEFAULT_FADE_CURVE_CONFIG,
    fadeCurvePoints: resolveFadeCurvePoints(DEFAULT_FADE_CURVE_CONFIG),
    endTime: null,
    fadeStartTime: null,
    originalVolume: 1,
    isFading: false,
  };

  let fadeInterval: ReturnType<typeof setInterval> | null = null;
  let tickInterval: ReturnType<typeof setInterval> | null = null;
  let trackedVideo: HTMLVideoElement | null = null;

  setTimerPresets(DEFAULT_TIMER_PRESETS);

  function refreshFadeCurvePreference(): void {
    getFadeCurvePreference((config) => {
      state.fadeCurveConfig = config;
      if (!state.timerActive) {
        state.fadeCurvePoints = resolveFadeCurvePoints(config);
      }
    });
  }

  function refreshFadeDurationPreference(): void {
    getFadeDurationPreference((seconds) => {
      if (!state.timerActive) {
        state.fadeDuration = seconds;
      }
    });
  }

  function refreshTimerPresetsPreference(): void {
    getTimerPresetPreference((presets) => {
      state.timerPresets = presets;
      setTimerPresets(presets);

      if (!state.timerActive) {
        state.selectedSeconds = snapSeconds(state.selectedSeconds);
      }
    });
  }

  function getVideo(): HTMLVideoElement | null {
    return document.querySelector<HTMLVideoElement>("video.html5-main-video")
      || document.querySelector<HTMLVideoElement>("video");
  }

  function injectButton(): void {
    if (document.querySelector(".sf-player-btn")) return;

    const controls = document.querySelector(".ytp-right-controls");
    if (!controls) return;

    const btn = document.createElement("button");
    btn.className = "sf-player-btn";
    btn.setAttribute("aria-label", "Sleep Fade Timer");
    btn.setAttribute("title", "");
    btn.innerHTML = BED_ICON;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePanel(btn);
    });

    controls.insertBefore(btn, controls.firstChild);
    checkTimerState(btn);
  }

  function togglePanel(btn: HTMLElement): void {
    const existing = document.querySelector(".sf-panel");
    if (existing) {
      existing.remove();
      state.panelOpen = false;
      return;
    }

    state.panelOpen = true;
    renderPanel(btn);
  }

  function renderPanel(btn: HTMLElement): void {
    document.querySelectorAll(".sf-panel").forEach((p) => p.remove());
    if (!state.panelOpen) return;

    const panel = document.createElement("div");
    panel.className = "sf-panel";

    const closeOnOutside = (e: Event) => {
      if (!panel.contains(e.target as Node) && !btn.contains(e.target as Node)) {
        panel.remove();
        state.panelOpen = false;
        document.removeEventListener("click", closeOnOutside, true);
      }
    };

    setTimeout(() => document.addEventListener("click", closeOnOutside, true), 10);
    panel.addEventListener("keydown", (e) => e.stopPropagation());
    panel.addEventListener("click", (e) => e.stopPropagation());

    if (state.timerActive) {
      renderActivePanel(panel);
    } else {
      renderSetupPanel(panel, btn);
    }

    btn.style.position = "relative";
    btn.appendChild(panel);
  }

  function renderSetupPanel(panel: HTMLElement, btn: HTMLElement): void {
    const presets = getTimerPresets();
    const sliderVal = secondsToSlider(state.selectedSeconds);
    const activeIdx = activePresetIndex(state.selectedSeconds);
    const sliderMin = Math.min(...presets.map((p) => p.position));
    const sliderMax = Math.max(...presets.map((p) => p.position));
    const sliderStep = Math.max(0.000001, (sliderMax - sliderMin) / 1000);

    panel.innerHTML = `
      <div class="sf-slider-panel">
        <div class="sf-slider-value">${formatDuration(state.selectedSeconds)}</div>
        <div class="sf-slider-track">
          <input type="range" class="sf-slider" min="${sliderMin}" max="${sliderMax}" step="${sliderStep}" value="${sliderVal}" />
        </div>
        <div class="sf-presets">
          <div class="sf-presets-label">Presets</div>
          <div class="sf-presets-grid">
            ${presets.map((p, i) =>
              `<button type="button" class="sf-tick${i === activeIdx ? " sf--active" : ""}" data-idx="${i}">${p.label}</button>`
            ).join("")}
          </div>
        </div>
        <button class="sf-start-btn">Start</button>
      </div>
    `;

    const slider = panel.querySelector<HTMLInputElement>(".sf-slider");
    const valueDisplay = panel.querySelector<HTMLElement>(".sf-slider-value");
    const ticks = panel.querySelectorAll<HTMLElement>(".sf-tick");
    const startBtn = panel.querySelector<HTMLElement>(".sf-start-btn");

    if (!slider || !valueDisplay || !startBtn) return;

    const syncUI = () => {
      valueDisplay.textContent = formatDuration(state.selectedSeconds);
      const idx = activePresetIndex(state.selectedSeconds);
      ticks.forEach((t, i) => t.classList.toggle("sf--active", i === idx));
    };

    slider.addEventListener("input", () => {
      const raw = sliderToSeconds(parseFloat(slider.value));
      state.selectedSeconds = snapSeconds(raw);
      slider.value = String(secondsToSlider(state.selectedSeconds));
      syncUI();
    });

    ticks.forEach((t) => {
      t.addEventListener("click", () => {
        const idx = Number.parseInt(t.dataset.idx ?? "0", 10);
        const nextPreset = presets[idx];
        if (!nextPreset) return;
        state.selectedSeconds = nextPreset.seconds;
        slider.value = String(nextPreset.position);
        syncUI();
      });
    });

    startBtn.addEventListener("click", () => startTimer(btn));
  }

  function renderActivePanel(panel: HTMLElement): void {
    if (state.endTime == null) return;
    const remaining = Math.max(0, (state.endTime - Date.now()) / 1000);

    panel.innerHTML = `
      <div class="sf-row">
        <div class="sf-countdown">
          <span class="sf-remaining">${formatTime(remaining)}</span>
          <span class="sf-countdown-label">${state.isFading ? "fading\u2026" : "remaining"}</span>
        </div>
        <button class="sf-start-btn sf--cancel">Cancel</button>
      </div>
    `;

    const display = panel.querySelector<HTMLElement>(".sf-remaining");
    const cancelBtn = panel.querySelector<HTMLElement>(".sf-start-btn");
    if (!display || !cancelBtn) return;

    const countdownTick = setInterval(() => {
      if (!document.contains(panel) || state.endTime == null) {
        clearInterval(countdownTick);
        return;
      }
      const r = Math.max(0, (state.endTime - Date.now()) / 1000);
      display.textContent = formatTime(r);
    }, 1000);

    cancelBtn.addEventListener("click", () => {
      cancelTimer();
      const btn = document.querySelector<HTMLElement>(".sf-player-btn");
      if (btn) renderSetupPanel(panel, btn);
    });
  }

  function startTimer(btn: HTMLElement): void {
    const video = getVideo();
    if (!video) return;

    state.originalVolume = video.volume;
    state.timerActive = true;
    state.endTime = Date.now() + state.selectedSeconds * 1000;
    state.fadeStartTime = state.endTime - state.fadeDuration * 1000;
    state.isFading = false;

    trackVideo(video);
    sendSetTimer({
      seconds: state.selectedSeconds,
      fadeDuration: state.fadeDuration,
      originalVolume: state.originalVolume,
      fadeCurvePoints: [...state.fadeCurvePoints],
    });

    btn.classList.add("sf--active");
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(() => tick(), 1000);

    state.panelOpen = false;
    document.querySelectorAll(".sf-panel").forEach((p) => p.remove());
  }

  function cancelTimer(): void {
    state.timerActive = false;
    state.isFading = false;
    state.endTime = null;
    state.fadeStartTime = null;

    if (fadeInterval) clearInterval(fadeInterval);
    if (tickInterval) clearInterval(tickInterval);
    fadeInterval = null;
    tickInterval = null;

    untrackVideo();

    const video = getVideo();
    if (video) video.volume = state.originalVolume;

    sendCancelTimer();

    const btn = document.querySelector(".sf-player-btn");
    if (btn) btn.classList.remove("sf--active");

    document.querySelectorAll(".sf-fading-banner").forEach((b) => b.remove());
  }

  function onVideoPlaying(): void {
    if (!state.timerActive) return;
    const video = getVideo();
    if (!video) return;
    if (state.fadeStartTime == null || state.endTime == null) return;

    if (state.isFading) {
      const now = Date.now();
      const elapsed = now - state.fadeStartTime;
      const total = state.endTime - state.fadeStartTime;
      const t = Math.min(1, elapsed / total);
      video.volume = Math.max(0, state.originalVolume * evaluateFadeCurve(t, state.fadeCurvePoints));
    }

    if (video !== trackedVideo) {
      trackVideo(video);
    }
  }

  function trackVideo(video: HTMLVideoElement): void {
    if (trackedVideo) {
      trackedVideo.removeEventListener("playing", onVideoPlaying);
    }
    trackedVideo = video;
    trackedVideo.addEventListener("playing", onVideoPlaying);
  }

  function untrackVideo(): void {
    if (!trackedVideo) return;
    trackedVideo.removeEventListener("playing", onVideoPlaying);
    trackedVideo = null;
  }

  function tick(): void {
    if (!state.timerActive || state.fadeStartTime == null || state.endTime == null) return;

    const video = getVideo();
    if (video && video !== trackedVideo) {
      trackVideo(video);
      if (state.isFading) onVideoPlaying();
    }

    const now = Date.now();
    if (now >= state.fadeStartTime && !state.isFading) {
      beginFade();
    }
    if (now >= state.endTime) {
      finishTimer();
    }
  }

  function beginFade(): void {
    if (state.fadeStartTime == null || state.endTime == null) return;
    state.isFading = true;

    showFadeBanner();

    if (fadeInterval) clearInterval(fadeInterval);
    fadeInterval = setInterval(() => {
      const video = getVideo();
      if (!video || state.fadeStartTime == null || state.endTime == null) return;

      const now = Date.now();
      const elapsed = now - state.fadeStartTime;
      const total = state.endTime - state.fadeStartTime;
      const t = Math.min(1, elapsed / total);

      video.volume = Math.max(0, state.originalVolume * evaluateFadeCurve(t, state.fadeCurvePoints));

      const banner = document.querySelector<HTMLElement>(".sf-fading-banner");
      const timeLabel = banner?.querySelector<HTMLElement>(".sf-banner-time");
      if (banner && timeLabel) {
        const remaining = Math.max(0, (state.endTime - now) / 1000);
        timeLabel.textContent = formatTime(remaining);
        banner.style.setProperty("--progress", String(Math.max(0, 1 - t)));
      }
    }, 500);
  }

  function finishTimer(): void {
    const video = getVideo();
    if (video) {
      video.volume = 0;
      video.pause();
    }

    state.timerActive = false;
    state.isFading = false;

    if (fadeInterval) clearInterval(fadeInterval);
    if (tickInterval) clearInterval(tickInterval);
    fadeInterval = null;
    tickInterval = null;

    untrackVideo();

    setTimeout(() => {
      if (video) video.volume = state.originalVolume;
    }, 1000);

    sendCancelTimer();

    const btn = document.querySelector(".sf-player-btn");
    if (btn) btn.classList.remove("sf--active");

    document.querySelectorAll(".sf-fading-banner").forEach((b) => b.remove());
  }

  function showFadeBanner(): void {
    document.querySelectorAll(".sf-fading-banner").forEach((b) => b.remove());
    getShowBannerPreference((show) => {
      if (!show) return;
      renderFadeBanner();
    });
  }

  function renderFadeBanner(): void {
    if (state.endTime == null) return;
    const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
    if (!player) return;

    const banner = document.createElement("div");
    banner.className = "sf-fading-banner";

    const remaining = Math.max(0, (state.endTime - Date.now()) / 1000);
    banner.innerHTML = `
      <span>Fading out in <strong class="sf-banner-time">${formatTime(remaining)}</strong></span>
      <button class="sf-banner-cancel">Cancel</button>
    `;

    banner.querySelector(".sf-banner-cancel")?.addEventListener("click", (e) => {
      e.stopPropagation();
      cancelTimer();
    });

    (player as HTMLElement).style.position = "relative";
    player.appendChild(banner);
  }

  onStartFade(() => {
    if (state.timerActive && !state.isFading) {
      beginFade();
    }
  });

  function applyStoredTimer(resp: PersistedTimerState): void {
    const now = Date.now();
    if (now >= resp.endTime) return;

    state.timerActive = true;
    state.endTime = resp.endTime;
    state.fadeStartTime = resp.fadeStartTime;
    state.fadeDuration = resp.fadeDuration;
    state.originalVolume = resp.originalVolume;
    state.fadeCurvePoints = Array.isArray(resp.fadeCurvePoints) && resp.fadeCurvePoints.length === 5
      ? resp.fadeCurvePoints
      : resolveFadeCurvePoints(state.fadeCurveConfig);

    const btn = document.querySelector<HTMLElement>(".sf-player-btn");
    if (btn) btn.classList.add("sf--active");

    if (now >= resp.fadeStartTime) {
      state.isFading = false;
      beginFade();
    }

    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(() => tick(), 1000);
  }

  function checkTimerState(btn: HTMLElement): void {
    getTimerState((resp) => {
      if (!resp || !resp.active) return;
      btn.classList.add("sf--active");
      applyStoredTimer(resp);
    });
  }

  function waitForPlayer(): void {
    const check = () => {
      if (document.querySelector(".ytp-right-controls")) {
        injectButton();
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  }

  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(waitForPlayer, 300);
  });

  const observer = new MutationObserver(() => {
    if (document.querySelector(".ytp-right-controls") && !document.querySelector(".sf-player-btn")) {
      injectButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  refreshTimerPresetsPreference();
  refreshFadeCurvePreference();
  refreshFadeDurationPreference();
  chrome.storage?.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.timerPresetMinutes) {
      refreshTimerPresetsPreference();
    }
    if (areaName === "local" && changes.fadeCurveConfig) {
      refreshFadeCurvePreference();
    }
    if (areaName === "local" && changes.fadeDurationSeconds) {
      refreshFadeDurationPreference();
    }
  });
  waitForPlayer();
})();
