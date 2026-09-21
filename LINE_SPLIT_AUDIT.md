# Source review and evidence — fixed-center line input

The prior explanation that the user's effective cursor was being overwritten was a hypothesis, not a finding. Both static review and current native-writer integration show that xplus.4 already intercepts ordinary cursor updates during the split train. The user has NOT reported a successful manual technique; no such success is assumed.

The reproduced code defects were in preparation: following new received centers instead of holding a fixed stop point, and letting repeated polls of unchanged/stale data satisfy the quiet gate. The new gate observes native completed world updates, including delta frames that omit stationary own-cell entries. It cannot know the server's instantaneous position or acknowledge a command.

Endy's `Lines` class from the supplied archive is a direction-lock class, not an automatic quadruple-split implementation. Its source does not establish which automatic centered sequence works in Senpa.

Public cross-check (accessed 2026-09-17):
- https://forum.senpa.io/d/523-linesplits-and-how-do-u-do-them
- https://forum.senpa.io/d/852-linesplit

These are first-person community discussions, not Senpa protocol/physics specifications. They differ on stopping, directional nudges and split counts. They do not establish arbitrary-angle diagonal parity, nor validate our particular default timings. No generic Agar mass threshold is enforced as a universal Senpa rule.

See README.md for precise scope and verification/RESULTS.json for current test receipts. Old xplus.4 receipts are stored under verification/history and are not counted as current tests. The geometric report describes received own-cell positions only, with no automatic success verdict.
