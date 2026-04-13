import { ALARM_SLEEP_FADE_START, MESSAGE_TYPES } from "../shared/constants";
import type { PersistedTimerState, RuntimeMessage } from "../shared/types";

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_SLEEP_FADE_START) return;

  const tabs = await chrome.tabs.query({ url: "*://www.youtube.com/*" });
  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      const startFade: RuntimeMessage = { type: MESSAGE_TYPES.START_FADE };
      await chrome.tabs.sendMessage(tab.id, startFade);
    } catch {
      // Tab might have been closed, ignore
    }
  }
});

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type === MESSAGE_TYPES.SET_TIMER) {
    const delaySeconds = Math.max(0, msg.seconds - msg.fadeDuration);
    const delayMinutes = delaySeconds / 60;

    chrome.alarms.clear(ALARM_SLEEP_FADE_START);
    chrome.alarms.create(ALARM_SLEEP_FADE_START, {
      delayInMinutes: Math.max(0.08, delayMinutes),
    });

    const timerState: PersistedTimerState = {
      endTime: Date.now() + msg.seconds * 1000,
      fadeStartTime: Date.now() + delaySeconds * 1000,
      fadeDuration: msg.fadeDuration,
      originalVolume: msg.originalVolume,
      active: true,
    };

    chrome.storage.local.set({
      timerState,
    });

    sendResponse({ ok: true });
  }

  if (msg.type === MESSAGE_TYPES.CANCEL_TIMER) {
    chrome.alarms.clear(ALARM_SLEEP_FADE_START);
    chrome.storage.local.set({ timerState: { active: false } });
    sendResponse({ ok: true });
  }

  if (msg.type === MESSAGE_TYPES.GET_TIMER) {
    chrome.storage.local.get("timerState", (data) => {
      sendResponse(data.timerState || { active: false });
    });
    return true;
  }
});
