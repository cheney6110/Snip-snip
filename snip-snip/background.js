// background.js — captures the visible tab and starts snipping via shortcut.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'CAPTURE') {
    const windowId = sender.tab ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl, err: chrome.runtime.lastError ? chrome.runtime.lastError.message : null });
    });
    return true;
  }
});

async function startOnTab(tab, mode) {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/clip.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'START_CLIP', mode });
  } catch (e) {
    console.warn('Snip Snip: cannot run on this page —', e && e.message);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'start-clip') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  startOnTab(tab, 'rect');
});
