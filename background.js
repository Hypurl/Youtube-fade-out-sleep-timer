chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "sleep-fade-start") return;

  const tabs = await chrome.tabs.query({ url: "*://www.youtube.com/*" });
  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "START_FADE" });
    } catch {
      // Tab might have been closed, ignore
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_TIMER") {
    const delayMinutes = Math.max(0, msg.minutes - msg.fadeDuration / 60);

    chrome.alarms.clear("sleep-fade-start");
    chrome.alarms.create("sleep-fade-start", {
      delayInMinutes: Math.max(0.08, delayMinutes),
    });
    chrome.storage.local.set({
      timerState: {
        endTime: Date.now() + msg.minutes * 60 * 1000,
        fadeStartTime: Date.now() + delayMinutes * 60 * 1000,
        fadeDuration: msg.fadeDuration,
        originalVolume: msg.originalVolume,
        active: true,
      },
    });

    sendResponse({ ok: true });
  }

  if (msg.type === "CANCEL_TIMER") {
    chrome.alarms.clear("sleep-fade-start");
    chrome.storage.local.set({ timerState: { active: false } });
    sendResponse({ ok: true });
  }

  if (msg.type === "GET_TIMER") {
    chrome.storage.local.get("timerState", (data) => {
      sendResponse(data.timerState || { active: false });
    });
    return true;
  }
});
