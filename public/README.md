# Mouse spawn target and background URL — 1.2.1-xplus.9

Install `dist/RYUTEN-Senpa.user.js`, disable earlier versions, and reload https://senpa.io/web/ .

- Right-click in the game to lock a blue square at the visible mouse location. Tab requests the empty FFA player's spawn at that target. Without a locked square, Tab captures the current mouse position. Alive players switch normally. The multibox panel lets you disable Mouse spawn target or clear it. The square is 500 world units wide (minimum 10 screen pixels).
- The empty connection receives the same spectator cursor layout seen in the supplied ONYX reference (opcode 20, mode 1, signed X/Y). The native protocol engine writes the packet. Before a mouse-targeted spawn, this build waits for a fresh native opcode 23 position response within 150 world units of the requested point. If no confirmation arrives within 8 seconds, the request stops with a message instead of spawning far away. Final placement/collision rules remain server-owned.
- Coordinates come from the visible Ryuten camera, so zoom, render resolution and XPLUS camera smoothing do not shift the requested point. Switching servers clears the locked point.
- Open Settings and use **Map background URL** in the extra settings area. Paste a direct HTTPS image URL; it applies after 600 ms, or press Enter / Apply background. Successful URLs are saved and restored on reload. An image host must allow cross-origin image loading for WebGL. Failure reports the problem and retains the last good background; importing a local image also remains available.

Validation: 131 local tests pass, including packet-byte layout, acknowledgement gating/timeouts, cursor projection, border/tag regressions and asynchronous image loading tests. No live gameplay or browser GPU run was performed in this environment. This is not a claim of verified live spawn placement. See `verification/mouse-background-tests.txt` and `verification/MOUSE_SPAWN_NOTES.md`.

Arabic installation instructions: `INSTALL-AR.txt`.

---

## Previous release notes (historical)

# Border, Teamtag and FFA update — 1.2.1-xplus.8

Installation: disable the old Ryuten userscript, install `dist/RYUTEN-Senpa.user.js`, then reload https://senpa.io/web/ . Keep only one version enabled.

- Border: use the existing Ryuten mesh/shader with locally generated geometry derived from the actual Senpa left/top/right/bottom bounds. Border visibility, width, color and Ryuten glow remain adjustable. The original bundled WASM returns zero-filled border buffers; the reproducible probe is in `verification/border-wasm-probe.mjs`.
- Teamtag: render the server-provided `tag`, falling back to `clanTag`; clan metadata is also preserved. Enable “Show Teamtag / clan tags” if previously disabled.
- FFA: the “Request nearby spawn” option now works for FFA as well as WindBine. When the other player is alive, the empty connection requests spectator positioning at that player's location before sending one native spawn request. This does not send arbitrary coordinates in the spawn packet or guarantee that the server accepts proximity. No repeated death/respawn loop is added. Reconnecting restarts the positioning wait.

Validation: `npm test` passes 119 tests, including 9 new border/tag/FFA regression tests. `npm run build` validates generated JavaScript and frozen snapshot hashes. The original Senpa protocol snapshot is unchanged. Live server gameplay and browser GPU rendering were NOT verified in this environment (no local Chromium executable). Prior screenshots/reports retained below and in verification are historical, not evidence for this release.

Arabic instructions: `INSTALL-AR.txt`.

---

## Previous release notes (historical)

# Ryuten–Senpa Held-Feed Fix — 1.2.1-xplus.6

Full Shields, XPLUS maximum 500 ms. Based on the delivered `1.2.1-xplus.5` archive, not on an unavailable correction package.

## Install and use

Disable the previous port, install `dist/RYUTEN-Senpa.user.js`, and reload. Confirm `1.2.1-xplus.6` in the HUD. Hold the **held-feed key (W by default)**, switch players using your existing controls, and keep W down. The old player stops feeding; the selected player receives the feed hold. Release W to stop it. Tab switches native tabs/FFA players; Q switches WindBine pairs. R remains recording. No new recording/splitting hotkey is assigned.

The exact old defaults `single eject = W` and `held feed = E` are swapped once to `single eject = E`, `held feed = W`. Custom keymaps are left unchanged. `Feed follows tab switch` is enabled once for this requested behavior. Previous values are backed up in the existing local preferences object under `held-feed-before-v1`; `held-feed-migration-v1` prevents repeated overwrites. A later intentional change to the follow setting is respected. Resetting Controls uses the new W/E defaults. This does not import or publish account details.

## Reproduced problems

The old distribution sends `[23,0,0]` on its default W key: a single native eject, not a hold. Its native macro can transfer successfully between already-live native slots when correctly bound; this update does not claim that every old transfer path was broken.

