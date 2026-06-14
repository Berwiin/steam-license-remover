// ==UserScript==
// @name         Steam License Bulk Remover
// @namespace    https://github.com/Berwiin/steam-license-remover
// @version      2.3.0
// @description  Bulk-removes Steam complimentary licenses — 3 speed modes, burst cooldown, Play/Pause/Stop, 6h auto-retry on rate limit
// @author       Berwiin
// @match        https://store.steampowered.com/account/licenses/
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(async () => {

  // ── Modes ─────────────────────────────────────────────────────────────────
  // Total interval = pause + jitter + ~3s page reload
  // burstSize    = how many removals before a forced cooldown
  // burstCooldown = cooldown duration in ms after reaching burstSize
  const MODES = {
    aggressive: { label: '⚡ Aggressive', pause: 3000,  jitter: 500,  speed: '~10/min', color: '#c6740a', burstSize: 8,  burstCooldown: 90000  },
    safe:       { label: '🛡️ Safe',       pause: 12000, jitter: 2000, speed: '~4/min',  color: '#4c6b22', burstSize: 8,  burstCooldown: 60000  },
    ultrasafe:  { label: '🐢 Ultra Safe', pause: 30000, jitter: 3000, speed: '~2/min',  color: '#5b7db1', burstSize: 10, burstCooldown: 45000  },
  };

  const WAIT_AFTER_ERROR = 6 * 60 * 60 * 1000; // 6 hours in ms

  // ── Storage keys ──────────────────────────────────────────────────────────
  // sessionStorage — tab-local, survives page reloads within same tab
  const SS_STATE   = 'sl_state';     // 'stopped' | 'running' | 'paused' | 'waiting'
  const SS_COUNT   = 'sl_removed';
  const SS_ERRORS  = 'sl_errors';
  const SS_MODE    = 'sl_mode';
  const SS_START      = 'sl_start_ts';
  const SS_SKIP_DELAY = 'sl_skip_delay'; // set on Play press → skips first pause
  const SS_BURST     = 'sl_burst';        // removals done since last cooldown
  const SS_COOLDOWN_UNTIL = 'sl_cooldown_until'; // sessionStorage timestamp
  // localStorage — persists across browser close (needed for 6h countdown)
  const LS_RESUME  = 'sl_resume_at';

  // ── Initial state ─────────────────────────────────────────────────────────
  let state   = sessionStorage.getItem(SS_STATE)  || 'stopped';
  let removed = parseInt(sessionStorage.getItem(SS_COUNT)  || '0');
  let errors  = parseInt(sessionStorage.getItem(SS_ERRORS) || '0');
  let mode    = sessionStorage.getItem(SS_MODE)   || 'safe';
  let burstCount = parseInt(sessionStorage.getItem(SS_BURST) || '0');

  const setState = s => { state = s; sessionStorage.setItem(SS_STATE, s); };
  const delay    = ms => new Promise(r => setTimeout(r, ms));

  const formatMs = ms => {
    if (ms <= 0) return '0s';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const elapsed = () => {
    const ts = sessionStorage.getItem(SS_START);
    return ts ? formatMs(Date.now() - parseInt(ts)) : '';
  };

  const getLinks = () =>
    [...document.querySelectorAll('a[href^="javascript:RemoveFreeLicense"]')];

  const getName = link =>
    (link.closest('td')?.textContent || '').replace(/\s+/g, ' ').replace('Remove', '').trim().slice(0, 44) || '?';

  // ── UI ────────────────────────────────────────────────────────────────────
  const ui = document.createElement('div');
  ui.style.cssText = `
    position:fixed;top:16px;right:16px;z-index:999999;
    background:#1b2838;color:#c6d4df;padding:16px 18px;
    border-radius:8px;border:1px solid #2a475e;
    font:13px/1.5 Arial,sans-serif;
    box-shadow:0 4px 24px rgba(0,0,0,.85);
    min-width:272px;user-select:none;
  `;
  document.body.appendChild(ui);

  let cdInterval = null; // countdown interval handle

  const render = (extraStatus = '') => {
    if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }

    const links      = getLinks();
    const total      = links.length + removed;
    const name       = links[0] ? getName(links[0]) : '—';
    const cfg        = MODES[mode];
    const isRunning  = state === 'running';
    const isPaused   = state === 'paused';
    const isWaiting  = state === 'waiting';
    const isStopped  = state === 'stopped';
    const canChange  = isStopped || isPaused; // can switch mode / reset

    // Mode buttons
    const modeBtns = Object.entries(MODES).map(([k, m]) => `
      <button data-mode="${k}" style="
        flex:1;padding:4px 2px;border-radius:4px;border:1px solid;cursor:pointer;
        font-size:10px;font-weight:bold;transition:all .15s;
        background:${mode===k ? m.color : 'transparent'};
        border-color:${mode===k ? m.color : '#3d5269'};
        color:${mode===k ? '#fff' : '#8f98a0'};
        ${!canChange ? 'opacity:.45;cursor:default' : ''}
      ">${m.label}</button>
    `).join('');

    // Status line
    let status = extraStatus;
    if (!status) {
      if      (isRunning) status = `⏳ ${name}`;
      else if (isPaused)  status = '⏸ Paused';
      else if (isWaiting) status = '🔴 Rate limit…';
      else                status = '○ Stopped';
    }
    const isCooling = state === 'cooling';
    if (isCooling && !extraStatus) status = '💤 Cooldown…';

    // Control buttons: Play / Pause / Stop
    const btn = (id, icon, color, active, disabled, label) => `
      <button id="${id}" title="${label}" style="
        flex:1;padding:7px 0;border-radius:5px;border:1px solid ${color};
        cursor:${disabled ? 'default' : 'pointer'};font-size:15px;
        background:${active ? color + '33' : 'transparent'};
        color:${disabled ? '#3d5269' : color};
        transition:all .15s;
      ">${icon}</button>`;

    const ctrlBtns =
      btn('sl-play',  '▶', '#4c6b22', isRunning || isCooling, isRunning || isCooling,    'Play / Resume')  +
      btn('sl-pause', '⏸', '#5b7db1', isPaused || isWaiting, isStopped,                    'Pause')          +
      btn('sl-stop',  '⏹', '#8b3a3a', false,               isStopped,                       'Stop');

    ui.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="color:#4c6b22;font-weight:bold;font-size:14px">🗑️ License Remover</span>
        <span id="sl-elapsed" style="font-size:10px;color:#8f98a0">${elapsed()}</span>
      </div>

      <div style="display:flex;gap:5px;margin-bottom:8px">${modeBtns}</div>

      <div style="background:#152331;border-radius:4px;padding:6px 10px;margin-bottom:10px;font-size:11px;color:#8f98a0">
        Delay <b style="color:${cfg.color}">${(cfg.pause/1000).toFixed(0)}s</b>+jitter
        &nbsp;·&nbsp; ${cfg.speed}
        &nbsp;·&nbsp; retry after 6h
        <br>Burst: <b style="color:${cfg.color}">${burstCount}/${cfg.burstSize}</b>
        &nbsp;·&nbsp; cooldown ${(cfg.burstCooldown/1000).toFixed(0)}s
      </div>

      <div style="margin-bottom:4px;font-size:13px">
        Removed: <b>${removed}</b>${total > removed ? ` / ~${total}` : ''}
        ${errors > 0 ? `&nbsp;<span style="color:#c6740a;font-size:11px">⚠ ${errors}× err 84</span>` : ''}
      </div>

      <div id="sl-status" style="color:#8f98a0;font-size:11px;margin-bottom:12px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${status}</div>

      <div style="display:flex;gap:6px;margin-bottom:10px">${ctrlBtns}</div>

      <div style="border-top:1px solid #2a3f5a;padding-top:7px">
        <span id="sl-reset" style="cursor:pointer;font-size:11px;color:#8f98a0;opacity:.7">↺ Reset counter</span>
      </div>`;

    // ── Event listeners ──────────────────────────────────────────────────
    ui.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      if (!canChange) return;
      mode = btn.dataset.mode;
      sessionStorage.setItem(SS_MODE, mode);
      render();
    }));

    document.getElementById('sl-play')?.addEventListener('click', () => {
      if (isRunning) return;
      if (!sessionStorage.getItem(SS_START)) sessionStorage.setItem(SS_START, Date.now());
      sessionStorage.setItem(SS_SKIP_DELAY, '1'); // skip pause for first item
      localStorage.removeItem(LS_RESUME);
      setState('running');
      run();
    });

    document.getElementById('sl-pause')?.addEventListener('click', () => {
      if (isStopped) return;
      localStorage.removeItem(LS_RESUME);
      setState('paused');
      render();
    });

    document.getElementById('sl-stop')?.addEventListener('click', () => {
      if (isStopped) return;
      localStorage.removeItem(LS_RESUME);
      setState('stopped');
      render();
    });

    document.getElementById('sl-reset')?.addEventListener('click', () => {
      removed = 0; errors = 0; burstCount = 0;
      sessionStorage.setItem(SS_COUNT, '0');
      sessionStorage.setItem(SS_ERRORS, '0');
      sessionStorage.setItem(SS_BURST, '0');
      sessionStorage.removeItem(SS_START);
      render();
    });

    // Elapsed time ticker
    const elapsedEl = document.getElementById('sl-elapsed');
    if (isRunning && elapsedEl) {
      setInterval(() => { if (elapsedEl) elapsedEl.textContent = elapsed(); }, 1000);
    }

    // 6h rate-limit countdown ticker
    if (isWaiting) {
      const resumeAt = parseInt(localStorage.getItem(LS_RESUME) || '0');
      cdInterval = setInterval(() => {
        const remaining = resumeAt - Date.now();
        const el = document.getElementById('sl-status');
        if (!el) return;
        if (remaining <= 0) {
          clearInterval(cdInterval);
          localStorage.removeItem(LS_RESUME);
          setState('running');
          run();
        } else {
          el.textContent = `🔴 Rate limit – resuming in ${formatMs(remaining)}`;
        }
      }, 1000);
    }

    // Burst cooldown countdown ticker (short break between bursts)
    if (isCooling) {
      const resumeAt = parseInt(sessionStorage.getItem(SS_COOLDOWN_UNTIL) || '0');
      cdInterval = setInterval(() => {
        // If the user paused/stopped during cooldown, abandon this ticker —
        // burst count is preserved, cooldown will resume on next Play.
        if (state !== 'cooling') { clearInterval(cdInterval); return; }

        const remaining = resumeAt - Date.now();
        const el = document.getElementById('sl-status');
        if (!el) return;
        if (remaining <= 0) {
          clearInterval(cdInterval);
          sessionStorage.removeItem(SS_COOLDOWN_UNTIL);
          burstCount = 0;
          sessionStorage.setItem(SS_BURST, '0');
          setState('running');
          run();
        } else {
          el.textContent = `💤 Cooldown – resuming in ${formatMs(remaining)}`;
        }
      }, 1000);
    }
  };

  // ── Steam modal handler ───────────────────────────────────────────────────
  // Two-phase: 1) wait for & click confirm modal OK
  //            2) watch 3s for error modal Steam shows after request fails
  //
  // Counter saved SYNCHRONOUSLY on OK click — Steam reloads the page
  // immediately after that, before any async code can run.
  const handleModal = () => new Promise(res => {
    let phase = 'confirm';
    let t = 0;

    const iv = setInterval(() => {
      t += 100;
      const dialog = document.querySelector('dialog.newmodal, dialog[open]');

      if (phase === 'confirm') {
        if (dialog) {
          const ok = dialog.querySelector('.btn_green_steamui');
          if (ok) {
            ok.click();
            // Save counters NOW — page reloads any moment after this click
            removed++;
            burstCount++;
            sessionStorage.setItem(SS_COUNT, removed);
            sessionStorage.setItem(SS_BURST, burstCount);
            phase = 'watch_error';
            t = 0;
            return;
          }
        }
        if (t >= 7000) { clearInterval(iv); res('timeout'); }

      } else { // watch_error
        if (dialog) {
          const content = dialog.querySelector('.newmodal_content')?.textContent || '';
          if (/error|84/i.test(content)) {
            // Undo increment — removal did not happen
            removed = Math.max(0, removed - 1);
            burstCount = Math.max(0, burstCount - 1);
            sessionStorage.setItem(SS_COUNT, removed);
            sessionStorage.setItem(SS_BURST, burstCount);
            // Dismiss error modal (grey OK button only)
            (dialog.querySelector('.btn_grey_steamui') ||
             dialog.querySelector('.btn_green_steamui'))?.click();
            clearInterval(iv); res('error'); return;
          }
        }
        // No error after 3 s → page already reloading, counter already saved
        if (t >= 3000) { clearInterval(iv); res('ok'); }
      }
    }, 100);
  });

  // ── Main loop ─────────────────────────────────────────────────────────────
  const run = async () => {
    render();
    if (state !== 'running') return;

    const links = getLinks();
    if (!links.length) {
      setState('stopped');
      ui.innerHTML = `
        <div style="color:#4c6b22;font-weight:bold;font-size:15px;margin-bottom:8px">✅ Done!</div>
        <div>Removed <b>${removed}</b> licenses in ${elapsed()}.</div>
        <div style="color:#8f98a0;font-size:11px;margin-top:6px">Rate limit errors: ${errors}</div>`;
      return;
    }

    // Burst limit reached → take a cooldown break before continuing
    const cfg0 = MODES[mode];
    if (burstCount >= cfg0.burstSize) {
      const resumeAt = Date.now() + cfg0.burstCooldown;
      sessionStorage.setItem(SS_COOLDOWN_UNTIL, resumeAt);
      setState('cooling');
      render();
      return; // cooldown ticker in render() will reset burst & call run() again
    }

    const skipDelay = sessionStorage.getItem(SS_SKIP_DELAY) === '1';
    sessionStorage.removeItem(SS_SKIP_DELAY);

    if (!skipDelay) {
      const cfg   = MODES[mode];
      const pause = cfg.pause + Math.floor(Math.random() * cfg.jitter);
      await delay(pause);
      if (state !== 'running') return;
    }

    links[0].click();
    const result = await handleModal();
    // On success: page already reloaded, counter already saved in handleModal.
    // This line is only reached on error or timeout.

    if (result === 'error') {
      errors++;
      sessionStorage.setItem(SS_ERRORS, errors);
      const resumeAt = Date.now() + WAIT_AFTER_ERROR;
      localStorage.setItem(LS_RESUME, resumeAt);
      setState('waiting');
      render();
      return;
    }
  };

  // ── Entry point ───────────────────────────────────────────────────────────
  // Check if 6h wait already expired (e.g. user comes back after leaving tab open)
  if (state === 'waiting') {
    const resumeAt = parseInt(localStorage.getItem(LS_RESUME) || '0');
    if (Date.now() >= resumeAt) {
      localStorage.removeItem(LS_RESUME);
      setState('running');
    }
  }

  // 'cooling' state shouldn't normally survive a reload (cooldown happens
  // between page loads, not during one) — but just in case, resume running
  if (state === 'cooling') {
    sessionStorage.removeItem(SS_COOLDOWN_UNTIL);
    burstCount = 0;
    sessionStorage.setItem(SS_BURST, '0');
    setState('running');
  }

  render();

  if (state === 'running') {
    await delay(1800); // let page settle after reload
    run();
  }

})();
