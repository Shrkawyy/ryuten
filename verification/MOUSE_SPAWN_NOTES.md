# Mouse spawn evidence and limits

Inspected the uploaded ONYX video at multiple timestamps. User confirmed the desired box is the blue in-world position marker, not the GAME BOTS panel.

Compared the previously uploaded ONYX archive's `deo.onyx.beautified.js`:
- lines 4093–4107: the empty FFA connection receives cursor coordinates while multi-spectate is active.
- lines 6480–6494: spectator cursor is a ten-byte packet: opcode 20, mode 1, signed Int32 X, signed Int32 Y. Live-player cursor has an extra native slot byte.
- lines 3541–3550: the original blue rectangle uses the empty connection's server-reported protocol view, with a 500 × 500 world-unit size.

The new marker represents the requested position, not proof that a player has spawned there. It uses a 500-world-unit box with a 10-pixel minimum, follows the visible Ryuten camera, and remains fixed after a right-click.

The current captured Senpa engine uses the same spectator cursor layout. Native incoming opcode 23 updates `camera.spectatePoint`. The patch observes completion of this handler, retains socket identity and a monotonically increasing sequence, and waits for a fresh position within 150 units before sending the native spawn. Missing/stale/foreign-socket acknowledgements cannot unlock spawn. An eight-second timeout cancels the request. Server collision and spawn placement rules are unchanged.

No authentication values or ONYX runtime were copied into the deliverable. Only app modules/build metadata were changed; frozen network/WASM snapshots are unchanged. Reference source SHA-256: 21ac29ef9baa3fce963e3f114ff6075b0be12d432dcd4c1406e17dc93c0d2002.

131 local tests passed. Tests mock network/DOM/image decoding; the native cursor writer itself is extracted from the frozen captured engine and its output bytes checked. Browser GPU drawing, external image-host CORS availability and live gameplay remain unverified.
