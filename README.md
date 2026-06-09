# 🗑️ Steam License Bulk Remover

A Tampermonkey userscript that automatically removes all complimentary licenses from your Steam account — one by one, with Play/Pause/Stop controls, three speed modes, and automatic 6-hour recovery from rate limiting.

![Tampermonkey](https://img.shields.io/badge/Tampermonkey-compatible-brightgreen?logo=tampermonkey)
![License](https://img.shields.io/github/license/Berwiin/steam-license-remover)
![Version](https://img.shields.io/badge/version-2.0.0-blue)

---

## Why?

Steam accumulates hundreds of free soundtrack and DLC licenses from bundles and promotions. There is no built-in bulk-remove option — every removal requires a manual confirmation. This script automates the entire process.

---

## Features

- Removes licenses one by one, automatically confirming Steam's modal dialog
- **Survives page reloads** — Steam reloads the page after each removal; the script resumes automatically via `sessionStorage`
- **Three speed modes** — Aggressive, Safe, Ultra Safe
- **Play / Pause / Stop** controls
- **Auto-recovery from error 84** — dismisses the error modal and waits exactly 6 hours before resuming; countdown shown in UI
- Elapsed time counter, error count, current item name
- Random jitter on all delays to avoid detection patterns

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Firefox, or Edge
2. Click **[Install script](https://github.com/Berwiin/steam-license-remover/raw/main/steam-license-remover.user.js)** — Tampermonkey will prompt you to install it
3. Confirm the install

Or manually: open Tampermonkey → **Create new script** → paste the contents of `steam-license-remover.user.js` → Save.

---

## Usage

1. Go to **[store.steampowered.com/account/licenses](https://store.steampowered.com/account/licenses/)**
2. A panel appears in the top-right corner
3. Select a mode, then click **▶ Play**
4. Leave the tab open and in the foreground

> **Keep the tab active.** Background tabs may throttle JS timers.

---

## Controls

| Button | Action |
|--------|--------|
| ▶ **Play** | Start or resume removal |
| ⏸ **Pause** | Pause — resumes with Play after page reload; cancels any active 6h wait |
| ⏹ **Stop** | Stop completely — clears the 6h wait timer |

Mode and counter can only be changed when **Paused** or **Stopped**.

---

## Rate Limit Modes

Valve does not publish rate limits for the license removal endpoint. The values below are derived from [ArchiSteamFarm](https://github.com/JustArchiNET/ArchiSteamFarm) developer findings and community reports. Each removal triggers a full page reload (~3 s), which is added on top of the pause below.

| Mode | Pause | Jitter | Total / removal | Speed |
|------|-------|--------|-----------------|-------|
| ⚡ **Aggressive** | 3 s | ±0.5 s | ~6–7 s | ~10/min |
| 🛡️ **Safe** | 12 s | ±2 s | ~15–17 s | ~4/min |
| 🐢 **Ultra Safe** | 30 s | ±3 s | ~33–36 s | ~2/min |

---

## Error 84 — Rate Limit Exceeded

When Steam returns error 84 (`RateLimitExceeded`):

1. The script automatically **dismisses the error modal**
2. Stores the resume timestamp in `localStorage` (survives browser close)
3. Switches to **Waiting** state and shows a live countdown
4. After **6 hours**, automatically resumes from where it left off

Steam's IP ban typically lasts 6+ hours and **resets if you keep hitting the limit during the ban** — so waiting the full 6 hours is intentional.

You can cancel the wait at any time with ⏸ Pause or ⏹ Stop.

---

## How it works

```
Page load → check sessionStorage (state? mode? count?)
  → state = running → wait pause+jitter → click Remove
  → Steam modal appears → script clicks OK
  → Steam reloads page → script re-injects → continues…

  → error 84 → dismiss modal → store resume_at in localStorage
  → state = waiting → countdown → after 6h → state = running → continue
```

---

## Storage

| Key | Storage | Purpose |
|-----|---------|---------|
| `sl_state` | sessionStorage | Current state (running/paused/stopped/waiting) |
| `sl_removed` | sessionStorage | Removal counter |
| `sl_errors` | sessionStorage | Error 84 count |
| `sl_mode` | sessionStorage | Selected mode |
| `sl_resume_at` | localStorage | Timestamp to resume after 6h wait |

---

## Notes

- Only removes **complimentary** (free) licenses — paid games have no Remove link and are never touched
- Tested on Chrome with Tampermonkey v5.x (June 2026)
- Steam's rate limits are IP-based — shared networks may hit limits faster

---

## License

MIT — see [LICENSE](LICENSE)
