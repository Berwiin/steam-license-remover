# 🗑️ Steam License Bulk Remover

A Tampermonkey userscript that automatically removes all complimentary licenses from your Steam account — one by one, surviving page reloads, with **Aggressive** and **Safe** rate-limit modes.

![Tampermonkey](https://img.shields.io/badge/Tampermonkey-compatible-brightgreen?logo=tampermonkey)
![License](https://img.shields.io/github/license/Berwiin/steam-license-remover)
![Version](https://img.shields.io/badge/version-1.2.0-blue)

---

## Why?

Steam sometimes accumulates hundreds of free soundtrack and DLC licenses you never asked for (from bundles, promotions, or free weekends). There is no bulk-remove option — you must confirm each one individually. This script automates that entirely.

---

## Features

- Removes licenses one by one, automatically confirming Steam's modal dialog
- **Survives page reloads** — Steam reloads the licenses page after each removal; the script picks up right where it left off via `sessionStorage`
- **Two rate-limit modes** — Aggressive and Safe (see below)
- **Auto-fallback** — if Aggressive mode triggers error 84, it automatically switches to Safe and waits before retrying
- Live floating UI with counter, elapsed time, current item name, and error count
- Start / Stop / Reset controls
- Random jitter on delays to avoid bot detection patterns

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Firefox, or Edge
2. Click **[Install script](https://github.com/Berwiin/steam-license-remover/raw/main/steam-license-remover.user.js)** — Tampermonkey will recognize the `.user.js` file and prompt you to install
3. Confirm the install in Tampermonkey

Or manually:
1. Open Tampermonkey → **Create new script**
2. Delete the default content and paste the contents of `steam-license-remover.user.js`
3. Save with `Ctrl+S`

---

## Usage

1. Go to **[store.steampowered.com/account/licenses](https://store.steampowered.com/account/licenses/)**
2. A panel appears in the top-right corner
3. Choose a mode, then click **▶ Start**
4. Leave the tab open and in the foreground

> **Keep the tab active.** Background tabs may throttle JS timers, causing the script to stall.

---

## Rate Limit Modes

Steam does not publicly document rate limits for the license removal endpoint. The values below are based on community findings from [ArchiSteamFarm](https://github.com/JustArchiNET/ArchiSteamFarm) developers and user reports.

Each removal triggers a full page reload (~3 s). The **Pause** below is added on top of that.

| Mode | Pause | Jitter | Total per removal | Speed | Notes |
|------|-------|--------|-------------------|-------|-------|
| ⚡ **Aggressive** | 3 s | ±0.5 s | ~6–7 s | ~10/min | May occasionally trigger error 84 |
| 🛡️ **Safe** | 12 s | ±2 s | ~15–17 s | ~4/min | Stays well within Steam limits |

### Error 84 — Rate Limit Exceeded

If Aggressive mode triggers error 84, the script:
1. Automatically switches to Safe mode
2. Waits 25–30 seconds before retrying
3. Continues from where it left off

A running error count is shown in the UI. If errors keep occurring in Safe mode, wait a few hours before resuming — Steam's IP ban can last **6+ hours** and resets if you keep hitting the limit during the ban.

---

## How it works

Steam reloads the entire licenses page after each removal, which kills any script running in the browser console. This script uses Tampermonkey (which re-injects on every load) and `sessionStorage` to persist state across reloads.

```
Page load → check sessionStorage (running? mode? count?)
  → yes → wait PAUSE+jitter → click Remove → modal appears → click OK
  → Steam reloads page → script re-injects → continues…
```

---

## Configuration

You can adjust mode parameters at the top of the script:

```js
const MODES = {
  aggressive: {
    pause:      3000,   // ms added after page reload
    jitter:     500,    // random extra ms (0 to this value)
    retryDelay: 25000,  // ms to wait after error 84
  },
  safe: {
    pause:      12000,
    jitter:     2000,
    retryDelay: 30000,
  },
};
```

---

## Notes

- Only removes **complimentary** (free) licenses — paid games are never affected, as they have no Remove link
- Tested on Chrome with Tampermonkey v5.x (June 2026)
- Steam's rate limits are IP-based — shared networks (office, university) may trigger limits faster

---

## License

MIT — see [LICENSE](LICENSE)
