import { ALARM_BETTER_SLEEP_TIMER_END, ALARM_BETTER_SLEEP_TIMER_FADE_START, MESSAGE_TYPES } from "../shared/constants";
import type { PersistedTimerState, RuntimeMessage } from "../shared/types";

async function broadcastToYouTubeTabs(message: RuntimeMessage): Promise<void> {
  const tabs = await chrome.tabs.query({ url: "*://www.youtube.com/*" });
  await Promise.all(
    tabs
      .filter((tab) => tab.id != null)
      .map(async (tab) => {
        try {
          await chrome.tabs.sendMessage(tab.id as number, message);
        } catch {
          // Tab might not have content script available, ignore
        }
      }),
  );
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_BETTER_SLEEP_TIMER_FADE_START) {
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
    return;
  }

  if (alarm.name !== ALARM_BETTER_SLEEP_TIMER_END) return;

  const timerState = { active: false } as const;
  chrome.storage.local.set({ timerState }, () => {
    void (async () => {
      const finish: RuntimeMessage = { type: MESSAGE_TYPES.FINISH_TIMER };
      const changed: RuntimeMessage = { type: MESSAGE_TYPES.TIMER_STATE_CHANGED, timerState };
      await broadcastToYouTubeTabs(finish);
      await broadcastToYouTubeTabs(changed);
    })();
  });
});

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type === MESSAGE_TYPES.SET_TIMER) {
    const delaySeconds = Math.max(0, msg.seconds - msg.fadeDuration);
    const delayMinutes = delaySeconds / 60;

    chrome.alarms.clear(ALARM_BETTER_SLEEP_TIMER_FADE_START);
    chrome.alarms.clear(ALARM_BETTER_SLEEP_TIMER_END);
    chrome.alarms.create(ALARM_BETTER_SLEEP_TIMER_FADE_START, {
      delayInMinutes: Math.max(0.08, delayMinutes),
    });
    chrome.alarms.create(ALARM_BETTER_SLEEP_TIMER_END, {
      when: Date.now() + msg.seconds * 1000,
    });

    const timerState: PersistedTimerState = {
      endTime: Date.now() + msg.seconds * 1000,
      fadeStartTime: Date.now() + delaySeconds * 1000,
      fadeDuration: msg.fadeDuration,
      originalVolume: msg.originalVolume,
      fadeCurvePoints: msg.fadeCurvePoints,
      active: true,
    };

    chrome.storage.local.set({ timerState }, () => {
      const stateChanged: RuntimeMessage = {
        type: MESSAGE_TYPES.TIMER_STATE_CHANGED,
        timerState,
      };
      void broadcastToYouTubeTabs(stateChanged);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === MESSAGE_TYPES.CANCEL_TIMER) {
    chrome.alarms.clear(ALARM_BETTER_SLEEP_TIMER_FADE_START);
    chrome.alarms.clear(ALARM_BETTER_SLEEP_TIMER_END);
    const timerState = { active: false } as const;
    chrome.storage.local.set({ timerState }, () => {
      const stateChanged: RuntimeMessage = {
        type: MESSAGE_TYPES.TIMER_STATE_CHANGED,
        timerState,
      };
      void broadcastToYouTubeTabs(stateChanged);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === MESSAGE_TYPES.GET_TIMER) {
    chrome.storage.local.get("timerState", (data) => {
      sendResponse(data.timerState || { active: false });
    });
    return true;
  }
});
