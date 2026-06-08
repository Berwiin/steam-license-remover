// ==UserScript==
// @name         Steam License Bulk Remover
// @namespace    https://github.com/Berwiin/steam-license-remover
// @version      1.2.0
// @description  Automatically removes Steam complimentary licenses — Aggressive & Safe mode, survives page reloads
// @author       Berwiin
// @match        https://store.steampowered.com/account/licenses/
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(async () => {
  // ── Config ────────────────────────────────────────────────────────────────
  const MODES = {
    aggressive: {
      label:       '⚡ Aggressive',
      pause:       3000,   // ms between click and next cycle (+ ~3s page reload = ~6s total)
      jitter:      500,    // random extra ms to avoid pattern detection
      retryDelay:  25000,  // ms to wait after error 84
      color:       '#c6740a',
      desc:        '~10 removals/min — may trigger rate limit',
    },
    safe: {
      label:       '🛡️ Safe',
      pause:       12000,  // ms between click and next cycle (+ ~3s page reload = ~15s total)
      jitter:      2000,
      retryDelay:  30000,
      color:       '#4c6b22',
      desc:        '~4 removals/min — stays within Steam limits',
    },
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const KEY_RUN    = 'sl_running';
  const KEY_COUNT  = 'sl_removed';
  const KEY_ERRORS = 'sl_errors';
  const KEY_MODE   = 'sl_mode';
  const KEY_START  = 'sl_start_ts';

  const delay = ms => new Promise(r => setTimeout(r, ms));

  let running = sessionStorage.getItem(KEY_RUN) === '1';
  let removed = parseInt(sessionStorage.getItem(KEY_COUNT)  || '0');
  let errors  = parseInt(sessionStorage.getItem(KEY_ERRORS) || '0');
  let mode    = sessionStorage.getItem(KEY_MODE) || 'safe';

  // ── UI ────────────────────────────────────────────────────────────────────
  const ui = document.createElement('div');
  ui.style.cssText = `
    position:fixed;top:16px;right:16px;z-index:999999;
    background:#1b2838;color:#c6d4df;padding:16px 18px;
    border-radius:8px;border:1px solid #4c6b22;
    font:13px/1.5 Arial,sans-serif;
    box-shadow:0 4px 24px rgba(0,0,0,.8);
    min-width:260px;user-select:none;
  `;
  document.body.appendChild(ui);

  const getLinks = () =>
    [...document.querySelectorAll('a[href^="javascript:RemoveFreeLicense"]')];

  const getName = link =>
    (link.closest('td')?.textContent || '').replace(/\s+/g,' ').replace('Remove','').trim().slice(0, 44) || '?';

  const elapsed = () => {
    const ts = sessionStorage.getItem(KEY_START);
    if (!ts) return '';
    const s = Math.floor((Date.now() - parseInt(ts)) / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const render = (statusLine = '') => {
    const links   = getLinks();
    const total   = links.length + removed;
    const name    = links[0] ? getName(links[0]) : '—';
    const cfg     = MODES[mode];
    const speed   = mode === 'aggressive' ? '~10/min' : '~4/min';

    ui.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="color:#4c6b22;font-weight:bold;font-size:14px">🗑️ License Remover</span>
        <span style="font-size:10px;color:#8f98a0">${elapsed()}</span>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:10px">
        <button id="sl-btn-aggressive" style="
          flex:1;padding:5px 0;border-radius:4px;border:1px solid;cursor:pointer;font-size:11px;font-weight:bold;
          background:${mode==='aggressive'?'#c6740a':'transparent'};
          border-color:${mode==='aggressive'?'#c6740a':'#3d5269'};
          color:${mode==='aggressive'?'#fff':'#8f98a0'};
        ">⚡ Aggressive</button>
        <button id="sl-btn-safe" style="
          flex:1;padding:5px 0;border-radius:4px;border:1px solid;cursor:pointer;font-size:11px;font-weight:bold;
          background:${mode==='safe'?'#4c6b22':'transparent'};
          border-color:${mode==='safe'?'#4c6b22':'#3d5269'};
          color:${mode==='safe'?'#fff':'#8f98a0'};
        ">🛡️ Safe</button>
      </div>

      <div style="background:#152331;border-radius:4px;padding:7px 10px;margin-bottom:10px;font-size:11px;color:#8f98a0">
        Pauza: <b style="color:${cfg.color}">${(cfg.pause/1000).toFixed(0)}s</b> +jitter
        &nbsp;|&nbsp; ${speed}
        &nbsp;|&nbsp; retry: ${cfg.retryDelay/1000}s
      </div>

      <div style="margin-bottom:6px">
        Odstraněno: <b style="color:#c6d4df">${removed}</b>${total > removed ? ` / ~${total}` : ''}
        &nbsp;&nbsp;<span style="color:#c6740a;font-size:11px">${errors > 0 ? `⚠ ${errors} err` : ''}</span>
      </div>

      <div style="color:#8f98a0;font-size:11px;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${running ? `⏳ ${name}` : statusLine || '○ Zastaveno'}
      </div>

      <div style="border-top:1px solid #2a3f5a;padding-top:8px;display:flex;gap:12px;align-items:center">
        ${running
          ? `<span id="sl-stop"  style="cursor:pointer;font-size:12px;color:#c6d4df">⏹ Stop</span>`
          : `<span id="sl-start" style="cursor:pointer;font-size:12px;color:#4c6b22;font-weight:bold">▶ Start</span>`}
        <span id="sl-reset" style="cursor:pointer;font-size:11px;color:#8f98a0">↺ Reset</span>
      </div>`;

    document.getElementById('sl-btn-aggressive').onclick = () => {
      if (running) return;
      mode = 'aggressive'; sessionStorage.setItem(KEY_MODE, mode); render();
    };
    document.getElementById('sl-btn-safe').onclick = () => {
      if (running) return;
      mode = 'safe'; sessionStorage.setItem(KEY_MODE, mode); render();
    };
    document.getElementById('sl-start')?.addEventListener('click', () => {
      running = true;
      sessionStorage.setItem(KEY_RUN, '1');
      sessionStorage.setItem(KEY_START, Date.now());
      run();
    });
    document.getElementById('sl-stop')?.addEventListener('click', () => {
      running = false; sessionStorage.setItem(KEY_RUN, '0'); render();
    });
    document.getElementById('sl-reset')?.addEventListener('click', () => {
      removed = 0; errors = 0;
      sessionStorage.setItem(KEY_COUNT, '0');
      sessionStorage.setItem(KEY_ERRORS, '0');
      sessionStorage.removeItem(KEY_START);
      render();
    });
  };

  // ── Steam modal handler ───────────────────────────────────────────────────
  const clickOK = () => new Promise(res => {
    let t = 0;
    const iv = setInterval(() => {
      t += 100;
      const dialog = document.querySelector('dialog.newmodal, dialog[open]');
      if (dialog) {
        // Detekce chyby v obsahu modalu
        const content = dialog.querySelector('.newmodal_content')?.textContent || '';
        if (content.toLowerCase().includes('error') || content.includes('84')) {
          dialog.querySelector('.btn_grey_steamui')?.click(); // Cancel
          clearInterval(iv); res('error'); return;
        }
        const ok = dialog.querySelector('.btn_green_steamui');
        if (ok) { ok.click(); clearInterval(iv); res('ok'); return; }
      }
      if (t >= 7000) { clearInterval(iv); res('timeout'); }
    }, 100);
  });

  // ── Main loop ─────────────────────────────────────────────────────────────
  const run = async () => {
    render();
    if (!running) return;

    const links = getLinks();
    if (!links.length) {
      running = false;
      sessionStorage.setItem(KEY_RUN, '0');
      ui.innerHTML = `
        <div style="color:#4c6b22;font-weight:bold;font-size:14px;margin-bottom:6px">✅ Hotovo!</div>
        <div>Odstraněno <b>${removed}</b> licencí za ${elapsed()}.</div>
        <div style="color:#8f98a0;font-size:11px;margin-top:6px">Chyby (rate limit): ${errors}</div>`;
      return;
    }

    const cfg   = MODES[mode];
    const pause = cfg.pause + Math.floor(Math.random() * cfg.jitter);

    await delay(pause);
    if (!running) return;

    links[0].click();
    const result = await clickOK();

    if (result === 'error') {
      // Error 84 / rate limit — switch to safe mode automatically + wait
      errors++;
      sessionStorage.setItem(KEY_ERRORS, errors);
      if (mode === 'aggressive') {
        mode = 'safe';
        sessionStorage.setItem(KEY_MODE, mode);
      }
      render(`⛔ Rate limit! Čekám ${cfg.retryDelay/1000}s…`);
      await delay(cfg.retryDelay);
      if (running) run();
      return;
    }

    // OK — page will reload, script auto-resumes
    removed++;
    sessionStorage.setItem(KEY_COUNT, removed);
    // (page reload happens here — script continues on next load)
  };

  // ── Entry point ───────────────────────────────────────────────────────────
  render();
  if (running) {
    await delay(1800); // wait for page to settle after reload
    run();
  }
})();
