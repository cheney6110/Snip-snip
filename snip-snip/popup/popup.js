// popup/popup.js
async function activeTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }

async function startClip(mode) {
  const tab = await activeTab();
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/clip.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'START_CLIP', mode });
    window.close();
  } catch (e) { document.getElementById('warn').style.display = 'block'; }
}

document.querySelectorAll('.big').forEach(b => b.addEventListener('click', () => startClip(b.dataset.mode)));
document.getElementById('openBoard').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('board/board.html') }));

(async () => {
  const { clips = [] } = await chrome.storage.local.get('clips');
  const strip = document.getElementById('strip');
  if (!clips.length) return;
  strip.innerHTML = '';
  clips.slice(0, 12).forEach(c => {
    const img = document.createElement('img'); img.src = c.url; img.title = 'click to copy';
    img.addEventListener('click', async () => {
      try { const b = await (await fetch(c.url)).blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); img.style.outline = '2px solid #ff3d7f'; setTimeout(() => img.style.outline = '', 700); } catch (e) {}
    });
    strip.appendChild(img);
  });
})();
