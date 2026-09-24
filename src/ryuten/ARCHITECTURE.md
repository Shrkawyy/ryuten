# Ryuten.io/play — Deep Architecture (for the 3rb.io port)
Analyzed from ryuten.js 27bf00d6 (261 KB), vendors.js 0047e08f (518 KB), Albion.wasm 78610153 (53 KB).
NOTE: minified/emscripten-obfuscated, so identifiers are mangled — this map is from static analysis of the real code paths.

## 1. Stack & boot
1. Page (index/local.html) loads vendors.js (third-party libs) then ryuten.js.
2. `load` → emscripten instantiates **Albion.wasm** (the native game core + the RC4 crypto). `Tt=…` is the WASM runtime; it exposes `RCrypt.set_keys`/`RCrypt.encrypt`.
3. Startup API calls (absolute `https://lancelot.ryuten.io`): `api/auth/status` → `api/game/get-all-shop-items` → `api/zero/who|intel`. These set username, inventory, shop, and enable the region list.
4. PixiJS app boots the arena canvas; the **region list** is populated (auto-adds `lh`→"Localhost" when hostname is `localhost`).
5. User picks a region/server → `Re._7401(t,_)` opens the game socket.

## 2. Module / subsystem map (ranked by size)
| Sym | bytes | Role |
|----|----|----|
| `Ne` | 7.3k | **Inbound parser/dispatcher** — reads `V` reader, switches on `he._9492` opcodes, feeds world/gamemode/timer/leaderboard updates to the game objects. **The main event hub.**
| `X`, `W_`, `z`, `Ue`, `pe`, `we` | ~3-4k each | Player / game-object / update model (position, mass, states), settings classes.
| `Me` | 3.4k | **Outbound packet builder** — writes opcodes via `m_` writer, sends through `Re._8664` (RC4-encrypted).
| `H_`, `St`, `D_`, `M_`, `Ie`, `B_`, `Ee`, `G_`, ... | 1-2k | UI containers (menus, HUD), leaderboard, canvas layers, storage, bindings.
| `Pt`, `O/I/T/L/N/M` | 1.7k+ | **Settings model**: Pt=config store; O=bool, I=range/int, T=string, L=array/list, N=color, M=?? — the standardized settings each with `_9115` bind+persist (localStorage `..:"ryuten-settings.."`).
| `Re` | 2k | **Network socket** — connect (region→wss or `lh`→ws://localhost:8000), RC4 key setup from 64-byte init, `encrypt` outbound, raw inbound, reconnect.
| `s_`, `Ft`, `Xt/zt/n_` | 1-4k | **Asset/atlas cache**: bitmap font (text) atlas, texture atlas, sprite loaders, `createImageBitmap`.
| `V` / `m_` | — | Binary reader (DataView LE) / writer.
| `oe`/`re` | — | Inbound / outbound opcode enums.

## 3. Network layer (the part you must SWAP for 3rb.io)
This is ryuten-specific and **will not work against 3rb.io**. Full decode in PROTOCOL.md:
- **Crypto:** server → 64-byte key seed → client `RCrypt.set_keys` (RC4 KSA); client→server RC4-encrypted; server→client plaintext frames.
- **Framing:** `[u8 opcode][fields]`, little-endian, len-prefixed strings (`_3803`=len u8, `_8719`=len u16).
- **Inbound opcodes (`oe=he._9492`):** 10=gamemode-intro, 20-33=world/update/input, 40-43=state/end, 100-114=match flow (timer/leaderboard).
- **Outbound opcodes (`re=he._1361`):** 10,11,21(nick),22(skin),23,24,30-42(actions/spawn),50+.
- The engine's full frame decode lives in **Albion.wasm** (opaque) — the JS `Ne/Me/V/m_` are the readable seam.

**Replacement target (3rb.io protocol, already built in your RYUTEN V3.2):** subprotocol `d1elnjtfbyzq7a`, Shield WASM handshake (`0xD0 Hello→0xD1 Ack→0xD2 seal→0xD4 attest`), auth `[10][255][0][17]`-style, Turnstile token via `ts:"<token>"`. Drop ryuten's `Re/Ne/Me/RCrypt/Albion.wasm`; keep the render/settings/UI.

## 4. Renderer & UI (keep/edit, game-agnostic)
- **PixiJS** = the sole renderer (`vendors.js`). Arena layer + HUD layer; skins rendered from `assets/**` (H3D/SSS .webp), shields from `ATLAS_1.webp` atlas, font from bitmap `titillium_web_0`.
- **Atlas cache** (`Ft`/`s_`/`Xt`) keyed with a `TEXTURE_QUALITY` scale (`.5/1/2`) — low/med/high resolution variants of the same asset.
- UI is DOM/CSS overlay (main-menu, leaderboard, settings) using `bundle.ryuten.css` + iconfont webfonts — **fully reusable**.
- CSS textures are generated from a rectangular texture atlas; `createImageBitmap` for decode.

## 5. Assets / data
- `assets/bitmap-fonts/titillium_web_0.png` (text), `assets/images/textures/shields/ATLAS_1.webp` (shield atlas), `assets/images/textures/H3D/*` + `SSS/*` (cell skins), `assets/misc/titles_info.json` (leaderboard title defs).
- Default/theme art + default custom skins come from **imgur** (see CAPTURE.md). You'll host these yourself for the port.

## 6. What to change for the port (tight list, nothing extra)
1. **Replace the network seam** `Re`+`Ne`+`Me`+`RCrypt`+Albion.wasm with the 3rb.io client (`d1elnjtfbyzq7a` + Shield + `[10]…` + Turnstile `ts:`). `Ne`'s 20-43 world handlers and `Me`'s action builders get remapped to 3rb's opcodes.
2. **Point API base** away from `lancelot.ryuten.io` (or behind your own auth) — for local dev reuse `http://localhost:8080`.
3. **Surface 3rb's servers/modes** where ryuten reads its region list + gamemode string (`_4271`).
4. **Rebundle**: split like upstream (`vendors`/main) so the render loop and settings stay isolated from the socket swap.

That's the whole surface. Keep the PixiJS renderer, atlas cache, settings classes, and DOM/CSS UI as-is — only the network + server/mode feeding change.