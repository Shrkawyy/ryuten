# Ryuten for Senpa — Full Shields / XPLUS 500 / Readable Mass

Version: **1.2.1-xplus.3**. This is the current full-shields test branch, not
the No Shields edition and not the unavailable historical Correction Candidate.

## Install

1. Back up your settings and disable every other Ryuten/Senpa gameplay userscript.
2. Import `dist/RYUTEN-Senpa.user.js` in your userscript manager, or run
   `python tools/serve.py --open` and use the local installer page.
3. Reload Senpa. The HUD version must be `1.2.1-xplus.3`.

The same `index.html` and `dist/` can be served from your own static repository.
Installation/updates remain manual. Do not enable two copies of the port.

## New mass appearance

Mass digits are **bold white with an opaque black outline**, independent of
player-name tint. This prevents yellow-on-yellow and black-on-dark numbers.
Cell/game colors and player-name colors are not modified by this mass fix.
The atlas is generated once and reused; no per-frame canvas redraw is added.
The existing Show mass / Include my mass visibility preferences still work.
At very distant zoom, any tiny label remains subject to the screen's resolution.

The supplied Senpa code names Ubuntu Bold bitmap fonts. Those exact bitmap
resources were absent, and the screenshot alone cannot authenticate a font.
This version uses **local Ubuntu Bold when installed, otherwise local
Arial/sans-serif**. No font binary is distributed or fetched during play.
It is a Senpa-style bold/outlined treatment, not a claim of exact native glyphs.

## Retained from the immediately previous full-shields userscript

- All decorative shields and the shield inventory are retained.
- XPLUS is capped at **500 ms**, including derived camera/zoom settling times.
  Senpa and Ryuten interpolation are unchanged by this revision.
- No-hover readable chat, no dimmer/blur, and contrast correction for black chat names.
- FFA auxiliary P2 auto-connect after the primary connection is ready, when its
  saved enable/auto-connect settings allow it. Official verification, slot assignment
  and server permission still apply; this is one auxiliary player connection.
- Optional **10 ms feed-request test**, off unless selected. It changes client
  request cadence, not server-approved speed, pellet mass or velocity.
- Current map repair behavior: the wrong loading wallpaper is not used for the
  gameplay map. The exact original map bitmap is still absent; local map import
  remains available. This revision does not introduce a new map image.

## Build and tests

```sh
npm run build
npm test
python tests/mass-labels-browser.py
python tests/browser-smoke.py
node build.mjs --baseline
```

Building needs only Node 18+ and these local source files. Browser tests additionally
need Python Playwright and Chromium (`CHROMIUM_PATH` is supported by the helper).
No dependencies are installed by the build script. Game/account/verification
services and player media remain online dependencies; locally bundled core
presentation does not turn Senpa into an offline game.

Verified for this artifact: **30 unit tests**, **7 targeted browser cases**, startup
smoke, and a byte-identical repeated build. Browser cases cover 18 actual native
compositor draws (six name colors × three profiles), real 2D black/white glyph
pixels with no atlas-crop leakage, chat contrast, and the shield/XPLUS limits.
Network and GPU submission are substituted. No live-server, hardware-FPS,
physical-GPU or complete legacy-regression sign-off is claimed.

`verification/mass-contrast-preview.png` is a Canvas fixture using the actual
new digit atlas over bright/dark examples, not a screenshot of live gameplay.
Historical test sources are archived and clearly marked as NOT_CURRENT; their
old profile/color assumptions are not advertised as passing this build.

## Source and provenance

See `references/RECOVERED_BASELINE.json`, `references/MASS_FONT_SOURCE_NOTES.md`,
`source-layout.json`, `MASS_LABEL_CHANGES.patch`, and `verification/RESULTS.json`.
The build checks immutable snapshot hashes before applying its one mass-tint seam.
Account, feeding, multibox, motion, map and network compiled snapshots/app modules
are unchanged from the last attached full-shields XPLUS500 userscript.

Userscript SHA-256:
`030f6e6ee517bf83cb5515b26a2b94616a4d0b02fe0423dbd4d58d1fff4883f3`
