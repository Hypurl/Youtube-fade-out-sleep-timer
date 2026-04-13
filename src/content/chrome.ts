import { MESSAGE_TYPES } from "../shared/constants";
import { DEFAULT_FADE_CURVE_CONFIG, sanitizeFadeCurveConfig } from "../shared/fade";
import { DEFAULT_FADE_DURATION_SECONDS, sanitizeFadeDurationSeconds } from "../shared/fadeDuration";
import { DEFAULT_TIMER_PRESETS, createTimerPresetsFromMinutes } from "../shared/timerPresets";
import type { FadeCurveConfig } from "../shared/fade";
import type { TimerPresetPoint } from "../shared/timerPresets";
import type {
  FinishTimerMessage,
  PersistedTimerState,
  RuntimeMessage,
  SetTimerMessage,
  StartFadeMessage,
  TimerStateChangedMessage,
} from "../shared/types";

export function chromeOk(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export function sendSetTimer(payload: Omit<SetTimerMessage, "type">): void {
  if (!chromeOk()) return;
  const msg: RuntimeMessage = { type: MESSAGE_TYPES.SET_TIMER, ...payload };
  chrome.runtime.sendMessage(msg);
}

export function sendCancelTimer(): void {
  if (!chromeOk()) return;
  const msg: RuntimeMessage = { type: MESSAGE_TYPES.CANCEL_TIMER };
  chrome.runtime.sendMessage(msg);
}

export function getTimerState(
  callback: (state: PersistedTimerState | { active: false } | undefined) => void,
): void {
  if (!chromeOk()) {
    callback(undefined);
    return;
  }

  const msg: RuntimeMessage = { type: MESSAGE_TYPES.GET_TIMER };
  chrome.runtime.sendMessage(msg, (response) => {
    callback(response);
  });
}

export function onStartFade(handler: () => void): void {
  if (!chromeOk()) return;

  chrome.runtime.onMessage.addListener((msg: StartFadeMessage) => {
    if (msg.type === MESSAGE_TYPES.START_FADE) {
      handler();
    }
  });
}

export function onTimerStateChanged(
  handler: (state: PersistedTimerState | { active: false }) => void,
): void {
  if (!chromeOk()) return;

  chrome.runtime.onMessage.addListener((msg: TimerStateChangedMessage) => {
    if (msg.type === MESSAGE_TYPES.TIMER_STATE_CHANGED) {
      handler(msg.timerState);
    }
  });
}

export function onFinishTimer(handler: () => void): void {
  if (!chromeOk()) return;

  chrome.runtime.onMessage.addListener((msg: FinishTimerMessage) => {
    if (msg.type === MESSAGE_TYPES.FINISH_TIMER) {
      handler();
    }
  });
}

export function getShowBannerPreference(callback: (show: boolean) => void): void {
  if (!chromeOk()) {
    callback(true);
    return;
  }

  chrome.storage.local.get("showBanner", (data) => {
    callback(data.showBanner !== false);
  });
}

export function getShowBannerTimeLeftPreference(callback: (show: boolean) => void): void {
  if (!chromeOk()) {
    callback(true);
    return;
  }

  chrome.storage.local.get("showBannerTimeLeft", (data) => {
    callback(data.showBannerTimeLeft !== false);
  });
}

export function getShowBannerVolumePercentagePreference(callback: (show: boolean) => void): void {
  if (!chromeOk()) {
    callback(true);
    return;
  }

  chrome.storage.local.get("showBannerVolumePercentage", (data) => {
    callback(data.showBannerVolumePercentage !== false);
  });
}

export function getFadeCurvePreference(callback: (config: FadeCurveConfig) => void): void {
  if (!chromeOk()) {
    callback(DEFAULT_FADE_CURVE_CONFIG);
    return;
  }

  chrome.storage.local.get("fadeCurveConfig", (data) => {
    callback(sanitizeFadeCurveConfig(data.fadeCurveConfig));
  });
}

export function getFadeDurationPreference(callback: (seconds: number) => void): void {
  if (!chromeOk()) {
    callback(DEFAULT_FADE_DURATION_SECONDS);
    return;
  }

  chrome.storage.local.get("fadeDurationSeconds", (data) => {
    callback(sanitizeFadeDurationSeconds(data.fadeDurationSeconds));
  });
}

export function getTimerPresetPreference(callback: (presets: TimerPresetPoint[]) => void): void {
  if (!chromeOk()) {
    callback(DEFAULT_TIMER_PRESETS);
    return;
  }

  chrome.storage.local.get("timerPresetMinutes", (data) => {
    callback(createTimerPresetsFromMinutes(data.timerPresetMinutes));
  });
}
