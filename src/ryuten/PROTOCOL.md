# Ryuten.io/play — Network Protocol Decode
(Reverse-engineered from ryuten.js 27bf00d6 + Albion.wasm 78610153.)

## Transport / crypto
- Game socket (region `lh` = `ws://localhost:8000`, else `wss://<region>.ryuten.io/server-<id>/?<token>`).
- `binaryType="arraybuffer"`.
- **Handshake:** the SERVER must send exactly **64 bytes** on connect. Client copies them into WASM heap and calls `RCrypt.set_keys()` to build an **RC4** key schedule.
- **Outbound (client→server):** every packet is **RC4-encrypted** (`RCrypt.encrypt(buf,len)` on the WASM heap) before `ws.send`.
- **Inbound (server→client):** frames are sent **in the clear** — the client feeds each `message.data` straight to the parser (`Ne._1114(new V(data))`), no decrypt call.
- So: both sides derive RC4 from the same 64-byte random seed; the server must XOR-decrypt the client stream with that keystream, and must NOT encrypt its own responses.

## Frame format
Little-endian. First byte is the opcode, then typed fields via one shared reader:

| reader | type |
|---|---|
| `_2292` | u8 |
| `_7810` | i8 |
| `_1241` | u16 |
| `_4310` | i16 |
| `_9733` | u32 |
| `_5263` | i32 |
| `_6269` | f32 |
| `_6380` | f64 |
| `_3803` | string `[len:u8][len×u8]` |
| `_8719` | string `[len:u16][len×u8]` |
| `_5978` | string `[len:u8][len×u16]` |
| `_4464` | string `[len:u16][len×u16]` |

## Inbound opcodes (server → client)  — enum `oe`
| op | key | handler | notes |
|---|---|---|---|
| 10 | `_2031` | `_4271` | **game-mode intro**: `str gamemode` (`classic`, `solo-tricks`, `ultra-fission`, `super-fission`, `war-training`, `war-sandbox`, `classic-1v1-scrim`, `tournament`, `arena`) + `u16` (set as map/config id). Routes XP/RP/AE/AR reward modes. |
| 20 | `_2610` | `_7406` | ? |
| 21 | `_3180` | `_7421` | ? |
| 22 | `_3228` | `_8491` | ? |
| 23 | `_9316` | `_1747` | ? |
| 24 | `_1368` | `_9412` | (clear) |
| 25 | `_6283` | `_7217` | spawn/death tick |
| 30 | `_4542` | `_1551` | ? |
| 31 | `_9647` | `_1760` | ? |
| 32 | `_8486` | `_5515` | ? |
| 33 | `_6383` | `_5093` | ? |
| 40 | `_3907` | `_9145` | (clear) |
| 41 | `_4207` | `_5333` | **"The server has ended."** |
| 42 | `_8228` | `_9832` | end-of-match results |
| 43 | `_2895` | `_8469` | ? |
| 100 | `_4096` | `_2079` | ? |
| 101 | `_4441` | `_9948` | ? |
| 110 | `_8873` | `_5274` | ? |
| 111 | `_5704` | `_7079` | XP/level set (`u8 hasWin?` + ...) |
| 112 | `_6726` | `_4109` | match-timer verbose |
| 113 | `_5629` | `_6171` | leaderboard feed |
| 114 | `_5887` | `_8602` | **match timer**: u8 state(0=waiting,1=running,2=restarting) + u32 seconds → "Waiting for more players…"/"Starting in MM:SS" |

## Outbound opcodes (client → server)  — enum `re`
| op | key | builder | meaning |
|---|---|---|---|
| 10 | `_3302` | `_3807(t)` | raw u8 action |
| 11 | `_6334` | `_7700(t)` | u8 |
| 21 | `_9012` | `_9067(t)` | set **nick** (u16-len string) |
| 22 | `_6288` | `_3661(...,url)` | set **skin** (imgur code → code idx) |
| 23 | `_7883` | `_9381(t)` | string |
| 24 | `_8229` | — | |
| 30 | `_8280` | — | |
| 31 | `_4818` | — | |
| 32 | `_5897` | — | |
| … | | | |
| 40 | `_6765` | `_5793`/`_7445`/`_7857` | move/spawn/express (`u8 mode` after op) |

Packet writer `m_` builds via `_2080(u8)` / `_6322`/`_9274` (length-prefixed strings); `_1946` yields the ArrayBuffer that `Re._8664` RC4-encrypts and sends.

## Minimal server sequence to get a client into a match screen
1. On WS connect: send **64 random bytes** (RC4 key seed).
2. Send **opcode 10**: `[0x0A][len:u8]` + `"classic"` bytes + `[u16]`.
3. Send **opcode 114** timer: `[0x72][state:u8][secs:u32]` to show "Waiting for more players…".
4. Decrypt client outbound with RC4 seeded by the same 64 bytes (standard KSA/PRGA) to read its login/spawn frames.