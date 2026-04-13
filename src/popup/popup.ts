const checkbox = document.getElementById("showBanner") as HTMLInputElement;

chrome.storage.local.get("showBanner", (data) => {
  checkbox.checked = data.showBanner !== false;
});

checkbox.addEventListener("change", () => {
  chrome.storage.local.set({ showBanner: checkbox.checked });
});
