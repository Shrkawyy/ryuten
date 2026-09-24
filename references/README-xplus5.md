# Ryuten–Senpa Fixed-Center Lines Test — 1.2.1-xplus.5

This is an experimental correction of the delivered xplus.4 line controller, not a claim that a live Senpa match has produced the desired line geometry. No successful manual linesplit or video recording is required to run or diagnose it.

## Install and use

Disable the old userscript. Install `dist/RYUTEN-Senpa.user.js` from this archive and reload. Confirm version 1.2.1-xplus.5 in the HUD. This is the FULL-SHIELDS edition; XPLUS is still capped at 500 ms.

Keep `Settings → Controls → Lines → Centered rapid`. Use your existing bound `Line split: selected preset` key. No key is assigned automatically, and R is not recommended or reassigned. Leave minimum center hold at 180 ms (zero intentionally bypasses the stopped-position check for diagnostics). The existing four stages, 25 ms spacing, 8-unit direction nudge, and 240 ms final hold are unchanged. Custom settings are not silently reset.

Start with one sufficiently large merged cell, point the mouse toward the intended direction, then press your bound key once. The macro temporarily submits its own world-space cursor; do not move the physical cursor onto the center or press Space yourself. Exact-center and centered presets now reject already separated fragments. Endy direction locks remain separate and still require manual splitting by design.

A strict center check can cancel rather than split. The status explains whether world updates were missing or the cell failed to settle. That is intentional: it must not turn a failed preparation into an uncontrolled rapid split. Senpa server dead zones, processing cadence, latency and splitting rules have not been measured live; those may still prevent a line.

## Corrections actually implemented

1. The centering target is one fixed received world point captured at activation. Previously the controller followed each new cell position with a new stopping target.
2. The default center gate now needs at least three successfully handled native world frames spanning an 80 ms received quiet window, a recent frame, and positions within two world units of the fixed center. Polling the same object repeatedly is not fresh evidence. This is a client-observed condition, not an acknowledgement of server physics.
3. Slow drift is measured against a fixed quiet-window reference, not only against the previous 20 ms poll. The old code could ignore successive one-unit steps.
4. The existing near-center directional aim stays fixed through the four requests and final hold. Ordinary mouse/camera updates are intercepted at the native cursor writer for that player only. This already existed in xplus.4; the current audit did NOT demonstrate that it was being overwritten.
5. A full socket output queue aborts remaining split requests; late timers, input focus, death, switching and route changes continue to cancel pending work.
6. Each attempt retains a small, bounded report, including its submitted aim and received own-cell positions. The status distinguishes requests submitted from cells observed. Neither is a server acceptance acknowledgement.

The actual split strategy is still center → small direction offset → four separate native requests. This patch does NOT assert that the strategy itself is proved correct for current Senpa modes, nor that every failed attempt was caused by the two reproduced checks.

## No-video diagnosis

For 12 seconds after an attempt, the small LINE status is clickable. Click it to save `senpa-line-attempt-1.2.1-xplus.5.json`. No video, manual successful demonstration or console command is needed. It contains own gameplay positions, settings, slot, timestamps and input/status events—not chat, account data, skins or raw network packets. Keep it private if you do not want to share your own positions.

The report also computes received-position spread along and across the requested direction when at least three cells exist. These are descriptive measurements, not a pass/fail assertion of a linesplit. `lineShapeVerified` and `serverAcceptedCountKnown` remain false. The sample window is capped at 48 frames with at most 128 own cells per recorded frame. Recording ends with the macro; it does not continuously record the game.

## Preserved scope

Only `src/app/line-split.js` is changed under `src/` compared with xplus.4. Senpa, Ryuten and XPLUS interpolation/camera files, shields, outlined mass labels, chat visibility, FFA multibox connection and faster-feed option are unchanged. The captured Senpa/Ryuten JS, assets, WASM, protocol encoders and snapshots are byte-identical. A removable observer runs AFTER the native world handler; it does not parse or rewrite packets.

The existing missing-original-map limitation is unchanged. No new external dependency or gameplay asset fetch is introduced.

## Verification

- 87/87 unit tests passed.
- 21/21 actual-native-writer / input browser cases passed; zero page errors in that suite.
- 7/7 mass/presentation browser cases passed; zero page errors in that suite.
- Startup smoke passed. Its deliberately network-blocked fixture recorded one resource load error; this is retained in the receipt, not hidden.
- Repeated build was byte-identical. Source comparison and exact artifact hash are in `verification/RESULTS.json`.
- Two new regression cases failed against the original xplus.4 controller and passed against this controller: static snapshot silence and slow one-unit drift. See `verification/baseline-reproduced-failures.txt`.

Browser tests use deterministic clocks, actual captured Senpa packet writers/parsers, and an actual auxiliary native iframe for FFA P2 and WindBine P4. World messages are fixtures and GPU submission is substituted. They do not run a physics simulator that invents successful line shapes. Live-server geometry, real GPU performance, and subjective gameplay acceptance remain unverified.

## Build / verify

```bash
npm run build
npm test
npm run test:lines-browser
npm run test:browser
npm run test:smoke
python tools/verify-package.py
```

To reproduce the OLD failure (expected nonzero exit status):

```bash
node --test --test-name-pattern="old static snapshots|slow one-unit packet drift" verification/baseline-regression-probe.mjs
```

Local installer hosting: `python tools/serve.py --open`. The page distributes this userscript; it does not replace Senpa's server or verification.

## Exact installer

Bytes: 5999213

SHA-256: `aa2f12a5f12d659ef73ceb5eba7576f8a69a2b88fc0ceba7249f20e6cbfc6539`
