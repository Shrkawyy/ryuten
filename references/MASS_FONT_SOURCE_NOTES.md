# Mass-label findings from the supplied code

The current native Senpa snapshot requests `/web/bitmapFonts/ubuntuBold.fnt`
and `/web/bitmapFonts/ubuntuBoldStroked.fnt` and selects `Ubuntu` or
`UbuntuStroked` according to `cellMassStroke`. These files were not in the
provided Senpa archive. No exact native bitmap resource was obtained online.
The new mass style prefers locally installed Ubuntu Bold, otherwise
Arial/sans-serif. It is not certified as a pixel-exact match to the screenshot.

Previous port atlas generation used `ctx.font = '600 92px system-ui'` and
`fillText` without `strokeText`. Its actual mass compositor then ran:

```js
e.children.forEach(s => s.tint = globalThis.RYUTEN_PORT.nameTint(t))
```

Thus a yellow player-name tint also stained the mass digits yellow. This
revision changes that mass-only tint to white and generates bold white digit
interiors with an opaque black outline. Player-name and cell colors remain
unchanged. The existing ten-glyph texture slots and pooling are retained;
no per-frame text-canvas generation, extra render loop or runtime font fetch is
introduced. Visibility settings and lifecycle alpha still apply.

`src/snapshot/` is the exact pre-change compiled payload from the last attached
full-shields XPLUS500 userscript, with SHA-256 checks on each file. Original
captured source files in `src/senpa/` and `src/ryuten/` are included as source
oracles; build-time historical seams are already present in the snapshots.
`src/app/` was recovered losslessly by top-level JavaScript statement boundaries.
`node build.mjs --baseline` proves the recovered pre-change payload can be rebuilt
byte-for-byte, including its bootstrap. This does not claim recovery of the
unavailable historical rc.2 Correction Candidate ZIP.
