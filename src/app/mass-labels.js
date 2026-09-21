
/* Mass-only typography. Native Senpa references Ubuntu/UbuntuStroked bitmap
 * faces; those bitmap resources are absent from the supplied capture. Use local
 * Ubuntu Bold when present, otherwise a local Arial/sans-serif face. No font
 * binary, font-provider request, per-frame canvas redraw, or gameplay mutation.
 */
(() => {
  'use strict';
  const rp = window.RYUTEN_PORT;
  const RECTS = Object.freeze([
    [0, 65, 95, 105], [346, 290, 72, 105], [176, 290, 86, 105],
    [89, 290, 87, 105], [190, 65, 93, 105], [0, 290, 89, 105],
    [283, 65, 93, 105], [262, 290, 84, 105], [95, 65, 95, 105],
    [376, 65, 93, 105]
  ].map(rect => Object.freeze(rect)));
  const FONT_SIZE = 92, STROKE = 12, FILL = '#ffffff', OUTLINE = '#000000';
  let canvas = null, report = null;

  function localUbuntuAvailable(ctx) {
    // FontFaceSet.check() can report true when a missing face is substituted.
    // Compare two unrelated fallbacks at startup instead; never fetch a font.
    const probe = 'mmmmmmmmmmiiiiiii0123456789';
    return ['monospace', 'serif'].every(fallback => {
      ctx.font = `700 64px ${fallback}`;
      const base = ctx.measureText(probe).width;
      ctx.font = `700 64px "Ubuntu", ${fallback}`;
      return Math.abs(ctx.measureText(probe).width - base) > 0.1;
    });
  }

  function createAtlas() {
    if (canvas) return canvas;
    const next = document.createElement('canvas');
    next.width = next.height = 512;
    const ctx = next.getContext('2d');
    if (!ctx) throw new Error('Mass labels require a 2D canvas context');
    const hasUbuntu = localUbuntuAvailable(ctx);
    const family = hasUbuntu ? '"Ubuntu", Arial, sans-serif' : 'Arial, sans-serif';
    ctx.font = `700 ${FONT_SIZE}px ${family}`;
    // All digits share one font size. Never squeeze just the narrow crop for 1.
    let size = FONT_SIZE;
    RECTS.forEach(([, , width], digit) => {
      const measure = ctx.measureText(String(digit));
      const inkWidth = Math.max(measure.width, (measure.actualBoundingBoxLeft || 0) + (measure.actualBoundingBoxRight || 0));
      if (inkWidth > 0) size = Math.min(size, FONT_SIZE * (width - STROKE - 8) / inkWidth);
    });
    size = Math.max(16, Math.floor(size));
    ctx.font = `700 ${size}px ${family}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.lineWidth = STROKE;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = FILL;
    RECTS.forEach(([x, y, width, height], digit) => {
      const text = String(digit), metrics = ctx.measureText(text);
      const left = metrics.actualBoundingBoxLeft || 0;
      const right = metrics.actualBoundingBoxRight || metrics.width;
      const ascent = metrics.actualBoundingBoxAscent || size * 0.75;
      const descent = metrics.actualBoundingBoxDescent || 0;
      const tx = x + (width - (left + right)) / 2 + left;
      const ty = y + (height - (ascent + descent)) / 2 + ascent;
      // Clip is defensive against a platform font with unusual metrics; gutters
      // keep the black border inside this existing Ryuten glyph texture slot.
      ctx.save();ctx.beginPath();ctx.rect(x + 1, y + 1, width - 2, height - 2);ctx.clip();
      ctx.strokeText(text, tx, ty);
      ctx.fillText(text, tx, ty);
      ctx.restore();
    });
    canvas = next;
    report = Object.freeze({
      style: 'senpa-style-bold-outlined', requestedFace: 'Ubuntu Bold', family,
      localUbuntuAvailable: hasUbuntu, exactNativeBitmap: false,
      size, weight: 700, strokePx: STROKE, fill: FILL, outline: OUTLINE,
      inheritedNameTint: false, runtimeFontRequests: 0, atlasBuilds: 1
    });
    if (rp.status?.fonts) rp.status.fonts.numerals = report.style;
    return canvas;
  }
  rp.modules.massLabels = Object.freeze({
    createAtlas,
    snapshot: () => report ? {...report} : {ready: false},
    rects: RECTS
  });
})();
