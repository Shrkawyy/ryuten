# Ryuten.io/play — Full Capture Report
Captured: 2026-09-05 from https://ryuten.io/play/ (bundle hashes: ryuten.js 27bf00d6, vendors.js 0047e08f, css 686948ae)

## 1. Rendering engine / web apps
- **PixiJS** (webgl canvas renderer) — ~44 refs in vendors.js. The game renders on a `#canvas` via PixiJS.
- **Color-picker web component** (v1.9.0) bundled in vendors.js (used for theme/customization).
- **Custom shield/webgl "meincraft" effect** credited to `https://github.com/mitsuhiko/webgl-meincraft`.
- **WASM anti-cheat module** (the "2026 Shield" handshake) — uses `_malloc`/`WebAssembly` (25 refs), mirroring what RYUTEN ports.

## 2. Design asset origins (external links -> where visuals come from)
| Source | What it feeds |
|---|---|
| `i.imgur.com/aKvo1jQ.png` | World **background** image (RING/BG theme default) |
| `i.imgur.com/aXE1qVV.jpg`, `IxaIJVs.png`, `PzkMI5S.jpg`, `Du8bCMR.png` | **Main-menu / theme** skin/background presets + default custom-skin list |
| `i.imgur.com/gBpfVWB.png`, `NToShEd.png`, `qjMDi3s.png` | Deferred/generated **world decorations** (orange/white/particle sprites) |
| `i.imgur.com/...` (+ user custom URLs) | Player **custom skins** (imgur URLs the player sets) |
| `assets/...` (local) | All in-game textures: shields `ATLAS_1.webp`, H3D/SSS skins, `default-skin.webp`, loading-screen bg, bitmap fonts `titillium_web_0.png`, `titles_info.json`, `iconfont` |
| `fonts.googleapis.com` — **Titillium Web** + Open Sans | UI/cell text fonts |
| `account.ryuten.io` | Sign-in/account subdomain |
| `google.com/recaptcha` (sitekey `6LeK83ArAAAAAH0rljBJIJJLyeP17vAaBFch_Q1Q`) | reCAPTCHA |
| `ryuten.io/converter#`, `terms.txt`, `privacy-policy.txt`, `discord.gg/ASaWQErHH7` | External links in menu/footer |

## 3. API / backend
- All XHR goes to **`https://lancelot.ryuten.io`** (`Lancelot API Server: Version 2` on root) + path. `withCredentials` (cookie-based auth).
- Endpoints called by client: `/api/auth/status` (GET — live, returns `{"success":true,"data":{"signedIn":false,...}}`), `/api/auth/refresh`, `/api/account/info`, `/api/account/change-username`, `/api/account/get-active-inventory-items`, `/api/account/get-all-inventory-items`, `/api/game/get-all-shop-items`, `/api/zero/who` (POST), `/api/zero/intel` (POST, telemetry `device_id`/`event_name:"play"`).
- The **region + game-server list** is fetched from lancelot at runtime (not hardcoded in the bundle).

## 4. Live game WebSocket target (captured)
`_7401(t, _, e="")`
```
s = `${t}.ryuten.io/server-${_}/?${e}`               // t=region subdomain, _=server id, e=query(token)
ws = ("lh" === t)
   ? new WebSocket("ws://localhost:8000")            // local dev server
   : new WebSocket(`wss://${s}`)                     // production
ws.binaryType = "arraybuffer"
```
- So the real game socket is **`wss://<region>.ryuten.io/server-<serverId>/?<session/token>`**.
- `t === "lh"` → **`ws://localhost:8000`** is the developer localhost target — i.e. the whole game can be run against a local server for testing.
- Region changes and server/mode changes each re-call `_7401()` with the selected region/server from the fetched list.
- Uses `Tt._malloc` (WASM) for the session buffer + the Shield/attest handshake — same anti-cheat the protocol is built around.

## 5. Local-test consequence
The static mirror in this folder loads the full UI, skins, shields, fonts and the PixiJS canvas, and the client is explicitly built to point at `ws://localhost:8000` for `region="lh"`. To run it end-to-end locally you would also need a local copy of the `Lancelot` API server (auth/shop/zero) plus a game server socket on `:8000` speaking the same binary protocol — those are not served by this static mirror.