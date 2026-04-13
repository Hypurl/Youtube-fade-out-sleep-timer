(function () {
  "use strict";

  if ((window as any).__sleepFadeLoaded) return;
  (window as any).__sleepFadeLoaded = true;

  interface TimerState {
    panelOpen: boolean;
    timerActive: boolean;
    selectedSeconds: number;
    fadeDuration: number;
    endTime: number | null;
    fadeStartTime: number | null;
    originalVolume: number;
    isFading: boolean;
  }

  const state: TimerState = {
    panelOpen: false,
    timerActive: false,
    selectedSeconds: 30 * 60,
    fadeDuration: 300,
    endTime: null,
    fadeStartTime: null,
    originalVolume: 1,
    isFading: false,
  };

  function chromeOk(): boolean {
    try { return !!chrome.runtime?.id; } catch { return false; }
  }

  let fadeInterval: ReturnType<typeof setInterval> | null = null;
  let tickInterval: ReturnType<typeof setInterval> | null = null;
  let trackedVideo: HTMLVideoElement | null = null;

  const BED_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>
  </svg>`;

  function getVideo(): HTMLVideoElement | null {
    return document.querySelector<HTMLVideoElement>("video.html5-main-video") || document.querySelector<HTMLVideoElement>("video");
  }

  function formatTime(seconds: number): string {
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

  function fadeCurve(t: number): number {
    return Math.cos(t * Math.PI * 0.5);
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
    const presets = [
      { label: "5s", seconds: 5 },
      { label: "1", seconds: 60 },
      { label: "5", seconds: 300 },
      { label: "10", seconds: 600 },
      { label: "15", seconds: 900 },
      { label: "30", seconds: 1800 },
    ];

    panel.innerHTML = `
      <div class="sf-row">
        ${presets
          .map(
            (p) =>
              `<button class="sf-preset-btn ${state.selectedSeconds === p.seconds ? "sf--selected" : ""}" data-sec="${p.seconds}">${p.label}</button>`
          )
          .join("")}
        <button class="sf-start-btn">Start</button>
      </div>
    `;

    panel.querySelectorAll<HTMLButtonElement>(".sf-preset-btn").forEach((b) => {
      b.addEventListener("click", () => {
        state.selectedSeconds = parseInt(b.dataset.sec!);
        panel.querySelectorAll(".sf-preset-btn").forEach((x) => x.classList.remove("sf--selected"));
        b.classList.add("sf--selected");
      });
    });

    panel.querySelector(".sf-start-btn")!.addEventListener("click", () => {
      startTimer(btn);
    });
  }

  function renderActivePanel(panel: HTMLElement): void {
    const remaining = Math.max(0, (state.endTime! - Date.now()) / 1000);

    panel.innerHTML = `
      <div class="sf-row">
        <div class="sf-countdown">
          <span class="sf-remaining">${formatTime(remaining)}</span>
          <span class="sf-countdown-label">${state.isFading ? "fading\u2026" : "remaining"}</span>
        </div>
        <button class="sf-start-btn sf--cancel">Cancel</button>
      </div>
    `;

    const display = panel.querySelector(".sf-remaining")!;
    const countdownTick = setInterval(() => {
      if (!document.contains(panel)) {
        clearInterval(countdownTick);
        return;
      }
      const r = Math.max(0, (state.endTime! - Date.now()) / 1000);
      display.textContent = formatTime(r);
    }, 1000);

    panel.querySelector(".sf-start-btn")!.addEventListener("click", () => {
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

    if (chromeOk()) chrome.runtime.sendMessage({
      type: "SET_TIMER",
      seconds: state.selectedSeconds,
      fadeDuration: state.fadeDuration,
      originalVolume: state.originalVolume,
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

    if (chromeOk()) chrome.runtime.sendMessage({ type: "CANCEL_TIMER" });

    const btn = document.querySelector(".sf-player-btn");
    if (btn) btn.classList.remove("sf--active");

    document.querySelectorAll(".sf-fading-banner").forEach((b) => b.remove());
  }

  function onVideoPlaying(): void {
    if (!state.timerActive) return;
    const video = getVideo();
    if (!video) return;

    if (state.isFading) {
      const now = Date.now();
      const elapsed = now - state.fadeStartTime!;
      const total = state.endTime! - state.fadeStartTime!;
      const t = Math.min(1, elapsed / total);
      video.volume = Math.max(0, state.originalVolume * fadeCurve(t));
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
    video.addEventListener("playing", onVideoPlaying);
  }

  function untrackVideo(): void {
    if (trackedVideo) {
      trackedVideo.removeEventListener("playing", onVideoPlaying);
      trackedVideo = null;
    }
  }

  function tick(): void {
    if (!state.timerActive) return;

    const video = getVideo();
    if (video && video !== trackedVideo) {
      trackVideo(video);
      if (state.isFading) {
        onVideoPlaying();
      }
    }

    const now = Date.now();

    if (now >= state.fadeStartTime! && !state.isFading) {
      beginFade();
    }

    if (now >= state.endTime!) {
      finishTimer();
    }
  }

  function beginFade(): void {
    state.isFading = true;

    showFadeBanner();

    if (fadeInterval) clearInterval(fadeInterval);
    fadeInterval = setInterval(() => {
      const video = getVideo();
      if (!video) return;

      const now = Date.now();
      const elapsed = now - state.fadeStartTime!;
      const total = state.endTime! - state.fadeStartTime!;
      const t = Math.min(1, elapsed / total);

      const volumeMultiplier = fadeCurve(t);
      video.volume = Math.max(0, state.originalVolume * volumeMultiplier);

      const banner = document.querySelector<HTMLElement>(".sf-fading-banner");
      if (banner) {
        const remaining = Math.max(0, (state.endTime! - now) / 1000);
        banner.querySelector(".sf-banner-time")!.textContent = formatTime(remaining);
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

    untrackVideo();

    setTimeout(() => {
      if (video) video.volume = state.originalVolume;
    }, 1000);

    if (chromeOk()) chrome.runtime.sendMessage({ type: "CANCEL_TIMER" });

    const btn = document.querySelector(".sf-player-btn");
    if (btn) btn.classList.remove("sf--active");

    document.querySelectorAll(".sf-fading-banner").forEach((b) => b.remove());
  }

  function showFadeBanner(): void {
    document.querySelectorAll(".sf-fading-banner").forEach((b) => b.remove());

    if (!chromeOk()) { _renderFadeBanner(); return; }
    chrome.storage.local.get("showBanner", (data) => {
      if (data.showBanner === false) return;
      _renderFadeBanner();
    });
  }

  function _renderFadeBanner(): void {
    const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
    if (!player) return;

    const banner = document.createElement("div");
    banner.className = "sf-fading-banner";

    const remaining = Math.max(0, (state.endTime! - Date.now()) / 1000);
    banner.innerHTML = `
      <span>Fading out in <strong class="sf-banner-time">${formatTime(remaining)}</strong></span>
      <button class="sf-banner-cancel">Cancel</button>
    `;

    banner.querySelector(".sf-banner-cancel")!.addEventListener("click", (e) => {
      e.stopPropagation();
      cancelTimer();
    });

    (player as HTMLElement).style.position = "relative";
    player.appendChild(banner);
  }

  if (chromeOk()) chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_FADE" && state.timerActive && !state.isFading) {
      beginFade();
    }
  });

  function checkTimerState(btn: HTMLElement): void {
    if (!chromeOk()) return;
    chrome.runtime.sendMessage({ type: "GET_TIMER" }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.active) return;

      const now = Date.now();
      if (now >= resp.endTime) return;

      state.timerActive = true;
      state.endTime = resp.endTime;
      state.fadeStartTime = resp.fadeStartTime;
      state.fadeDuration = resp.fadeDuration;
      state.originalVolume = resp.originalVolume;

      btn.classList.add("sf--active");

      if (now >= resp.fadeStartTime) {
        state.isFading = false;
        beginFade();
      }

      if (tickInterval) clearInterval(tickInterval);
      tickInterval = setInterval(() => tick(), 1000);
    });
  }

  function waitForPlayer(): void {
    const check = () => {
      const controls = document.querySelector(".ytp-right-controls");
      if (controls) {
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

  waitForPlayer();
})();
