

/* Readable chat is a presentation policy, not a change to player/cell colours.
 * Work is bounded to message insertion; no polling, per-frame colour parsing,
 * mutation observer or backdrop blur is needed.
 */
(() => {
  'use strict';
  const rp = window.RYUTEN_PORT;
  const PANEL = [39, 49, 59]; // Conservative upper bound for the CSS panel over white.
  const MIN_CONTRAST = 4.5;
  const linear = byte => { const n = byte / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
  const luminance = rgb => .2126 * linear(rgb[0]) + .7152 * linear(rgb[1]) + .0722 * linear(rgb[2]);
  const backgroundLuminance = luminance(PANEL);
  function parse(value) {
    if (typeof value !== 'string') return [255, 255, 255];
    let hex = value.trim();
    if (/^#[\da-f]{3}$/i.test(hex)) hex = '#' + [...hex.slice(1)].map(c => c + c).join('');
    if (!/^#[\da-f]{6}$/i.test(hex)) return [255, 255, 255];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  }
  const contrast = rgb => (luminance(rgb) + .05) / (backgroundLuminance + .05);
  const encode = rgb => '#' + rgb.map(n => n.toString(16).padStart(2, '0')).join('');
  function nameColor(value) {
    const rgb = parse(value);
    if (contrast(rgb) >= MIN_CONTRAST) return encode(rgb);
    // Preserve hue as much as possible by mixing toward white, rather than
    // changing all players to one colour. Black becomes readable neutral grey.
    const mix = amount => rgb.map(n => Math.ceil(n + (255 - n) * amount));
    let low = 0, high = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (low + high) / 2;
      if (contrast(mix(mid)) >= MIN_CONTRAST) high = mid; else low = mid;
    }
    return encode(mix(high));
  }
  rp.chatNameColor = nameColor;
  rp.modules.chatAppearance = {
    nameColor, minContrast: MIN_CONTRAST,
    contrastAgainstPanel: value => contrast(parse(value)),
  };
  rp.modules.prepareReadableChat = () => {
    // This must happen BEFORE the captured chat settings initialise. Keep the
    // other settings and retain the user's former dim preference for rollback.
    let saved = {};
    try { const value = JSON.parse(rp.nativeStorage.getItem('chatbox-settings') || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) saved = value; } catch {}
    if (saved.AUTO_DIM_CHATROOM === true && rp.setting('chat-dim-before-readable', null) === null)
      rp.saveSetting('chat-dim-before-readable', true);
    rp.nativeStorage.setItem('chatbox-settings', JSON.stringify({ ...saved, AUTO_DIM_CHATROOM: false }));
  };
  rp.modules.installReadableChat = r => {
    // Patch the narrow opacity writer, not the chat update loop. Hiding the
    // whole chat HUD, channel switching, timestamps and input retain ownership.
    const opacity = r.b_._3676.bind(r.b_);
    r.b_._3676 = () => opacity(1);
    r.k_._1319.AUTO_DIM_CHATROOM = false;
    r.k_._9300();
    r.B_._8700 = false;
    r.b_._3676(1);
    const toggle = document.getElementById('chbxsm-dim-when-inactive');
    if (toggle) {
      toggle.classList.remove('iconfont-checkbox');
      toggle.classList.add('iconfont-checkbox-outline');
      toggle.setAttribute('aria-disabled', 'true');
      toggle.title = 'Disabled in this build: chat stays readable without hovering.';
      toggle.onclick = event => { event.preventDefault(); r.k_._1319.AUTO_DIM_CHATROOM = false; r.k_._9300(); return false; };
    }
  };
})();