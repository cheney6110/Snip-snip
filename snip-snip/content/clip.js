// content/clip.js — Snip Snip overlay. Draws a marker-doodle selection layer,
// hides itself, asks the background for a screenshot, crops to the shape, and
// hands back a die-cut sticker.
(() => {
  if (window.__snipSnip) return;
  window.__snipSnip = true;

  const NS = 'sns-' + Math.random().toString(36).slice(2, 7);
  const HAND = '"Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS",cursive';
  const PINK = '#ff3d7f', INK = '#232028', PAPER = '#fbf5e6';
  let host, root, dim, dctx, scis, bar, resultBar;
  let mode = 'rect', state = 'idle';
  let start = null, cur = null, pts = [], sel = null, dpr = window.devicePixelRatio || 1;

  chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'START_CLIP') startClip(m.mode || 'rect'); });

  function buildUI() {
    host = document.createElement('div');
    host.id = NS;
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647';
    root = host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(host);

    const st = document.createElement('style'); st.textContent = css(); root.appendChild(st);
    dim = document.createElement('canvas'); dim.className = 'dim'; root.appendChild(dim);

    scis = document.createElement('div'); scis.className = 'scis';
    scis.innerHTML =
      '<svg class="bl" viewBox="0 0 24 24" fill="none" stroke="' + PINK + '" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="ba"><circle cx="6" cy="6" r="2.6"/><line x1="7.9" y1="7.9" x2="20" y2="20"/></g>' +
      '<g class="bb"><circle cx="6" cy="16" r="2.6"/><line x1="7.9" y1="14.1" x2="20" y2="4"/></g></svg>' +
      '<span class="tip"></span>';
    root.appendChild(scis);

    bar = document.createElement('div'); bar.className = 'bar';
    bar.innerHTML =
      '<div class="seg"><button data-m="rect" class="mb on">▭ Box</button><button data-m="free" class="mb">◠ Free</button></div>' +
      '<span class="hint">press &amp; draw a shape · Esc to cancel</span>' +
      '<button class="x">✕</button>';
    root.appendChild(bar);

    resultBar = document.createElement('div'); resultBar.className = 'res hide'; root.appendChild(resultBar);

    sizeCanvas();
    window.addEventListener('resize', onResize, true);
    window.addEventListener('scroll', render, true);
    bar.querySelectorAll('.mb').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
    bar.querySelector('.x').addEventListener('click', teardown);
    dim.addEventListener('pointerdown', onDown);
    dim.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointermove', track, true);
  }

  function startClip(m) {
    if (!host) buildUI();
    host.style.display = '';
    setMode(m); state = 'idle'; start = cur = null; pts = []; sel = null;
    resultBar.classList.add('hide'); dpr = window.devicePixelRatio || 1; sizeCanvas(); render();
  }
  function setMode(m) { mode = m; bar && bar.querySelectorAll('.mb').forEach(b => b.classList.toggle('on', b.dataset.m === m)); }

  function sizeCanvas() {
    const w = innerWidth, h = innerHeight;
    dim.width = Math.round(w * dpr); dim.height = Math.round(h * dpr);
    dim.style.width = w + 'px'; dim.style.height = h + 'px';
    dctx = dim.getContext('2d'); dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function onResize() { dpr = window.devicePixelRatio || 1; sizeCanvas(); render(); }

  function render() {
    if (!dctx) return;
    const w = innerWidth, h = innerHeight;
    dctx.clearRect(0, 0, w, h);
    dctx.fillStyle = 'rgba(43,40,50,.34)'; dctx.fillRect(0, 0, w, h);
    if (state !== 'selecting') return;
    dctx.save(); dctx.globalCompositeOperation = 'destination-out'; trace(dctx); dctx.fill(); dctx.restore();
    dctx.save(); dctx.setLineDash([10, 8]); dctx.lineDashOffset = -(Date.now() / 38 % 18);
    dctx.lineWidth = 3; dctx.strokeStyle = PINK; dctx.lineJoin = 'round'; dctx.lineCap = 'round';
    trace(dctx); dctx.stroke(); dctx.restore();
  }
  function trace(ctx) {
    ctx.beginPath();
    if (mode === 'rect' && start && cur) {
      const x = Math.min(start.x, cur.x), y = Math.min(start.y, cur.y);
      ctx.rect(x, y, Math.abs(cur.x - start.x), Math.abs(cur.y - start.y));
    } else if (mode === 'free' && pts.length > 1) {
      ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath();
    }
  }
  let raf = null; function loop() { if (state === 'selecting') { render(); raf = requestAnimationFrame(loop); } }

  const pt = e => ({ x: e.clientX, y: e.clientY });
  function onDown(e) {
    if (state === 'result') return; e.preventDefault(); state = 'selecting';
    if (mode === 'rect') { start = pt(e); cur = pt(e); } else pts = [pt(e)];
    scis.classList.add('snip'); cancelAnimationFrame(raf); loop();
  }
  function onMove(e) {
    if (state !== 'selecting') return;
    if (mode === 'rect') cur = pt(e);
    else { const p = pt(e), l = pts[pts.length - 1]; if (!l || Math.hypot(p.x - l.x, p.y - l.y) > 3) pts.push(p); }
  }
  function track(e) { if (scis) { scis.classList.add('show'); scis.style.left = e.clientX + 'px'; scis.style.top = e.clientY + 'px'; } }
  function onUp() {
    if (state !== 'selecting') return; scis.classList.remove('snip'); cancelAnimationFrame(raf);
    const b = box(); if (!b || b.w < 6 || b.h < 6) { state = 'idle'; render(); return; }
    sel = Object.assign({ mode, pts: pts.slice() }, b); capture();
  }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); teardown(); } }
  function box() {
    if (mode === 'rect' && start && cur) { const x = Math.min(start.x, cur.x), y = Math.min(start.y, cur.y); return { x, y, w: Math.abs(cur.x - start.x), h: Math.abs(cur.y - start.y) }; }
    if (mode === 'free' && pts.length > 2) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of pts) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); } return { x: a, y: b, w: c - a, h: d - b }; }
    return null;
  }

  function capture() {
    host.style.display = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      chrome.runtime.sendMessage({ type: 'CAPTURE' }, (resp) => {
        host.style.display = '';
        if (!resp || !resp.dataUrl) { toast(resp && resp.err ? "can't snip this page" : 'snip failed, try again'); state = 'idle'; render(); return; }
        crop(resp.dataUrl);
      });
    }));
  }

  function crop(shotUrl) {
    const img = new Image();
    img.onload = () => {
      const sx = img.width / innerWidth, sy = img.height / innerHeight;
      const pad = Math.round(12 * sx);
      const bw = Math.round(sel.w * sx), bh = Math.round(sel.h * sy);
      const fw = bw + pad * 2, fh = bh + pad * 2;
      const c = document.createElement('canvas'); c.width = fw; c.height = fh;
      const f = c.getContext('2d');
      const path = () => {
        f.beginPath();
        if (sel.mode === 'free' && sel.pts.length > 2) {
          f.moveTo((sel.pts[0].x - sel.x) * sx + pad, (sel.pts[0].y - sel.y) * sy + pad);
          for (let i = 1; i < sel.pts.length; i++) f.lineTo((sel.pts[i].x - sel.x) * sx + pad, (sel.pts[i].y - sel.y) * sy + pad);
          f.closePath();
        } else {
          const r = 10 * sx, x = pad, y = pad;
          f.moveTo(x + r, y); f.arcTo(x + bw, y, x + bw, y + bh, r); f.arcTo(x + bw, y + bh, x, y + bh, r);
          f.arcTo(x, y + bh, x, y, r); f.arcTo(x, y, x + bw, y, r); f.closePath();
        }
      };
      // white die-cut rim + soft shadow
      f.save(); f.lineJoin = 'round'; f.lineCap = 'round';
      f.shadowColor = 'rgba(43,40,50,.3)'; f.shadowBlur = 8 * sx; f.shadowOffsetY = 4 * sx;
      f.strokeStyle = '#fffdf6'; f.lineWidth = 11 * sx; path(); f.stroke();
      f.shadowColor = 'transparent'; f.fillStyle = '#fffdf6'; path(); f.fill(); f.restore();
      // content
      f.save(); path(); f.clip(); f.drawImage(img, sel.x * sx - pad, sel.y * sy - pad); f.restore();
      // hand-drawn ink edge
      f.save(); path(); f.strokeStyle = 'rgba(43,40,50,.5)'; f.lineWidth = 1.6 * sx; f.stroke(); f.restore();

      showResult(c.toDataURL('image/png'), fw, fh);
    };
    img.src = shotUrl;
  }

  function showResult(url, w, h) {
    state = 'result';
    dctx.clearRect(0, 0, innerWidth, innerHeight);
    const cx = sel.x + sel.w / 2, top = Math.min(innerHeight - 92, sel.y + sel.h + 14);
    resultBar.style.left = Math.max(12, Math.min(innerWidth - 380, cx - 185)) + 'px';
    resultBar.style.top = top + 'px';
    resultBar.innerHTML =
      '<img class="thumb" src="' + url + '">' +
      '<div class="acts">' +
      '<button data-a="copy">Copy</button><button data-a="save">Save</button>' +
      '<button data-a="board" class="go">Stick to board</button>' +
      '<button data-a="again" class="gh">Again</button><button data-a="close" class="gh">Done</button></div>';
    resultBar.classList.remove('hide');
    resultBar.querySelector('[data-a="copy"]').onclick = async (e) => {
      try { const b = await (await fetch(url)).blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); e.target.textContent = 'Copied ✓'; setTimeout(() => e.target.textContent = 'Copy', 1200); }
      catch (err) { toast('copy blocked here — try Save'); }
    };
    resultBar.querySelector('[data-a="save"]').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'snip-' + Date.now() + '.png'; a.click(); };
    resultBar.querySelector('[data-a="board"]').onclick = async (e) => { await saveToBoard(url, w, h); e.target.textContent = 'Stuck ✓'; setTimeout(() => e.target.textContent = 'Stick to board', 1200); };
    resultBar.querySelector('[data-a="again"]').onclick = () => startClip(mode);
    resultBar.querySelector('[data-a="close"]').onclick = teardown;
  }

  async function saveToBoard(url, w, h) {
    try {
      const { clips = [] } = await chrome.storage.local.get('clips');
      clips.unshift({ id: Date.now(), url, w, h, ts: Date.now() });
      while (clips.length > 20) clips.pop();
      await chrome.storage.local.set({ clips });
    } catch (e) { toast('board is full — tidy it first'); }
  }

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  }
  function teardown() {
    window.removeEventListener('resize', onResize, true); window.removeEventListener('scroll', render, true);
    window.removeEventListener('pointerup', onUp, true); window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointermove', track, true);
    if (host) host.remove(); host = null; state = 'idle';
  }

  function css() {
    return `
    :host{all:initial}
    .dim{position:fixed;inset:0;cursor:none;touch-action:none}
    .scis{position:fixed;width:0;height:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .12s}
    .scis.show{opacity:1}
    .scis .tip{position:absolute;left:0;top:0;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;
      background:${PINK};box-shadow:0 0 0 2px #fff,0 1px 2px rgba(43,40,50,.4)}
    .scis .bl{position:absolute;left:-24px;top:-22px;width:21px;height:21px;transform:rotate(34deg);filter:drop-shadow(0 1px 1px rgba(43,40,50,.25))}
    .scis.snip .bl{animation:wig .26s ease-in-out infinite}
    .scis.snip .ba{transform-origin:8px 8px;animation:sa .26s ease-in-out infinite}
    .scis.snip .bb{transform-origin:8px 8px;animation:sb .26s ease-in-out infinite}
    @keyframes wig{0%,100%{transform:rotate(34deg)}50%{transform:rotate(30deg)}}
    @keyframes sa{0%,100%{transform:rotate(0)}50%{transform:rotate(-13deg)}}
    @keyframes sb{0%,100%{transform:rotate(0)}50%{transform:rotate(13deg)}}

    .bar{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;
      padding:8px 10px;background:${PAPER};border:3px solid ${INK};border-radius:16px 13px 17px 12px;
      box-shadow:4px 5px 0 rgba(43,40,50,.2);font-family:${HAND};color:${INK};z-index:6}
    .bar .seg{display:flex;gap:4px;background:rgba(43,40,50,.08);padding:3px;border-radius:11px}
    .bar .mb{font-family:${HAND};font-size:14px;color:#6b6472;background:transparent;border:none;padding:7px 12px;border-radius:9px;cursor:pointer}
    .bar .mb.on{color:#fff;background:${PINK}}
    .bar .hint{font-size:14px;color:#6b6472}
    .bar .x{width:28px;height:28px;border:none;border-radius:8px;cursor:pointer;background:transparent;color:#6b6472;font-size:14px}
    .bar .x:hover{background:rgba(255,61,127,.15);color:${PINK}}

    .res{position:fixed;z-index:7;display:flex;gap:9px;align-items:center;padding:9px;background:${PAPER};
      border:3px solid ${INK};border-radius:16px 13px 17px 12px;box-shadow:4px 5px 0 rgba(43,40,50,.2);font-family:${HAND}}
    .res.hide{display:none}
    .res .thumb{max-width:78px;max-height:60px;border-radius:6px}
    .res .acts{display:flex;gap:6px;flex-wrap:wrap;max-width:280px}
    .res button{font-family:${HAND};font-size:14px;color:${INK};cursor:pointer;padding:8px 11px;border-radius:12px 10px 12px 11px;
      border:2.5px solid ${INK};background:#fff;box-shadow:2px 2px 0 rgba(43,40,50,.2);white-space:nowrap}
    .res button:hover{transform:translate(-1px,-1px)}
    .res button:active{transform:translate(1px,1px)}
    .res button.go{background:${PINK};color:#fff}
    .res button.gh{background:transparent;border-color:rgba(43,40,50,.3);color:#6b6472}

    .toast{position:fixed;bottom:26px;left:50%;transform:translate(-50%,16px);background:${PAPER};border:3px solid ${INK};
      color:${INK};padding:9px 18px;border-radius:16px 13px 17px 12px;font-family:${HAND};font-size:15px;
      box-shadow:4px 5px 0 rgba(43,40,50,.2);opacity:0;transition:opacity .25s,transform .25s;z-index:8}
    .toast.show{opacity:1;transform:translate(-50%,0)}`;
  }
})();
