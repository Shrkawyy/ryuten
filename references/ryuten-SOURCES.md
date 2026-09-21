# Sources retained for this implementation

## Current implementation evidence

`3ryuten.zip` was supplied and its actual JavaScript/CSS/WASM/assets were inspected. The native capture is 0.18.7, with PixiJS 6.5.10; Albion renderer functions are now confirmed from the uploaded bytes and instantiated glue. Source files and their final packaged hashes are listed in `dist/build-manifest.json`. `ryuten-capture-manifest.json` preserves original capture filenames/hashes. The original ZIP remains unchanged in the conversation.

This package excludes font files, operational secrets and captured operational logs. Original source snippets/notes below remain historical evidence, not current verification claims. In particular, old statements that Albion is unavailable or only crypto are superseded by the actual supplied capture and WASM reports.

Video links are all retained. No video timing calibration was performed during this implementation.

---

# Source registry

No source is removed because it is stale, inaccessible, contradictory or not yet inspected. Status is separate from preservation. Original briefs are copied byte-for-byte in `original_briefs/`. Full archives remain in the conversation, unchanged.

## Target videos

**Status for every video below: NOT independently decoded or measured during this audit.** No playback multiplier, current availability, frame rate, packet rate or target renderer technology is claimed from them. Prior handoff observations remain document-derived.

- **V01** `https://streamable.com/zw9ief` — Original target video; earlier handoff describes high-latency but smooth presentation.
- **V02** `https://streamable.com/xry6ju` — Original target video; retain even if a later retrieval fails.
- **V03** `https://streamable.com/zkz6xu` — Original target video; handoff describes lightweight owned-cell ring.
- **V04** `https://streamable.com/v4bbw7` — Original target video; handoff describes shields on split fragments.
- **V05** `https://www.youtube.com/watch?v=CZh5TWRE-Eo&t=7s` — Original target URL. Handoff says its dashboard preview is NOT target authority.
- **V06** `https://www.youtube.com/watch?v=_-czGkfzWcA` — Handoff points to 6:14, 6:19, 11:25 and 18:05; not checked in this audit.
- **V07** `https://www.youtube.com/watch?v=B7URM2xmI6U` — User flags possible speed-up in this group.
- **V08** `https://www.youtube.com/watch?v=lawpri8p7PY` — User flags possible speed-up in this group.
- **V09** `https://www.youtube.com/watch?v=2mLBlsxVMSU` — User flags possible speed-up in this group.
- **V10** `https://www.youtube.com/watch?v=XKu1NW4Pf8E` — Additional handoff reference; small-fragment shield behavior is an unverified handoff observation.
- **V11** `https://www.youtube.com/watch?v=uZ-KSISG-_s` — Additional handoff reference.
- **V12** `https://www.youtube.com/watch?v=1TRAZJ0j17A` — Additional handoff reference; independent skin/shield state is a handoff observation.
- **V13** `https://www.youtube.com/watch?v=a6sYncoRf1k` — Handoff points to approximately 31.22 s for unit-atomic switching.
- **V14** `https://www.youtube.com/watch?v=DLp3oEhBLKA` — Handoff says motion-only reference, especially 3:57, NOT authority for shields/UI/controls.
- **V15** `https://www.youtube.com/watch?v=CZh5TWRE-Eo&t=1s` — Same video as V05; preserve alternate timestamp exactly.

## Public sources

- **W01** `https://ryuten.io/play/` — Parsed page read in this audit; not a runtime capture or source-bundle acquisition.
- **W02** `https://3rb.io/` — Host/protocol reference; no live gameplay test performed.
- **W03** `https://pixijs.com/` — Renderer library reference retained; no audited Ryuten Pixi version established.
- **W04** `https://api.pixijs.io/` — API reference retained; version-specific guidance must wait for version selection.
- **W05** `https://ryuten.io/news/game-update/0-9-0/` — Historical official reference; not proof of the current implementation constants.
- **W06** `https://ryuten.io/news/game-update/0-10-0/` — Historical official reference; not proof of the current implementation constants.
- **W07** `https://ryuten.io/news/game-update/0-11-0/` — Historical official reference; not proof of the current implementation constants.
- **W08** `https://ryuten.io/news/game-update/0-14-0/` — Historical official reference; not proof of the current implementation constants.
- **W09** `https://ryuten.io/news/game-update/0-15-0/` — Historical official reference; not proof of the current implementation constants.
- **W10** `https://ryuten.io/news/game-update/0-16-0/` — Historical official reference; not proof of the current implementation constants.
- **W11** `https://ryuten.io/support/` — Rules reference retained; distinguish documentation from source-level constants.
- **W12** `https://ryuten.io/news/` — Official news index retained.

## Uploaded artifacts

