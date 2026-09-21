/* ============================================================================
   Ryuten bots — panel + slot driver for the hosted Senpa client.

   DESIGN (and why it is this and not "N sockets"):
   The current Senpa client authenticates one socket and receives one or more
   player slots on it (1 on FFA/FFA-like modes, 2 on Dual). Every *new* socket
   is answered with opcode 7 and must reply opcode 14 with a Turnstile token
   minted for action:"game-connect" — i.e. a captcha per connection. So instead
   of opening sockets, this drives the slots the connection already owns, via
   the facade the hosted client publishes as window.SENPA_HOST:

     packets.spawn(tab)              -> op 0   [0, tab]
     packets.cursor(x, y, tab)       -> op 20
     packets.split(tab, levels)      -> op 22  [22, tab, levels]
     packets.feed(tab, hold)         -> op 23
     packets.captcha(type, token)    -> op 14  [14, type, longString8 token]
     world.myCells[tab].size         -> is this slot alive
     packets.activeCenter()          -> the point every other slot should follow
     network.connected, packets.handshakeDone -> may we send at all

   That is why bots are allowed here at all: it is the player's own session,
   doing what a multiboxer does by hand. Extra sockets remain captcha-gated.
   ========================================================================== */
(function () {
  'use strict';
  if (window.RYUTEN_BOTS) return;

  var LS = {
    pos: 'ryuten:bots-pos',
    hidden: 'ryuten:bots-hidden',
    opacity: 'ryuten:bots-opacity',
    players: 'ryuten:bots-players',
    follow: 'ryuten:bots-follow',
    autospawn: 'ryuten:bots-autospawn',
    autofeed: 'ryuten:bots-autofeed'
  };
  var TICK_MS = 100;

  /* ---------------------------------------------------------------- state -- */
  var cfg = {
    players: 2,            // requested players; the server decides how many slots exist
    follow: true,          // non-active slots hold your active cell's position
    autoSpawn: true,       // respawn a slot whose cells are gone
    autoFeed: false,       // hold feed on every controlled slot
    autoSplit: false,      // periodic split on every controlled slot
    splitLevels: 6,        // [22, tab, levels] — the server does the doubling
    splitEveryMs: 400,
    feedEveryMs: 250
  };
  var runtime = {
    running: false, paused: false, sent: {}, lastSplitAt: 0, lastFeedAt: 0,
    lastError: '', ticks: 0, lastPlanAt: 0
  };

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function loadCfg() {
    cfg.players = Math.min(100, Math.max(1, num(store(LS.players), cfg.players)));
    cfg.follow = store(LS.follow) !== '0';
    cfg.autoSpawn = store(LS.autospawn) !== '0';
    cfg.autoFeed = store(LS.autofeed) === '1';
  }

  /* ------------------------------------------------------------- the host -- */
  function port() { return window.SENPA_PORT; }
  function host() { var p = port(); return p && p.host ? p.host : null; }
  function ready() {
    var h = host();
    return !!(h && h.packets && h.world && h.network && h.network.connected && h.packets.handshakeDone);
  }
  function slots() {
    var h = host();
    if (!h || !h.world || !h.world.myPlayerIDs) return [];
    var ids = h.world.myPlayerIDs, out = [];
    var want = Math.min(cfg.players, ids.length);
    for (var tab = 0; tab < want; tab++) {
      var cells = h.world.myCells ? h.world.myCells[tab] : null;
      out.push({ tab: tab, id: ids[tab], alive: !!(cells && cells.size > 0) });
    }
    return out;
  }
  function activeTab() { var h = host(); return h && h.player ? h.player.activeTab : 0; }
  function activeCenter() {
    var h = host();
    try { return h.packets.activeCenter ? h.packets.activeCenter() : null; } catch (e) { return null; }
  }

  /* ------------------------------------------------------- the decision ---
     Pure: given the slots and the clock, what should be sent?
     Kept separate from the sending so it can be tested without a client.   */
  function decide(slotsIn, opts) {
    opts = opts || {};
    var now = opts.now || 0, o = opts.cfg || cfg, out = [];
    var active = opts.activeTab == null ? 0 : opts.activeTab;
    var center = opts.center || null;
    if (!opts.connected || opts.stopped) return out;
    for (var i = 0; i < slotsIn.length; i++) {
      var s = slotsIn[i];
      if (o.autoSpawn && !s.alive) { out.push({ op: 'spawn', tab: s.tab }); continue; }
      if (!s.alive) continue;
      /* The active tab already follows the real mouse — never fight it. */
      if (o.follow && s.tab !== active && center && isFinite(center.x) && isFinite(center.y)) {
        out.push({ op: 'cursor', tab: s.tab, x: center.x | 0, y: center.y | 0 });
      }
      if (o.autoFeed && now - (opts.lastFeedAt || 0) >= o.feedEveryMs) out.push({ op: 'feed', tab: s.tab, hold: true });
      if (o.autoSplit && now - (opts.lastSplitAt || 0) >= o.splitEveryMs) {
        out.push({ op: 'split', tab: s.tab, levels: Math.min(6, Math.max(1, o.splitLevels | 0)) });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------- the send -- */
  function send(plan) {
    var h = host(), count = 0;
    if (!h) return 0;
    for (var i = 0; i < plan.length; i++) {
      var a = plan[i];
      try {
        if (a.op === 'spawn') h.packets.spawn(a.tab);
        else if (a.op === 'cursor') h.packets.cursor(a.x, a.y, a.tab);
        else if (a.op === 'split') h.packets.split(a.tab, a.levels);
        else if (a.op === 'feed') h.packets.feed(a.tab, a.hold);
        runtime.sent[a.op] = (runtime.sent[a.op] || 0) + 1;
        count++;
      } catch (e) { runtime.lastError = a.op + ': ' + (e && e.message || e); }
    }
    return count;
  }
  function tick() {
    runtime.ticks++;
    if (!runtime.running || runtime.paused) return;
    if (!ready()) { render(); return; }
    var plan = decide(slots(), {
      connected: true, stopped: false, cfg: cfg, now: performance.now(),
      activeTab: activeTab(), center: activeCenter(),
      lastSplitAt: runtime.lastSplitAt, lastFeedAt: runtime.lastFeedAt
    });
    if (plan.length) runtime.lastPlanAt = performance.now();
    if (plan.some(function (a) { return a.op === 'split'; })) runtime.lastSplitAt = performance.now();
    if (plan.some(function (a) { return a.op === 'feed'; })) runtime.lastFeedAt = performance.now();
    send(plan);
    render();
  }

  /* ------------------------------------------------------------------ UI -- */
  var CSS = ''
    + '#ryuten-bots{position:fixed;top:64px;right:14px;z-index:2147483000;width:290px;'
    + 'font:12px/1.45 ui-monospace,Consolas,monospace;color:#e8ecf1;background:rgba(14,16,20,.95);'
    + 'border:1px solid #2a3140;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.5)}'
    + '#ryuten-bots header{display:flex;align-items:center;gap:6px;padding:7px 9px;cursor:move;'
    + 'border-bottom:1px solid #2a3140;font-weight:700;letter-spacing:.06em}'
    + '#ryuten-bots header .grow{flex:1}'
    + '#ryuten-bots header small{font-weight:400;color:#9fb0c6;letter-spacing:0}'
    + '#ryuten-bots .row{display:flex;gap:6px;align-items:center;padding:6px 9px;flex-wrap:wrap}'
    + '#ryuten-bots .row+.row{border-top:1px solid #1d222c}'
    + '#ryuten-bots button{flex:1;min-width:58px;background:#1b2130;color:#e8ecf1;border:1px solid #2f3846;'
    + 'border-radius:5px;padding:5px 6px;cursor:pointer;font:inherit}'
    + '#ryuten-bots button:hover{background:#232b3d}#ryuten-bots button.on{background:#1d5c3a;border-color:#2e8b57}'
    + '#ryuten-bots button.warn{background:#5c1d24;border-color:#8b2e39}'
    + '#ryuten-bots input[type=number]{width:52px;background:#11151d;color:#e8ecf1;border:1px solid #2f3846;border-radius:4px;padding:4px}'
    + '#ryuten-bots .counts{padding:5px 9px;border-top:1px solid #1d222c;color:#9fb0c6}'
    + '#ryuten-bots .counts b{color:#e8ecf1}#ryuten-bots .counts .bad{color:#ff9d7b}'
    + '#ryuten-bots #ryuten-bots-log{height:112px;overflow:auto;padding:5px 9px;border-top:1px solid #1d222c;font-size:11px;color:#b9c6d6}'
    + '#ryuten-bots #ryuten-bots-log div{white-space:pre-wrap;word-break:break-word}'
    + '#ryuten-bots #ryuten-bots-log .warn{color:#f0b429}#ryuten-bots #ryuten-bots-log .error{color:#ff7b72}'
    + '#ryuten-bots label{display:flex;align-items:center;gap:4px;cursor:pointer;user-select:none}'
    + '#ryuten-bots input[type=range]{flex:1}';

  var HTML = ''
    + '<header><span>BOTS</span><span class="grow"></span><small id="ryuten-bots-state">idle</small>'
    + '<button id="ryuten-bots-hide" title="hide (F8)" style="flex:0 0 26px;min-width:26px">&#8722;</button></header>'
    + '<div class="row"><label>players <input id="ryuten-bots-players" type="number" min="1" max="100"></label>'
    + '<button id="ryuten-bots-start">Start</button><button id="ryuten-bots-stop" class="warn">Stop</button></div>'
    + '<div class="row"><label><input id="ryuten-bots-follow" type="checkbox"> follow</label>'
    + '<label><input id="ryuten-bots-spawn" type="checkbox"> respawn</label>'
    + '<label><input id="ryuten-bots-feed" type="checkbox"> feed</label>'
    + '<label><input id="ryuten-bots-split" type="checkbox"> split</label></div>'
    + '<div class="row"><button id="ryuten-bots-copy">Copy diagnostics</button></div>'
    + '<div class="row"><label>opacity<input id="ryuten-bots-opacity" type="range" min="35" max="100"></label></div>'
    + '<div class="counts" id="ryuten-bots-counts">-</div><div id="ryuten-bots-log"></div>';

  function $(id) { return document.getElementById(id); }
  function log(msg, level) {
    var box = $('ryuten-bots-log');
    if (box) {
      var d = document.createElement('div');
      d.className = level || '';
      d.textContent = new Date().toLocaleTimeString() + '  ' + msg;
      box.appendChild(d);
      while (box.childNodes.length > 250) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
    }
    if (window.console && console.log) console.log('[BOTS] ' + msg);
  }
  function render() {
    var el = $('ryuten-bots-counts');
    if (!el) return;
    var s = slots(), alive = 0;
    for (var i = 0; i < s.length; i++) if (s[i].alive) alive++;
    var sentTotal = 0;
    for (var k in runtime.sent) sentTotal += runtime.sent[k];
    var h = host();
    el.innerHTML = '<b>' + alive + '</b>/' + s.length + ' alive &middot; want ' + cfg.players
      + ' &middot; handshake <b>' + (h && h.packets && h.packets.handshakeDone ? 'ok' : 'no') + '</b>'
      + ' &middot; sent ' + sentTotal
      + (runtime.lastError ? ' &middot; <span class="bad">' + runtime.lastError.slice(0, 40) + '</span>' : '');
    var st = $('ryuten-bots-state');
    if (st) st.textContent = !runtime.running ? 'idle' : (runtime.paused ? 'paused' : (ready() ? 'running' : 'waiting'));
  }

  function mount() {
    if ($('ryuten-bots')) return true;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    var box = document.createElement('div');
    box.id = 'ryuten-bots';
    box.innerHTML = HTML;
    document.documentElement.appendChild(box);

    loadCfg();
    var pos = null;
    try { pos = JSON.parse(store(LS.pos) || 'null'); } catch (e) {}
    if (pos && typeof pos.left === 'number') { box.style.left = pos.left + 'px'; box.style.top = pos.top + 'px'; box.style.right = 'auto'; }
    var op = num(store(LS.opacity), 100);
    box.style.opacity = String(Math.min(100, Math.max(35, op)) / 100);
    if (store(LS.hidden) === '1') box.style.display = 'none';

    $('ryuten-bots-players').value = String(cfg.players);
    $('ryuten-bots-follow').checked = cfg.follow;
    $('ryuten-bots-spawn').checked = cfg.autoSpawn;
    $('ryuten-bots-feed').checked = cfg.autoFeed;
    $('ryuten-bots-split').checked = cfg.autoSplit;
    $('ryuten-bots-opacity').value = String(Math.min(100, Math.max(35, op)));

    /* drag by the header, clamped to the viewport, position remembered */
    var drag = null;
    box.querySelector('header').addEventListener('mousedown', function (ev) {
      if (ev.target && ev.target.id === 'ryuten-bots-hide') return;
      var r = box.getBoundingClientRect();
      drag = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      ev.preventDefault();
    });
    document.addEventListener('mousemove', function (ev) {
      if (!drag) return;
      var w = window.innerWidth || 1600, hh = window.innerHeight || 900;
      box.style.left = Math.max(0, Math.min(w - 80, ev.clientX - drag.x)) + 'px';
      box.style.top = Math.max(0, Math.min(hh - 40, ev.clientY - drag.y)) + 'px';
      box.style.right = 'auto';
    });
    document.addEventListener('mouseup', function () {
      if (!drag) return;
      drag = null;
      store(LS.pos, JSON.stringify({ left: parseInt(box.style.left, 10) || 0, top: parseInt(box.style.top, 10) || 0 }));
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'F8' || ev.ctrlKey || ev.altKey || ev.metaKey) return;
      if (ev.target && /input|textarea|select/i.test(ev.target.tagName || '')) return;
      ev.preventDefault();
      var hidden = box.style.display === 'none';
      box.style.display = hidden ? '' : 'none';
      store(LS.hidden, hidden ? '0' : '1');
    }, true);

    $('ryuten-bots-hide').onclick = function () { box.style.display = 'none'; store(LS.hidden, '1'); };
    $('ryuten-bots-opacity').oninput = function () {
      box.style.opacity = String(num(this.value, 100) / 100);
      store(LS.opacity, this.value);
    };
    $('ryuten-bots-start').onclick = function () {
      cfg.players = Math.min(100, Math.max(1, num($('ryuten-bots-players').value, 1)));
      store(LS.players, String(cfg.players));
      runtime.running = true; runtime.paused = false; runtime.lastError = '';
      if (!ready()) log('waiting for the client handshake - enter a game first', 'warn');
      else log('driving ' + slots().length + ' owned slot(s) on this connection');
      render();
    };
    $('ryuten-bots-stop').onclick = function () {
      runtime.running = false; runtime.paused = false;
      log('stopped');
      render();
    };
    $('ryuten-bots-follow').onchange = function () { cfg.follow = this.checked; store(LS.follow, this.checked ? '1' : '0'); };
    $('ryuten-bots-spawn').onchange = function () { cfg.autoSpawn = this.checked; store(LS.autospawn, this.checked ? '1' : '0'); };
    $('ryuten-bots-feed').onchange = function () { cfg.autoFeed = this.checked; store(LS.autofeed, this.checked ? '1' : '0'); };
    $('ryuten-bots-split').onchange = function () {
      cfg.autoSplit = this.checked;
      log('auto split ' + (this.checked ? 'on - one split packet per slot every ' + cfg.splitEveryMs + 'ms' : 'off'));
    };
    $('ryuten-bots-copy').onclick = function () {
      var text = JSON.stringify(diagnostics(), null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      log('diagnostics copied');
    };
    log('panel ready - drives the slots this connection already owns (no new socket, no captcha)');
    log('F8 hides/shows, drag the header to move');
    render();
    return true;
  }

  function diagnostics() {
    var h = host();
    return {
      version: (port() && port().version) || '',
      running: runtime.running, paused: runtime.paused, ready: ready(),
      players: cfg.players, follow: cfg.follow, autoSpawn: cfg.autoSpawn, autoFeed: cfg.autoFeed,
      autoSplit: cfg.autoSplit, splitLevels: cfg.splitLevels,
      slots: slots(), activeTab: activeTab(), sent: runtime.sent, ticks: runtime.ticks,
      connected: !!(h && h.network && h.network.connected),
      handshakeDone: !!(h && h.packets && h.packets.handshakeDone),
      nativeTabCount: h && h.world && h.world.myPlayerIDs ? h.world.myPlayerIDs.length : 0,
      lastError: runtime.lastError,
      note: 'bots drive the authenticated connection\'s own slots; extra sockets need a captcha token'
    };
  }

  window.RYUTEN_BOTS = {
    cfg: cfg, runtime: runtime, decide: decide, slots: slots, tick: tick, send: send,
    start: function () { mount(); $('ryuten-bots-start').click(); },
    stop: function () { runtime.running = false; },
    diagnostics: diagnostics,
    _mount: mount
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); });
  else mount();
  var tries = 0, wait = setInterval(function () {
    if (!mount() && ++tries < 40) return;
    clearInterval(wait);
  }, 250);
  setInterval(tick, TICK_MS);
})();
