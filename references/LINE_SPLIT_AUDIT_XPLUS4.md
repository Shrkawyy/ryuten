# Line-input audit — 1.2.1-xplus.4

## Inputs and scope

Base: `Ryuten-Senpa-Full-Shields-Mass-Fix.zip`, SHA-256 `573688c1b02277fc26988297a01b5749efa315292fe819fc8d1a8258b488104f`.

Reference: `endyv32_release (1).zip`, SHA-256 `90eb38290dd0918d18a6d78dbf89293b48e819a5d58723b46c4f74498704a79a`. Read-only static inspection; the other-game runtime and its network/auth/shield code were not executed or imported. Relevant file: `m.js`, SHA-256 `df6a898102e3448b4489d24b87a32585a8431416c194f1cafccce2fe8172b77b`, Lines class approximately lines 929–1092.

The previous full-shields mass-fix installer was 5,970,894 bytes, SHA-256 `030f6e6ee517bf83cb5515b26a2b94616a4d0b02fe0423dbd4d58d1fff4883f3`.

## Reference behavior versus adaptation

The Endy `Lines` class registers eight direction bindings, stores separate state for its two tabs, converts an extremely distant screen coordinate through its camera and second-tab world offset, then calls `PacketSender.mouseToTab`. It suppresses subsequent ordinary cursor updates for a locked tab. **There is no automatic split call in that class.** Other normal split keys remain separate. Same-direction presses release the lock; its original different-direction key is ignored while locked.

The Ryuten–Senpa adaptation preserves the useful direction-lock concept, with separate state per Senpa logical player, but deliberately uses a bounded ten-million-world-unit direction vector through **Senpa's own** cursor writer. It does not copy Endy's screen-space constants, second-tab map offset, packet encoder, handshake or input classes. Its different direction key replaces the current lock, rather than requiring release first. A visible badge and cancel-all key make persistent state explicit. These are adaptations, not byte-exact Endy behavior claims.

The added Centered rapid, Exact center rapid, Native burst and Endy rapid modes provide separate experiments. The last combines a distant lock with an automatic train; it is not misattributed to the reference archive.

## Verified prior mismatch

The old macro defaulted to six stages and one packet; its center came from interpolated cell `x/y`. Its delayed callback used a fixed 100 ms wait and 45 ms target pin. The native source uses `endX/endY` for received positions, while animation modifies `x/y`. Native Split16 requests count four; Split64 count six. Using six by default was incompatible with the requested quadruple split.

Now a received-position center hold, four separate requests and a finite post-split hold are independent controls. A counted native request is available as a separate preset for comparing how the game handles counted versus separate inputs. The adapter reads but never rewrites cell positions, velocities, radii, mass or collision state.

## Direction and multibox correctness

Pointer direction is inferred using the visible active-cell mean and the displayed camera/zoom, including XPLUS visual delay. That unit direction is applied at the newest received center. With near-center aiming, integer coordinates limit angular precision; use a larger offset to reduce quantization at the expense of being farther from the center.

The same shared cursor cannot point at every separated fragment's exact center simultaneously. Likewise, exact zero offset does not encode a vertical or diagonal vector at all. The code therefore does not assert that "exact center always means horizontal" or that the result will always be a line.

Routes are captured as logical player, native connection, native slot, socket object, generation and assigned player ID. The captured native packet encoders remain unchanged. FFA P2 must use auxiliary slot zero; WindBine P4 must use auxiliary slot one. A route or focus change cancels an automatic train. User-selected direction locks intentionally persist per player through switching, then release on chat/menu/blur/visibility loss/death/disconnect or the cancel key.

## Failure handling and diagnostics

Centering follows updates and times out rather than splitting a continuously moving target. Received-position quietness is only a client observation; omitted stationary delta updates and latency mean it is not proof of the server's instantaneous state. Timers are bounded and late trains cancel. Cursor or split-writer exceptions are surfaced without leaving a queued operation. Released auxiliary hooks are restored so old iframe realms are not retained by idle locks.

There is no high-frequency permanent line-input interval. Existing mouse scheduling is reused; only finite macros schedule timeouts. Small received-position arrays are allocated during centering, not on every rendered cell. The recent-event trace is capped at 48 entries and contains own aim/status only.

## Online cross-check, accessed 2026-09-17

Senpa's forum contains first-person community advice about holding the center until stopped, then moving slightly in the desired direction. Another thread discusses centering and native 64-piece splitting. These are community reports, not a protocol specification or a guarantee across modes.

- https://forum.senpa.io/d/523-linesplits-and-how-do-u-do-them
- https://forum.senpa.io/d/852-linesplit
- The user-supplied Fandom page returned HTTP 402 to the research fetch and was not used as verified evidence.

The generic 3,000-mass suggestion and "horizontal at zero, vertical with a nudge" claims are not enforced as Senpa-wide rules. No unauthenticated gameplay session, server physics or hidden client implementation was reproduced here.

## Tests and remaining live gate

The current receipt names the installer SHA-256 `7605dfd8573ad3fbf8aab50902ee18e49a54aad858cc2ae21ce1759a777d3d58`. Unit tests cover scheduling, default four-stage semantics, per-player routing, diagonal projection/high DPI, count limits, finite timing, canceled routes, locks, binding slots, preserved source state and send failures. Browser tests use actual native encoders and actual native auxiliary iframe state, not hand-authored outgoing packet substitutes.

A fixture issue discovered during auxiliary tests was fixed in the **test**: native parsers check `instanceof ArrayBuffer` within their own iframe realm, so a top-page ArrayBuffer was correctly ignored by the auxiliary parser. Auxiliary fixtures now construct buffers in that realm and assert the handshake, cell ownership and player switch before evaluating packet routing. No production parser was changed to conceal this fixture failure.

The settings screenshot advances native transition/DOM flush code; all five preset buttons and the line key editor are exercised. Mass regression uses real Canvas 2D glyph pixels and captured compositor logic. GPU submission and network transport remain substituted. There is no server simulation manufacturing a straight line, and no claim of live acceptance, frame timing, native account compatibility under real verification, physical GPU performance or exact line geometry.

For live comparison, record one attempt per preset from a single large cell, identical mode and approximate mass, with the direction and status badge visible. Pair that clip with `SENPA_PORT.child.lineSplit.snapshot()`. Distinguish requests sent, requests accepted, and visual geometry—especially under delayed XPLUS rendering.