- `RYUTEN V3.2(1).zip` — Audited current implementation, internally 3.3.2; 6830913 bytes; SHA-256 `c0392da5b520b7d18c15d66ff3c86b7562194f1666ea41ea464dee0878aba4e1`.
- `RYUTEN V3.2.zip` — Earlier archive, compared but not overwritten; 6830890 bytes; SHA-256 `0b8e77b2601567a30056e23c5568e80e455a9c09b1b97e1b446026b1d533f336`.
- `Pasted markdown(20260905-015644).md` — Uploaded task brief; not a source audit; 68217 bytes; SHA-256 `1b386c045ef5798976551566afc29b7b0ae592f145306fecdf41ee7d55984497`.
- `Pasted text(20260905-015355).txt` — Architecture handoff; production claims need raw-source verification; 14943 bytes; SHA-256 `53b000a0eadb8bd9f2e6fa63e890f303fa7f6018f436355ffc83cb29684ec12d`.
- `ASTRA_RYUTEN_V4_MASTER_PROMPT.md` — Earlier generated prompt, retained in conversation; 46695 bytes; SHA-256 `40d7e3d7fe64042776e00aa3bdb11d99330c8c77ea883062a0ca33530880a71d`.
- `ASTRA_RYUTEN_V4_MASTER_PROMPT_V2_DEEP_SOURCE.md` — Earlier generated expanded prompt, retained in conversation; 67053 bytes; SHA-256 `25732e1f0869bf4c8e86e22bd2c2bc9655f43b3bfd75538d9913dc18a9c9e53d`.
- `bef8e7bd-3e53-4311-a9fe-82ff061628ea.png` — Target menu screenshot; 457671 bytes; SHA-256 `2bb1dfdaeef3e40cf5fa644ffe0064b0937639c41df640ca614dd122f27ccc0f`.
- `4f3b3619-0b97-45d7-8977-fc2111d08514.png` — Target gameplay screenshot; 568790 bytes; SHA-256 `76442dd67b89866bf2b9e1c90da05c0ee48a20a64f036b3b7774345563fdfaf7`.
- `455d1552-7ee2-4113-8578-ed2d9f6f7933.png` — Target inventory screenshot; 359904 bytes; SHA-256 `cd6940d418a78c5f3a016e28efb6a5802aa7f05d6d4247491cbbcd10594896e5`.
- `744dbbc2-ffcf-415d-b81e-c151f1300218.png` — Earlier 3rb loader console screenshot; 325548 bytes; SHA-256 `8ae021e7cd035994c06287a327e15a35246ee3d95d1a5a4953c4c792f3a03cdb`.
- `51b214af-9663-4ce9-a786-e4e57610d961.png` — Earlier userscript permission screenshot; 98152 bytes; SHA-256 `cec2f828cc4282e96b809e3bb07a9243b1f8a911b99d62538b886b4fd5414292`.

## Referenced source folders not located as uploaded executable source

- `C:\Users\pc\Downloads\3ryuten\ARCHITECTURE.md`
- `C:\Users\pc\Downloads\3ryuten\PROTOCOL.md`
- `C:\Users\pc\Downloads\3ryuten\CAPTURE.md`
- `C:\Users\pc\.codex\visualizations\2026\08\24\01a03389-0c30-7f01-9f2b-7ada4cc1c775\ryuten-live-0.18.7`

The first three locations are named in the user's architecture handoff. The capture folder is named in the ZIP's forensic-context document. These paths do not grant access to the user's PC. Library searches located the handoff/prompt but did not locate the separate production-source folder.

## Earlier loader sources, retained as historical context

- `https://raw.githubusercontent.com/thedarkness042/3rbup/main/index.html`
- `https://raw.githubusercontent.com/thedarkness042/3rbup/main/shield.js`
- `https://raw.githubusercontent.com/thedarkness042/3rbup/main/v.js`
- `https://raw.githubusercontent.com/thedarkness042/3rbup/main/m.js`

These are not assumed byte-identical to the uploaded archive or Ryuten production. No new fetch result is claimed for them.

## Handling limits

Preserve original files privately. Do not publish the ZIP unchanged: it contains credential-like proxy entries and operational logs. This evidence package deliberately excludes those file contents, compiled bridge caches, generated production userscript and third-party font binaries. The manifest preserves file identity without reproducing credentials.


## rc.3 implementation evidence

Current Drag code was inspected at commit `77c8e6ad8c98f316b4ab69d3d13f2f3ee11b3f7c`. See `DRAG_SOURCES_RC3.json` for file/blob hashes and precise line URLs. The actual captured Ryuten source remains in `src/reference/`; its current hash and motion mapping are recorded in `docs/MOTION_PROFILES.md`. Original target videos, screenshots and handoff documents above are retained; historical handoff claims are not substituted for source evidence.
