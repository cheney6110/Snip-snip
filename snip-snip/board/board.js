// board/board.js
const mat = document.getElementById('mat'), empty = document.getElementById('empty');
let z = 10, selected = null;

async function load() {
  const { clips = [] } = await chrome.storage.local.get('clips');
  if (!clips.length) return;
  empty.style.display = 'none';
  const rect = mat.getBoundingClientRect();
  clips.forEach((c, i) => {
    const scale = Math.min(1, (rect.width * 0.33) / c.w, (rect.height * 0.5) / c.h);
    const dw = c.w * scale, dh = c.h * scale;
    const x = 40 + (i % 4) * (rect.width - 140) / 4 + Math.random() * 26;
    const y = 40 + Math.floor(i / 4) * 180 + Math.random() * 18;
    add(c, Math.min(x, rect.width - dw - 20), Math.min(y, rect.height - dh - 20), dw, dh, Math.random() * 8 - 4);
  });
}

function add(clip, left, top, w, h, rot) {
  const el = document.createElement('div'); el.className = 'frag';
  el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.zIndex = ++z;
  el.dataset.rot = rot.toFixed(1); el.dataset.scale = '1';
  const img = document.createElement('img'); img.src = clip.url; img.width = w; img.height = h; img.draggable = false; el.appendChild(img);
  const fc = document.createElement('div'); fc.className = 'fc';
  fc.innerHTML = '<button class="fcb" data-a="rl">↺</button><button class="fcb" data-a="rr">↻</button><button class="fcb" data-a="sd">−</button><button class="fcb" data-a="su">+</button><button class="fcb" data-a="dl">⬇</button><button class="fcb del" data-a="del">✕</button>';
  el.appendChild(fc); mat.appendChild(el); T(el);

  let dr = false, sx, sy, sl, st;
  el.addEventListener('pointerdown', e => { if (e.target.closest('.fcb')) return; sel(el); el.style.zIndex = ++z; dr = true; sx = e.clientX; sy = e.clientY; sl = parseFloat(el.style.left); st = parseFloat(el.style.top); el.classList.add('dragging'); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dr) return; el.style.left = (sl + e.clientX - sx) + 'px'; el.style.top = (st + e.clientY - sy) + 'px'; });
  const up = () => { dr = false; el.classList.remove('dragging'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  fc.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); const a = b.dataset.a;
    if (a === 'rl') { el.dataset.rot = (+el.dataset.rot - 15).toFixed(1); T(el); }
    if (a === 'rr') { el.dataset.rot = (+el.dataset.rot + 15).toFixed(1); T(el); }
    if (a === 'su') { el.dataset.scale = Math.min(4, +el.dataset.scale * 1.15).toFixed(3); T(el); }
    if (a === 'sd') { el.dataset.scale = Math.max(.25, +el.dataset.scale / 1.15).toFixed(3); T(el); }
    if (a === 'dl') { const x = document.createElement('a'); x.href = clip.url; x.download = 'snip-' + clip.id + '.png'; x.click(); }
    if (a === 'del') remove(el, clip.id);
  });
}

function T(el) { el.style.transform = 'rotate(' + el.dataset.rot + 'deg) scale(' + el.dataset.scale + ')'; }
function sel(el) { if (selected && selected !== el) selected.classList.remove('sel'); selected = el; el.classList.add('sel'); }

async function remove(el, id) {
  el.remove();
  const { clips = [] } = await chrome.storage.local.get('clips');
  await chrome.storage.local.set({ clips: clips.filter(c => c.id !== id) });
  if (!mat.querySelector('.frag')) empty.style.display = 'grid';
}

mat.addEventListener('pointerdown', e => { if (e.target === mat || e.target === empty || empty.contains(e.target)) { if (selected) { selected.classList.remove('sel'); selected = null; } } });

document.getElementById('clear').addEventListener('click', async () => {
  mat.querySelectorAll('.frag').forEach(f => f.remove()); await chrome.storage.local.set({ clips: [] }); empty.style.display = 'grid';
});
document.getElementById('tile').addEventListener('click', () => {
  const rect = mat.getBoundingClientRect(); let x = 30, y = 30, rh = 0;
  mat.querySelectorAll('.frag').forEach(el => {
    const im = el.querySelector('img');
    if (x + im.width > rect.width - 16) { x = 30; y += rh + 22; rh = 0; }
    el.dataset.rot = '0'; el.dataset.scale = '1'; T(el); el.style.left = x + 'px'; el.style.top = y + 'px';
    x += im.width + 22; rh = Math.max(rh, im.height);
  });
});
document.getElementById('dl').addEventListener('click', async () => {
  const { clips = [] } = await chrome.storage.local.get('clips');
  clips.forEach((c, i) => setTimeout(() => { const a = document.createElement('a'); a.href = c.url; a.download = 'snip-' + c.id + '.png'; a.click(); }, i * 250));
});

load();
