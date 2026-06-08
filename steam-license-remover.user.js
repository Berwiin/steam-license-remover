// ==UserScript==
// @name         Steam License Bulk Remover
// @namespace    https://github.com/berwin-cz/steam-license-remover
// @version      1.1.0
// @description  Automatically removes Steam complimentary licenses one by one, survives page reloads
// @author       berwin_cz
// @match        https://store.steampowered.com/account/licenses/
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(async () => {
  const KEY_RUN   = 'sl_running';
  const KEY_COUNT = 'sl_removed';
  const PAUSE     = 5000; // delay before each removal in ms — increase if you get error 84
  const delay     = ms => new Promise(r => setTimeout(r, ms));

  let running = sessionStorage.getItem(KEY_RUN) === '1';
  let removed = parseInt(sessionStorage.getItem(KEY_COUNT) || '0');

  // ── UI ────────────────────────────────────────────────────────────────────
  const ui = document.createElement('div');
  ui.style.cssText = `
    position:fixed;top:16px;right:16px;z-index:999999;
    background:#1b2838;color:#c6d4df;padding:14px 18px;
    border-radius:6px;border:1px solid #4c6b22;
    font:13px/1.5 Arial,sans-serif;
    box-shadow:0 4px 20px rgba(0,0,0,.7);
    min-width:250px;user-select:none;
  `;
  document.body.appendChild(ui);

  const render = () => {
    const links = getLinks();
    const total = links.length + removed;
    const name  = links[0] ? getName(links[0]) : '—';

    ui.innerHTML = `
      <div style="color:#4c6b22;font-weight:bold;font-size:14px;margin-bottom:8px">🗑️ License Remover</div>
      <div style="margin-bottom:3px">Removed: <b>${removed}</b>${total > removed ? ` / ~${total}` : ''}</div>
      <div style="color:#8f98a0;font-size:11px;margin-bottom:10px">${running ? '⏳ ' + name : '○ Stopped'}</div>
      <div style="border-top:1px solid #2a3f5a;padding-top:8px;display:flex;gap:14px">
        ${running
          ? `<span id="sl-stop"  style="cursor:pointer;font-size:12px">⏹ Stop</span>`
          : `<span id="sl-start" style="cursor:pointer;font-size:12px;color:#4c6b22">▶ Start</span>`}
        <span id="sl-reset" style="cursor:pointer;font-size:11px;opacity:.5">↺ Reset counter</span>
      </div>`;

    document.getElementById('sl-start')?.addEventListener('click', () => {
      running = true; sessionStorage.setItem(KEY_RUN, '1'); run();
    });
    document.getElementById('sl-stop')?.addEventListener('click', () => {
      running = false; sessionStorage.setItem(KEY_RUN, '0'); render();
    });
    document.getElementById('sl-reset')?.addEventListener('click', () => {
      removed = 0; sessionStorage.setItem(KEY_COUNT, '0'); render();
    });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getLinks = () =>
    [...document.querySelectorAll('a[href^="javascript:RemoveFreeLicense"]')];

  const getName = (link) =>
    (link.closest('td')?.textContent || '').replace(/\s+/g, ' ').replace('Remove', '').trim().slice(0, 46) || '?';

  const clickOK = () => new Promise(res => {
    let t = 0;
    const iv = setInterval(() => {
      t += 100;
      const ok = document.querySelector('dialog.newmodal .btn_green_steamui, dialog[open] .btn_green_steamui');
      if (ok) { ok.click(); clearInterval(iv); res(true); return; }
      if (t >= 7000) { clearInterval(iv); res(false); }
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
        <div style="color:#4c6b22;font-weight:bold;font-size:14px;margin-bottom:6px">✅ Done!</div>
        <div>Removed <b>${removed}</b> license${removed !== 1 ? 's' : ''}.</div>`;
      return;
    }

    await delay(PAUSE);
    if (!running) return;

    links[0].click();
    const ok = await clickOK();

    if (ok) {
      removed++;
      sessionStorage.setItem(KEY_COUNT, removed);
      // Steam reloads the page here — the script resumes automatically on next load
    } else {
      // Timeout / error 84 — back off for 20 s and retry
      await delay(20000);
      if (running) run();
    }
  };

  // ── Entry point ───────────────────────────────────────────────────────────
  render();
  if (running) {
    await delay(1500); // wait for page to fully settle after reload
    run();
  }
})();
