/* Lines input adapter, not a physics patch. Native Senpa cursor/split writers
 * remain the only packet encoders. Endy reference: eight fixed aim locks (not
 * automatic splits). This adapter adds separate bounded rapid-split presets.
 */
(() => {
  'use strict';
  const rp = window.RYUTEN_PORT;
  const MODES = ['Centered rapid', 'Exact center rapid', 'Native burst', 'Endy rapid', 'Endy lock'];
  const DIRECTIONS = Object.freeze({
    Up: [0, -1], Down: [0, 1], Left: [-1, 0], Right: [1, 0],
    TopLeft: [-Math.SQRT1_2, -Math.SQRT1_2], TopRight: [Math.SQRT1_2, -Math.SQRT1_2],
    BottomLeft: [-Math.SQRT1_2, Math.SQRT1_2], BottomRight: [Math.SQRT1_2, Math.SQRT1_2],
  });
  const LABELS = {Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right',
    TopLeft: 'Up-left', TopRight: 'Up-right', BottomLeft: 'Down-left', BottomRight: 'Down-right'};
  const BINDINGS = [
    ['HK_LINE_SPLIT', 'line-split-key', 'Line split: selected preset', null],
    ['HK_LINE_LOCK_MOUSE', 'line-lock-mouse-key', 'Line lock: mouse direction (toggle)', 'Mouse'],
    ...Object.keys(DIRECTIONS).map(d => ['HK_LINE_LOCK_' + d.toUpperCase(),
      'line-lock-' + d.toLowerCase() + '-key', 'Line lock: ' + LABELS[d] + ' (Endy)', d]),
    ['HK_LINE_CANCEL', 'line-cancel-key', 'Cancel line split / release all line locks', 'Cancel'],
  ];
  const LIMIT = 1_000_000_000; // Safely within Senpa's signed Int32 cursor fields.
  const nowDefault = () => (window.parent?.performance || performance).now();
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const number = (v, fallback, min, max) => {
    const n = Number(v); return Number.isFinite(n) ? clamp(n, min, max) : fallback;
  };
  const normalizeKey = k => k === 'ESCAPE' ? 'ESC' : k === 'TILDE' ? 'BACKQUOTE' : k;
  function config(options = {}) {
    return {
      mode: MODES.includes(options.mode) ? options.mode : MODES[0],
      direction: options.direction || 'Mouse',
      splitCount: Math.round(number(options.splitCount, 4, 1, 6)),
      gapMs: Math.round(number(options.gapMs, 25, 0, 120)),
      settleMs: Math.round(number(options.settleMs, 180, 0, 600)),
      offset: Math.round(number(options.offset, 8, 2, 64)),
      holdMs: Math.round(number(options.holdMs, 240, 100, 800)),
    };
  }
  function center(host, native) {
    const cells = host?.world?.myCells?.[native];
    if (!cells) return null;
    let x = 0, y = 0, count = 0, mass = 0;
    const samples = [];
    for (const [id, cell] of cells) {
      if (cell.removed) continue;
      // x/y are the native ANIMATED pose. endX/endY are the latest received pose.
      const cx = cell.endX, cy = cell.endY, radius = cell.endRadius;
      if (!Number.isFinite(cx) || !Number.isFinite(cy) || Math.abs(cx) > LIMIT || Math.abs(cy) > LIMIT) return null;
      x += cx; y += cy; count++; mass += Number.isFinite(radius) ? radius * radius / 100 : 0;
      samples.push({id, x: cx, y: cy, at: cell.updateTime});
    }
    return count ? {x: x / count, y: y / count, count, mass, samples} : null;
  }
  function aimPoint(c, direction, distance) {
    const x = Math.round(c.x), y = Math.round(c.y);
    // Shorten the vector as a whole at representable limits; do not independently
    // clamp components and thereby silently rotate a diagonal.
    let d = distance;
    for (const [p, v] of [[x, direction.x], [y, direction.y]]) {
      if (v > 0) d = Math.min(d, (LIMIT - p) / v);
      else if (v < 0) d = Math.min(d, (-LIMIT - p) / v);
    }
    return {x: Math.round(x + direction.x * Math.max(0, d)),
      y: Math.round(y + direction.y * Math.max(0, d))};
  }
  // Measured received-position spread, NOT a server-physics success verdict.
  // No names, account fields or raw packets are retained in the attempt report.
  function geometry(c, vector) {
    if (!c || !vector || c.count < 3) return {cellCount: c?.count || 0, enoughPoints: false};
    let alongMin = Infinity, alongMax = -Infinity, sideways = 0, xx = 0, xy = 0, yy = 0;
    for (const p of c.samples) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const a = dx * vector.x + dy * vector.y, b = -dx * vector.y + dy * vector.x;
      alongMin = Math.min(alongMin, a); alongMax = Math.max(alongMax, a); sideways += b * b;
      xx += dx * dx; xy += dx * dy; yy += dy * dy;
    }
    const span = alongMax - alongMin, crossRms = Math.sqrt(sideways / c.count);
    const trace = xx + yy, disc = Math.hypot(xx - yy, 2 * xy);
    return {cellCount: c.count, enoughPoints: span > 0,
      alongSpan: span, crossAxisRms: crossRms,
      crossAxisRatio: span > 0 ? crossRms / span : null,
      principalWidthRatio: trace + disc > 0 ? Math.sqrt(Math.max(0, (trace - disc) / (trace + disc))) : null};
  }
  function moved(a, b) {
    if (!a || a.count !== b.count) return true;
    const previous = new Map(a.samples.map(p => [p.id, p]));
    return b.samples.some(p => {
      const old = previous.get(p.id);
      return !old || Math.hypot(p.x - old.x, p.y - old.y) > 2;
    });
  }
  class LineInputController {
    constructor(h, r, options = {}) {
      this.h = h; this.r = r; this.manager = rp.parentPort?.multibox;
      this.now = options.now || nowDefault;
      this.setTimer = options.setTimeout || window.setTimeout.bind(window);
      this.clearTimer = options.clearTimeout || window.clearTimeout.bind(window);
      this.timer = null; this.operation = null; this.locks = new Map(); this.hooks = new Map();
      this.lastResult = null; this.trace = []; this.emitting = false; this.disposed = false;
      this.sequence = 0; this.statusUntil = 0;
      this.originalSend = h.actions.sendMouse;
      this.sendWrapper = (...args) => this.sendMouse(...args);
      h.actions.sendMouse = this.sendWrapper;
      this.onBlur = () => this.cancel('blur');
      this.onHidden = () => {if (document.hidden) this.cancel('hidden');};
      this.onFocus = event => {if (this.editable(event.target)) this.cancel('text-focus');};
      window.addEventListener('blur', this.onBlur);
      document.addEventListener('visibilitychange', this.onHidden);
      document.addEventListener('focusin', this.onFocus, true);
      this.ensureHost(h);
    }
    editable(target) { return !!(target?.isContentEditable || target?.closest?.('input,textarea,select,[contenteditable="true"]')); }
    setting(key, fallback) { return this.r.Q?.[key]?._5997?.() ?? fallback; }
    options(overrides) {
      return config({mode: this.setting('LINE_SPLIT_MODE', MODES[0]),
        splitCount: this.setting('LINE_SPLIT_COUNT', 4), gapMs: this.setting('LINE_SPLIT_GAP_MS', 25),
        settleMs: this.setting('LINE_SPLIT_SETTLE_MS', 180), offset: this.setting('LINE_SPLIT_OFFSET', 8),
        holdMs: this.setting('LINE_SPLIT_HOLD_MS', 240), ...overrides});
    }
    route(slot) {
      const m = this.manager, logical = slot ?? (m?.multi ? m.active : this.h.player.activeTab);
      return {slot: logical, host: m?.multi ? m.host(logical) : this.h,
        native: m?.multi ? m.nativeSlot(logical) : logical};
    }
    captureRoute() {
      const route = this.route(), host = route.host;
      return {...route, socket: host?.network.ws, generation: this.manager?.generation,
        playerId: host?.world.myPlayerIDs?.[route.native]};
    }
    gameplay() {
      return !this.disposed && rp.parentPort?.mode !== 'native' && !this.h.network.isReplay &&
        !this.h.menu.isOpen && !this.h.menu.isChatFocused && !this.r.rs._4020 &&
        !rp.account?.state?.open && !rp.multiboxDialog?.open && !document.hidden &&
        !this.editable(document.activeElement);
    }
    valid(route, active = false) {
      if (!route || !this.gameplay()) return false;
      const current = this.route(route.slot), host = route.host;
      return current.host === host && current.native === route.native &&
        (!active || this.route().slot === route.slot) &&
        route.generation === this.manager?.generation && host?.network.connected &&
        !host.network.isReplay && host.network.ws === route.socket && host.packets.handshakeDone &&
        host.world.myPlayerIDs?.[route.native] === route.playerId && !!center(host, route.native);
    }
    event(type, detail = {}) {
      this.trace.push({at: Math.round(this.now()), type, ...detail});
      if (this.trace.length > 48) this.trace.shift();
    }
    result(value, notify = false) {
      this.lastResult = value; this.event('result', value); this.updateStatus();
      if (notify) rp.parentPort?.notify?.('Lines: ' + (value.reason || value.status));
    }
    reject(reason) { this.result({status: 'rejected', reason}, true); return false; }
    updateStatus() {
      if (!document.createElement || !document.body) return;
      if (!this.badge) {
        this.badge = document.createElement('div'); this.badge.id = 'senpa-line-input-status';
        this.badge.setAttribute('aria-live', 'polite');
        this.badge.style.cssText = 'position:fixed;bottom:64px;left:50%;transform:translateX(-50%);z-index:9000;pointer-events:auto;padding:5px 10px;border:1px solid #64748b;border-radius:5px;background:#111827e8;color:#fff;font:600 13px Arial,sans-serif;cursor:pointer;';
        this.badge.title = 'Click to save the last line-attempt report (own positions only).';
        for (const kind of ['mousedown', 'mouseup']) this.badge.addEventListener(kind, event => event.stopPropagation());
        this.badge.addEventListener('click', event => {event.stopPropagation(); this.downloadLastAttempt();});
        document.body.appendChild(this.badge);
      }
      const o = this.operation, active = this.route().slot, lock = this.locks.get(active);
      this.badge.hidden = !o && !this.locks.size && this.now() >= this.statusUntil;
      this.badge.textContent = o ? `LINE P${o.slot + 1} · ${o.phase} · ${o.sent}/${o.config.splitCount}` :
        lock ? `LINE LOCK P${active + 1} · ${lock.label} · press same line key to release` :
        this.locks.size ? `LINE LOCK · ${[...this.locks.keys()].map(s => 'P' + (s + 1)).join(', ')} · inactive` :
        this.lastResult?.status === 'sent' ? `LINE · ${this.lastResult.stagesSent} split stages sent · ${this.lastResult.receivedShape?.cellCount ?? '?'} cells observed · click for report` :
        `LINE · ${this.lastResult?.reason || this.lastResult?.status || 'ready'} · click for report`;
    }
    direction(name, route) {
      if (DIRECTIONS[name]) { const [x, y] = DIRECTIONS[name]; return {x, y, label: LABELS[name]}; }
      if (name !== 'Mouse') return null;
      const camera = rp.motion?.inputCamera?.() || this.h.camera, canvas = this.h.renderer.canvas;
      const width = window.parent?.innerWidth || window.innerWidth, scale = canvas.width / Math.max(1, width);
      const zoom = camera.zoom * scale;
      if (!Number.isFinite(zoom) || zoom <= 0) return null;
      const mx = camera.x + (this.h.input.mouse.x * scale - canvas.width / 2) / zoom;
      const my = camera.y + (this.h.input.mouse.y * scale - canvas.height / 2) / zoom;
      let x = 0, y = 0, count = 0;
      for (const cell of route.host.world.myCells[route.native].values()) {
        if (cell.removed) continue;
        // Infer intended mouse angle from what the player actually sees, then
        // transplant that angle onto the latest RECEIVED center for packet aim.
        const pose = rp.motion?.sample?.(cell, rp.motion.frameNow) || cell;
        if (!Number.isFinite(pose.x) || !Number.isFinite(pose.y)) return null;
        x += pose.x; y += pose.y; count++;
      }
      if (!count) return null;
      const dx = mx - x / count, dy = my - y / count, length = Math.hypot(dx, dy);
      if (!Number.isFinite(length)) return null;
      if (length * camera.zoom < .5) return {x: 1, y: 0, label: 'Mouse (center → right)', fallback: true};
      return {x: dx / length, y: dy / length, label: 'Mouse direction'};
    }
    ensureHost(host) {
      if (!host || this.hooks.has(host)) return;
      const original = host.packets.cursor, split = host.packets.split, self = this;
      const cursor = function(x, y, slot, ...rest) {
        const native = slot ?? host.player.activeTab;
        const held = self.heldFor(host, native);
        if (held && self.valid(held, held === self.operation)) {
          // A center lock is a fixed WORLD point, not a target chasing the cell.
          // The same point survives camera changes, fresh packets and mouse moves.
          x = held.point.x; y = held.point.y;
        }
        return original.call(this, x, y, slot, ...rest);
      };
      const splitWrapper = function(slot, count, ...rest) {
        // An ordinary manual split cancels a pending automatic train, then uses
        // ordinary aim again. Direction-only locks intentionally allow splitting.
        if (!self.emitting && self.operation?.host === host &&
            (slot ?? host.player.activeTab) === self.operation.native) {
          self.cancel('manual-split'); self.originalSend.call(self.h.actions);
        }
        return split.call(this, slot, count, ...rest);
      };
      host.packets.cursor = cursor; host.packets.split = splitWrapper;
      // Observe completed native world handlers. Do not parse or mutate any
      // packet. Successful delta frames can establish freshness even if an idle
      // own cell has no changed entry. Malformed handler calls do not count.
      const handlers = host.parser?.handlers, world = handlers?.[20];
      const worldWrapper = typeof world === 'function' ? function(...args) {
        const result = world.apply(this, args);
        try {self.observeWorld(host);} catch { /* A diagnostic cannot break parsing. */ }
        return result;
      } : null;
      if (worldWrapper) handlers[20] = worldWrapper;
      this.hooks.set(host, {original, cursor, split, splitWrapper, handlers, world, worldWrapper});
    }
    restoreIdleHosts() {
      for (const [host, hook] of this.hooks) {
        if (host === this.h || this.operation?.host === host || [...this.locks.values()].some(l => l.host === host)) continue;
        if (host.packets.cursor === hook.cursor) host.packets.cursor = hook.original;
        if (host.packets.split === hook.splitWrapper) host.packets.split = hook.split;
        if (hook.worldWrapper && hook.handlers?.[20] === hook.worldWrapper) hook.handlers[20] = hook.world;
        this.hooks.delete(host);
      }
    }
    heldFor(host, native) {
      const o = this.operation;
      if (o?.host === host && o.native === native) return o;
      for (const lock of this.locks.values()) if (lock.host === host && lock.native === native) return lock;
      return null;
    }
    prune() {
      if (this.operation && !this.valid(this.operation, true)) this.finish('cancelled', 'route-or-focus-changed');
      for (const [slot, lock] of this.locks) if (!this.valid(lock)) this.locks.delete(slot);
      this.restoreIdleHosts();
    }
    sendMouse(...args) {
      this.prune();
      const had = this.operation || this.locks.size;
      if (!had) {
        if (this.statusUntil && this.now() >= this.statusUntil) {this.statusUntil = 0;this.updateStatus();}
        return this.originalSend.apply(this.h.actions, args);
      }
      const routes = [this.operation, ...this.locks.values()].filter(Boolean);
      for (const route of routes) this.ensureHost(route.host);
      // The original primary scheduler still services non-locked/inactive slots.
      // Packet wrappers change coordinates for the held host+native-slot ONLY.
      const result = this.originalSend.apply(this.h.actions, args);
      // Also cover native Stop (it normally skips cursor submission altogether).
      for (const route of routes) if (this.valid(route, route === this.operation) && route.host.player.isStopped)
        route.host.packets.cursor(route.point.x, route.point.y, route.native);
      this.updateStatus(); return result;
    }
    stopFeeding() { rp.feedTiming?.release?.('line-input'); this.manager?.releaseFeed?.(); }
    toggleLock(direction = 'Mouse') {
      const route = this.captureRoute(), old = this.locks.get(route.slot);
      if (old?.directionName === direction && this.valid(old)) {
        this.locks.delete(route.slot); this.restoreIdleHosts(); this.result({status: 'released', slot: route.slot}); this.originalSend.call(this.h.actions); return true;
      }
      if (!this.valid(route, true)) return this.reject('Join, finish verification and spawn the selected player first; close chat/menu.');
      const vector = this.direction(direction, route); if (!vector) return this.reject('Invalid line direction or viewport.');
      this.finish('cancelled', 'line-lock-selected'); this.stopFeeding(); this.ensureHost(route.host);
      const lock = {...route, directionName: direction, label: vector.label, vector,
        point: aimPoint(center(route.host, route.native), vector, 10_000_000)};
      this.locks.set(route.slot, lock); if (!this.sendHeld(lock)) return false;
      this.result({status: 'locked', slot: route.slot, direction, splitRequests: 0}); return true;
    }
    sendHeld(o) {
      if (!this.valid(o, o === this.operation)) {
        if(o === this.operation) this.finish('cancelled', 'route-or-focus-changed');
        else {this.locks.delete(o.slot);this.restoreIdleHosts();this.updateStatus();}
        return false;
      }
      try { o.host.packets.cursor(o.point.x, o.point.y, o.native); }
      catch (error) {
        const reason = 'Native aim send failed: ' + String(error.message || error);
        if (o === this.operation) this.finish('cancelled', reason, true);
        else { this.locks.delete(o.slot); this.restoreIdleHosts(); this.result({status: 'cancelled', reason}, true); }
        return false;
      }
      this.event('aim', {slot: o.slot, native: o.native, x: o.point.x, y: o.point.y}); return true;
    }
    trigger(overrides = {}) {
      if (this.disposed) return false;
      const cfg = this.options(overrides);
      if (cfg.mode === 'Endy lock') return this.toggleLock(cfg.direction);
      if (this.operation) return this.reject('A line split is already running.');
      const route = this.captureRoute();
      if (!this.valid(route, true)) return this.reject('Join, finish verification and spawn the selected player first; close chat/menu.');
      const c = center(route.host, route.native), vector = this.direction(cfg.direction, route);
      if (!vector) return this.reject('Invalid line direction or viewport.');
      if (cfg.mode !== 'Endy rapid' && c.count !== 1)
        return this.reject('Centered auto-split needs one merged cell; separate fragments have different centers.');
      this.stopFeeding(); this.ensureHost(route.host); this.locks.delete(route.slot);
      const at = this.now(), minimum = cfg.settleMs === 0 ? 0 :
        Math.max(cfg.settleMs, clamp(Number(route.host.network.latency) * 1.5 + 40 || 0, 0, 600));
      const o = {...route, config: cfg, vector, initialCellCount: c.count, initialMass: Math.round(c.mass),
        sequence: ++this.sequence, phase: 'centering', start: at, lastMovement: at,
        minimum, maxSettle: Math.max(minimum + 1200, 1800), previous: c,
        anchor: aimPoint(c, {x: 0, y: 0}, 0), point: aimPoint(c, {x: 0, y: 0}, 0),
        sent: 0, freshSnapshots: 0, centerConfirmed: false, lastFreshAt: null, quietSince: null,
        quietReference: null, quietFrames: 0, samples: [], receivedShape: geometry(c, vector)};
      this.operation = o; this.trace = []; this.statusUntil = 0;
      this.result({status: 'centering', slot: o.slot, mode: cfg.mode, requestedStages: cfg.splitCount});
      if (cfg.mode !== 'Endy rapid' && !this.sendHeld(o)) return false;
      if (cfg.mode === 'Endy rapid' || !minimum) this.beginTrain(o);
      else this.schedule(() => this.settle(o), 20);
      return this.operation === o;
    }
    schedule(fn, delay) {
      if (this.timer !== null) this.clearTimer(this.timer);
      this.timer = this.setTimer(() => {this.timer = null; fn();}, Math.max(0, delay));
    }
    observeWorld(host) {
      const o = this.operation;
      if (!o || o.host !== host || !this.valid(o, true)) return;
      const at = this.now(), c = center(host, o.native);
      o.lastFreshAt = at; o.freshSnapshots++;
      o.receivedShape = geometry(c, o.vector);
      o.samples.push({at: Math.round(at - o.start), phase: o.phase, cells: c.samples.slice(0, 128).map(p => ({x: p.x, y: p.y}))});
      if (o.samples.length > 48) o.samples.shift();
      if (o.phase !== 'centering') return;
      // The single-cell guard prevents a quiet arithmetic mean from hiding
      // independently moving fragments. The anchor never follows the new pose.
      const near = c.count === 1 && Math.hypot(c.x - o.anchor.x, c.y - o.anchor.y) <= 2;
      const stable = near && o.quietReference && !moved(o.quietReference, c);
      if (!stable) {
        o.quietSince = near ? at : null;
        o.quietReference = near ? c : null;
        o.quietFrames = near ? 1 : 0;
      } else o.quietFrames++;
      o.previous = c;
    }
    settle(o) {
      if (this.operation !== o) return;
      if (!this.valid(o, true)) return this.finish('cancelled', 'route-or-focus-changed');
      const at = this.now();
      if (at - o.start > o.maxSettle) {
        const reason = o.freshSnapshots < 3 ? 'No fresh world updates confirmed the center; no splits sent.' :
          'Cell did not settle at the fixed center; no splits sent.';
        return this.finish('cancelled', reason, true);
      }
      // Timers and render frames NEVER count as new position evidence.
      // A stationary snapshot replayed for 180 ms cannot pass this gate.
      if (!this.sendHeld(o)) return;
      const fresh = o.lastFreshAt !== null && at - o.lastFreshAt <= 200;
      if (at - o.start >= o.minimum && fresh && o.quietFrames >= 3 && o.quietSince !== null && o.lastFreshAt - o.quietSince >= 80) {
        o.centerConfirmed = true; this.beginTrain(o);
      }
      else this.schedule(() => this.settle(o), 20);
    }
    beginTrain(o) {
      if (this.operation !== o || !this.valid(o, true)) return this.finish('cancelled', 'route-or-focus-changed');
      const c = center(o.host, o.native);
      const distance = o.config.mode === 'Exact center rapid' ? 0 : o.config.mode === 'Endy rapid' ? 10_000_000 : o.config.offset;
      o.point = aimPoint(o.config.mode === 'Endy rapid' ? c : o.anchor, o.vector, distance); o.phase = 'splitting';
      this.pulse(o);
    }
    pulse(o) {
      if (this.operation !== o || !this.valid(o, true)) return this.finish('cancelled', 'route-or-focus-changed');
      if (o.expected !== undefined && this.now() - o.expected > 250)
        return this.finish('cancelled', 'Frame/timer stalled; remaining splits were cancelled.', true);
      if (Number(o.host.network.ws?.bufferedAmount) > 65536)
        return this.finish('cancelled', 'Socket queue is congested; remaining splits cancelled.', true);
      if (!this.sendHeld(o)) return this.finish('cancelled', 'aim-unavailable');
      const count = o.config.mode === 'Native burst' ? o.config.splitCount : 1;
      try {
        this.emitting = true;
        if (o.host.packets.split(o.native, count) === false)
          return this.finish('cancelled', 'Native split writer rejected the request.', true);
      } catch (error) { return this.finish('cancelled', 'Native split send failed: ' + String(error.message || error), true); }
      finally { this.emitting = false; }
      o.sent += count; this.event('split-request', {slot: o.slot, native: o.native, count}); this.updateStatus();
      if (o.sent < o.config.splitCount) {
        o.expected = this.now() + o.config.gapMs; this.schedule(() => this.pulse(o), o.config.gapMs);
      } else {
        o.phase = 'hold'; this.updateStatus();
        this.schedule(() => {
          if (this.operation !== o) return;
          if (!this.valid(o, true)) return this.finish('cancelled', 'route-or-focus-changed');
          this.finish('sent', null); this.originalSend.call(this.h.actions);
        }, o.config.holdMs);
      }
    }
    finish(status, reason, notify = false) {
      if (this.timer !== null) this.clearTimer(this.timer); this.timer = null;
      const o = this.operation; this.operation = null;
      this.restoreIdleHosts();
      if (o) this.result({status, ...(reason ? {reason} : {}), slot: o.slot, mode: o.config.mode,
        requestedStages: o.config.splitCount, stagesSent: o.sent, initialCellCount: o.initialCellCount,
        initialMass: o.initialMass, freshSnapshots: o.freshSnapshots,
        elapsedMs: Math.round(this.now() - o.start), anchor: {...o.anchor}, aim: {...o.point},
        direction: {x: o.vector.x, y: o.vector.y}, centerConfirmed: o.centerConfirmed,
        receivedShape: o.receivedShape, observationWindow: o.samples,
        lineShapeVerified: false, serverAcceptedCountKnown: false}, notify);
      if (o && !this.disposed) {
        this.statusUntil = this.now() + 12000;
        this.updateStatus();
      }
      return !!o;
    }
    cancel(reason = 'cancelled') {
      const had = this.finish('cancelled', reason);
      // Match Endy's independent per-player direction locks across manual switches,
      // but NEVER leave a queued split train running on the previous player.
      const keepLocks = reason === 'switch' || reason === 'spawn-switch';
      const locks = this.locks.size;
      if (!keepLocks) this.locks.clear();
      this.restoreIdleHosts();
      if (!had && locks && !keepLocks) this.result({status: 'released', reason});
      this.updateStatus(); return had || (!keepLocks && locks > 0);
    }
    keyFromEvent(event) {
      // Same spelling/modifier order as the captured Ryuten hotkey editor,
      // including DELETE/BACKSPACE and combined modifiers Senpa's parser omits.
      const aliases = {Escape: 'ESC', Backspace: 'BACKSPACE', Tab: 'TAB', Enter: 'ENTER',
        NumpadEnter: 'ENTER', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Space: 'SPACE',
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        Backquote: 'BACKQUOTE', Delete: 'DELETE'};
      const code = event.code || '', base = aliases[code] ||
        (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit[0-9]$/.test(code) ? code.slice(5) : '');
      if (!base) return '';
      return [event.ctrlKey ? 'CTRL' : '', event.altKey ? 'ALT' : '', event.metaKey ? 'META' : '', base].filter(Boolean).join('+');
    }
    handleKeyboard(event) { return !event.repeat && !event.isComposing && this.handleKey(this.keyFromEvent(event)); }
    handleMouse(event) {
      const names = ['LEFT BTN', 'MIDDLE BTN', 'RIGHT BTN'];
      return this.handleKey(names[event.button] || `BTN ${event.button + 1}`);
    }
    handleKey(key) {
      key = normalizeKey(key);
      for (const [setting, , , direction] of BINDINGS) {
        const keys = this.setting(setting, []);
        if (!keys.some(k => k && !['NONE', 'NO KEY'].includes(k) && normalizeKey(k) === key)) continue;
        if (direction === 'Cancel') { this.cancel('hotkey'); this.originalSend.call(this.h.actions); }
        else if (direction) this.toggleLock(direction);
        else this.trigger();
        return true;
      }
      return false;
    }
    downloadLastAttempt() {
      if (!this.lastResult || !rp.download) return false;
      rp.download('senpa-line-attempt-' + (rp.build?.version || 'test') + '.json', JSON.stringify({
        version: rp.build?.version || null, source: 'native received own-cell positions; not server physics',
        ...this.snapshot()}, null, 2));
      return true;
    }
    snapshot() {
      return {active: !!this.operation, phase: this.operation?.phase ?? null, slot: this.operation?.slot ?? null,
        options: this.options(), locks: [...this.locks.values()].map(l => ({slot: l.slot, native: l.native, direction: l.directionName, point: {...l.point}})),
        lastResult: this.lastResult, recentEvents: this.trace.slice(), lineShapeVerified: false};
    }
    dispose() {
      this.disposed = true; this.cancel('dispose');
      if (this.h.actions.sendMouse === this.sendWrapper) this.h.actions.sendMouse = this.originalSend;
      for (const [host, hook] of this.hooks) {
        if (host.packets.cursor === hook.cursor) host.packets.cursor = hook.original;
        if (host.packets.split === hook.splitWrapper) host.packets.split = hook.split;
        if (hook.worldWrapper && hook.handlers?.[20] === hook.worldWrapper) hook.handlers[20] = hook.world;
      }
      this.hooks.clear(); this.badge?.remove();
      window.removeEventListener('blur', this.onBlur); document.removeEventListener('visibilitychange', this.onHidden);
      document.removeEventListener('focusin', this.onFocus, true);
    }
  }
  rp.modules.installLineSettings = (r, add) => {
    const group = ['Controls', 'Lines'];
    const saved = (key, value) => rp.setting(key, value);
    const mode = add('LINE_SPLIT_MODE', new r.L({_8192: 'Line split preset', _8592: group,
      _5901: 'Centered/Exact center rapid: four separate split requests by default. Native burst: one counted request. Endy rapid: distant locked direction plus splits. Endy lock: direction only; split manually. None can guarantee server-side line shape.',
      _8328: MODES.includes(saved('line-split-mode', MODES[0])) ? saved('line-split-mode', MODES[0]) : MODES[0], _5331: MODES}), MODES[0]);
    mode._4935('change', v => {rp.lineSplit?.cancel('settings-change'); rp.saveSetting('line-split-mode', v);});
    for (const [key, storage, label, defaultValue, min, max, help] of [
      ['LINE_SPLIT_COUNT', 'line-split-count', 'Split stages (4 = up to 16 pieces from one)', 4, 1, 6, 'Requested doublings, not final cell count. Server mass/cell caps still apply.'],
      ['LINE_SPLIT_GAP_MS', 'line-split-gap-ms', 'Gap between rapid split requests', 25, 0, 120, 'Native burst ignores this gap. Timers are best effort; late trains cancel rather than catch up.'],
      ['LINE_SPLIT_SETTLE_MS', 'line-split-settle-ms', 'Minimum center-hold time', 180, 0, 600, 'Holds one fixed world center; needs 3 fresh world updates and a quiet window. No updates means no automatic split. Centered modes require one merged cell. 0 is an unchecked diagnostic bypass. Endy modes skip centering.'],
      ['LINE_SPLIT_OFFSET', 'line-split-offset', 'Near-center direction offset (world units)', 8, 2, 64, 'Small directional nudge, including arbitrary diagonals; integer cursor coordinates. Exact center uses zero; Endy uses a distant target.'],
      ['LINE_SPLIT_HOLD_MS', 'line-split-hold-ms', 'Keep aim pinned after the final split', 240, 100, 800, 'Normal mouse aim resumes afterwards. Does not extend server movement or merge timers.'],
    ]) {
      const value = Math.round(number(saved(storage, defaultValue), defaultValue, min, max));
      const setting = add(key, new r.T({_8192: label, _5901: help, _8592: group, _8328: value,
        _1690: min, _8146: max, _8604: 1, _2782: v => String(v) + (key.endsWith('_MS') ? ' ms' : ''),
        _1195: v => Number.isInteger(v) && v >= min && v <= max}), defaultValue);
      setting._4935('change', v => {rp.lineSplit?.cancel('settings-change'); rp.saveSetting(storage, v);});
    }
    for (const [key, storage, label, direction] of BINDINGS) {
      const setting = add(key, new r.M({_8192: label, _8592: group,
        _5901: direction === 'Cancel' ? 'Release all locks and cancel pending splits. Chat/menu/blur also release locks.' :
          direction ? 'Endy-style fixed direction, no automatic split. Same key releases this player; locks are separate per player. Use normal split keys while locked.' :
          'Run the selected preset toward the captured mouse angle. Bind here; existing line-split key is preserved. No key is assigned automatically.',
        _8328: saved(storage, ['NONE', 'NONE'])}), ['NONE', 'NONE']);
      setting._4935('change', v => {rp.lineSplit?.cancel('binding-change'); rp.saveSetting(storage, v);});
    }
  };
  rp.modules.lineInput = {MODES, DIRECTIONS, BINDINGS, config, center, aimPoint, moved, geometry, LineInputController};
  rp.modules.installLineSplit = (h, r, options) => (rp.lineSplit = new LineInputController(h, r, options));
})();
