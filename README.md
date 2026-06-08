# 🗑️ Steam License Bulk Remover

A Tampermonkey userscript that automatically removes all complimentary licenses from your Steam account — one by one, with a live counter, surviving page reloads.

![Tampermonkey](https://img.shields.io/badge/Tampermonkey-compatible-brightgreen?logo=tampermonkey)
![License](https://img.shields.io/github/license/berwin-cz/steam-license-remover)
![Version](https://img.shields.io/badge/version-1.1.0-blue)

---

## Why?

Steam sometimes accumulates hundreds of free soundtrack and DLC licenses you never asked for (from bundles, promotions, or free weekends). There is no bulk-remove option on Steam — you have to confirm each one individually. This script automates that.

---

## Features

- Removes licenses one by one, automatically confirming Steam's modal dialog
- Survives page reloads — Steam reloads the licenses page after each removal, the script picks up right where it left off using `sessionStorage`
- Live floating UI with counter and current item name
- Start / Stop / Reset controls
- Handles rate limiting (error 84) — backs off 20 s and retries automatically
- Configurable delay between removals

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Firefox, or Edge
2. Click **[Install script](../../raw/main/steam-license-remover.user.js)** — Tampermonkey will recognize the `.user.js` file and prompt you to install it
3. Confirm the install in Tampermonkey

Or manually:
1. Open Tampermonkey dashboard → **Create new script**
2. Delete the default content and paste the contents of `steam-license-remover.user.js`
3. Save with `Ctrl+S`

---

## Usage

1. Go to **[store.steampowered.com/account/licenses](https://store.steampowered.com/account/licenses/)**
2. A small panel appears in the top-right corner
3. Click **▶ Start**
4. Leave the tab open — the script runs automatically, including across page reloads

> **Keep the tab active.** Background tabs may have throttled timers in some browsers, which can cause the script to stall.

---

## Configuration

At the top of the script, you can adjust:

```js
const PAUSE = 5000; // delay before each removal in ms
```

If you frequently hit **error 84** (rate limit), increase this value to `7000` or `8000`.

---

## How it works

Steam reloads the entire licenses page after each removal. Because of this, a simple browser console script would die on every reload. This script uses `sessionStorage` to persist state (`running`, `count`) across reloads. On each page load, Tampermonkey re-injects the script, checks if it was running, and continues automatically.

```
Page load → script starts → sessionStorage: running=true
→ wait PAUSE ms → click Remove → modal appears → click OK
→ Steam reloads page → script starts again → continues…
```

---

## Notes

- Only removes **complimentary** (free) licenses — paid games are not affected, as their Remove links do not appear on the page
- Steam may occasionally return **error 84** (rate limit exceeded) — the script detects this and waits 20 seconds before retrying
- Tested on Chrome with Tampermonkey v5.x (June 2026)

---

## License

MIT — see [LICENSE](LICENSE)