The pending-spawn branch explicitly released feed, and the feed controller discarded intent when the target was temporarily unavailable. A test using the old controller's existing public methods confirms that feeding never resumes when that player becomes ready. The old artifact fails both corresponding browser cases; the patched artifact passes.

## Changes

Physical held-input ownership is tracked separately from the currently feeding connection/slot. A native switch sends the required stop for the old slot and start for the new slot; this is not a key release and does not require another press. Real key-up owns cancellation, including when the event target is an input or its modifier spelling changed. Mouse-held feed and keyboard-held feed do not release each other prematurely. Mirrored Ryuten visual-tab stop events cannot clear a held physical key.

For native and custom feeding, a switch to an unavailable player pauses emissions while retaining the hold. There is one bounded 40 ms readiness poll while waiting, with no feed/spawn request burst and no new heartbeat while normal native feeding is active. When actual native ownership is ready, feeding resumes on that slot. Key-up invalidates the hold and cancels pending work, so a later spawn cannot re-arm it. Waiting expires after 15 seconds, rather than leaving a stuck input forever.

Custom timer feeding—including the existing 10 ms test—keeps its current timer deadline when switching between ready players. A switch does not inject an extra single-eject pulse. Returning from an unavailable player sends at most one immediate pulse and resumes normal timing; it never catches up a backlog.

Hidden auxiliary menus and initial auxiliary connection cleanup do not cancel the main held key merely because a second engine starts. An inactive slot's death does not cancel a living selected slot's feed. Explicit menus/chat, verification, loss of focus, hiding/leaving the page, actual active connection cleanup, replay, disposal and a readiness timeout still release feeding. The inherited line-split operation intentionally releases feed at activation; that independent behavior was not changed in this feed-switch update.

## Scope retained

Only four application source files changed: `src/app/feed.js`, `src/app/multibox.js`, `src/app/presentation.js`, and `src/app/settings.js`. Rendering/interpolation, skins/shields, outlined mass numbers, readable chat, map handling, FFA auto-connect and the line controller are otherwise unchanged. All 56 captured source/snapshot/asset files compared with xplus.5 remain byte-identical. The native packet writers, handshake and verification machinery were not changed. No dependency or font was downloaded or added.

The line-split controller remains the inherited xplus.5 controller; this release does not claim to fix its live geometry. Its settings and experimental configurable split counts are unchanged. See `references/README-xplus5.md` for the historical line-specific guide, not for current build verification. The exact original Ryuten map image is still not available. XPLUS remains an uncalibrated visual experiment.

## Verification

- 110/110 unit tests passed.
- 17/17 held-feed native-input/browser cases passed, including 30 repeated native tab switches from a single W press, real auxiliary FFA and WindBine engine instances, Q pair changes, Tab changes, pending spawn, key-up cancellation, native/custom cadence, replay and lifecycle stops.
- 21/21 line-input browser regression cases passed.
- 7/7 mass/presentation browser regression cases passed.
- All three browser suites reported zero page errors. Startup smoke passed; its blocked-resource error is retained in the receipt, not erased.
- Two existing-API unit probes and two browser cases reproduce expected failures in the previous xplus.5 code.
- Repeated builds are byte-identical. The historical xplus.2 frozen baseline still reconstructs byte-identically using its pinned pre-change parent oracle.

These are offline tests of the actual captured native parsers, packet writers and UI event handlers. The world and network are fixtures; GPU submission is substituted. No live server was contacted. Server rate limits, input transit delays, physical-GPU performance and subjective gameplay acceptance are not verified. The required native stop-old/start-new commands do not guarantee zero network latency between emitters.

## Build and local distribution

```bash
npm run build
npm test
npm run test:feed-browser
npm run test:lines-browser
npm run test:browser
npm run test:smoke
python tools/verify-package.py
python tools/serve.py --open
```

To reproduce the prior controller's expected failures (nonzero exit is expected):

```bash
FEED_SOURCE=references/feed.before-held-feed.js node --test --test-name-pattern="old-API regression" tests/feed.test.mjs
```

Windows PowerShell equivalent:

```powershell
$env:FEED_SOURCE="references/feed.before-held-feed.js"
node --test --test-name-pattern="old-API regression" tests/feed.test.mjs
Remove-Item Env:FEED_SOURCE
```

Existing diagnostics now report `held`, `waitingForPlayer`, `nativeFeeding`, and `inputSources`, alongside the original timer counters. In the top page console: `SENPA_PORT.child.feedTiming.snapshot()`. The old `running` field continues to indicate the custom timer, not the native held emitter; use `held` / `nativeFeeding` for those.

Installer: 6,006,114 bytes. SHA-256: `149c964db37b5a40410aa135cf4a568be064fb97b83955e3f098299442224c80`.
