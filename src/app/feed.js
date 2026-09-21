

(() => {
  'use strict';

  const rp = window.RYUTEN_PORT;
  if (!rp || !rp.modules) return;

  // Zero deliberately means “leave the native automatic feed cadence enabled”.
  // A positive value is a best-effort client timer. Browsers quantise very small
  // timers, and the server still owns cooldowns/rate limits; this does not claim
  // to bypass either of them.
  const NATIVE_INTERVAL_MS = 0;
  const MIN_INTERVAL_MS = 1;
  const MAX_INTERVAL_MS = 5_000;
  const SETTING_KEY = 'FEED_INTERVAL_MS';
  const controllers = new WeakMap();

  const isFunction = value => typeof value === 'function';

  function normalizeInterval(value) {
    if (value === null || value === undefined || value === '' || Number(value) === 0) {
      return NATIVE_INTERVAL_MS;
    }

    let number;
    try {
      number = Number(value);
    } catch {
      return NATIVE_INTERVAL_MS;
    }
    if (!Number.isFinite(number) || number < 0) return NATIVE_INTERVAL_MS;
    return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(number)));
  }

  function defaultNow() {
    const performanceObject = window.performance;
    return performanceObject && isFunction(performanceObject.now)
      ? performanceObject.now()
      : Date.now();
  }

  function timerFunction(options, name, fallback) {
    if (isFunction(options[name])) return options[name];
    if (isFunction(window[name])) return window[name].bind(window);
    return fallback;
  }

  class FeedTimingController {
    constructor(h, r, options = {}) {
      if (!h || !h.actions) throw new TypeError('FeedTimingController requires a host with actions');

      this.host = h;
      this.reference = r;
      this.parentPort = options.parentPort || rp.parentPort || null;
      this.manager = this.parentPort && this.parentPort.multibox;
      this.intervalMs = normalizeInterval(
        options.intervalMs === undefined ? options.initialIntervalMs : options.intervalMs,
      );

      this._now = isFunction(options.now) ? options.now : defaultNow;
      this._setTimeout = timerFunction(options, 'setTimeout', setTimeout);
      this._clearTimeout = timerFunction(options, 'clearTimeout', clearTimeout);
      this._timer = null;
      this._generation = 0;
      this._running = false;
      // Input intent outlives an individual native stream / a pending spawn.
      // Never infer a released key from the stop-old-stream half of a switch.
      this._held = false;
      this._holdEpoch = 0;
      this._heldInputs = new Set();
      this._waiting = false;
      this._waitTimer = null;
      this._waitUntil = 0;
      this._targetSlot = null;
      this._pulseCount = 0;
      this._lastPulseAt = null;
      this._lastReleaseReason = null;
      this._lastError = null;
      this._disposed = false;
      this._nativeMacroHosts = new Set();
      this._originalMacroFeeds = new WeakMap();
      this._originalMacroFeed = null;
      this._restores = [];
      this._observedHosts = new WeakSet();

      this._install();
    }

    get running() {
      return this._running;
    }

    get usingNativeCadence() {
      return this.intervalMs === NATIVE_INTERVAL_MS;
    }

    get targetSlot() {
      return this._targetSlot;
    }

    get pulseCount() {
      return this._pulseCount;
    }

    get lastPulseAt() {
      return this._lastPulseAt;
    }

    get lastReleaseReason() {
      return this._lastReleaseReason;
    }

    get feedFollowsTab() {
      return !this.host.settings || this.host.settings.feedFollowsTab !== false;
    }

    snapshot() {
      return {
        intervalMs: this.intervalMs,
        fastTest: this.reference?.Q?.FAST_FEED_TEST?._5997() === true,
        requestedRatePerSecond: this.intervalMs > 0 ? 1000 / this.intervalMs : null,
        serverAcceptedRateKnown: false,
        usingNativeCadence: this.usingNativeCadence,
        running: this.running,
        held: this._held,
        waitingForPlayer: this._waiting,
        nativeFeeding: this._hasNativeMacro(),
        inputSources: [...this._heldInputs],
        targetSlot: this.targetSlot,
        pulseCount: this.pulseCount,
        lastPulseAt: this.lastPulseAt,
        lastReleaseReason: this.lastReleaseReason,
        lastError: this._lastError,
      };
    }

    useFastTest(enabled = true) {
      const setting=this.reference?.Q?.FAST_FEED_TEST;
      if(!setting)throw new Error('Fast-feed test setting is unavailable');
      setting._7531(enabled===true);return this.snapshot();
    }

    setIntervalMs(value) {
      if (this._disposed) return this.intervalMs;

      const next = normalizeInterval(value);
      if (next === this.intervalMs) return next;

      const wasRunning = this._running;
      const wasNative = this.usingNativeCadence;
      if (next > NATIVE_INTERVAL_MS && wasNative && this._hasNativeMacro()) this._stopNativeMacros();

      this.intervalMs = next;
      if (next === NATIVE_INTERVAL_MS) {
        if (wasRunning) this.release('native-cadence');
      } else if (wasRunning) {
        this._clearScheduledPulse();
        this._schedule();
      }
      return next;
    }

    start(options = {}) {
      if (this._disposed || this.usingNativeCadence || this._running) return false;

      const slot = Number.isInteger(options.slot) ? options.slot : this._activeSlot();
      if (!Number.isInteger(slot) || slot < 0) return false;

      this._held = true;
      this._targetSlot = slot;
      this._running = true;
      if (!this.pulse()) {
        // Preserve pulse()'s specific stop reason, including chat/backpressure.
        if(this._running)this.release('unavailable', { native: false });
        return false;
      }
      this._schedule();
      return true;
    }

    pulse() {
      if (this._disposed || !this._running || this.usingNativeCadence) return false;

      const route = this._resolveRoute();
      if (!route) {
        this.release('unavailable', { native: false });
        return false;
      }
      const blockedReason = this._blockedReason(route.host);
      if (blockedReason) {
        this.release(blockedReason, { native: false });
        return false;
      }
      if (!this._isReady(route.host, route.nativeSlot)) {
        this.release('unavailable', { native: false });
        return false;
      }

      // Never build an output queue in response to a stall or congested socket.
      if (Number(route.host.network?.ws?.bufferedAmount) > 65536) {
        this.release('socket-backpressure', { native: false });return false;
      }
      try {
        this.host.actions.sendMouse?.();
        const result = route.send();
        if (result === false) {
          this.release('send-rejected', { native: false });
          return false;
        }
        this._pulseCount += 1;
        this._lastPulseAt = this._now();
        this._lastError = null;
        return true;
      } catch (error) {
        this._lastError = error instanceof Error ? error.message : String(error);
        this.release('send-error', { native: false });
        return false;
      }
    }

    release(reason = 'manual', options = {}) {
      const shouldReleaseNative = options.native !== false
        && this.usingNativeCadence
        && this._hasNativeMacro();
      const nativeHosts = shouldReleaseNative ? this._nativeMacroHostsSnapshot() : [];

      this._running = false;
      this._held = false;
      this._holdEpoch += 1;
      this._heldInputs.clear();
      this._clearWait();
      this._targetSlot = null;
      this._generation += 1;
      this._clearScheduledPulse();
      this._lastReleaseReason = String(reason);
      if (!options.preserveNative) this._nativeMacroHosts.clear();

      if (shouldReleaseNative) {
        for (const host of nativeHosts) this._callNativeMacroFeed(false, host);
      }
      return true;
    }

    stop(reason = 'manual') {
      return this.release(reason);
    }

    // Parent presentation code should call this when a switch is initiated
    // outside SenpaMultibox.select (for example the native one-connection path).
    // A switch is one transaction, independent of which iframe owns input.
    // Custom cadence keeps its pending deadline: switching is not another press.
    beforeSwitch() {
      const token = {
        held: this._held || this._running || this._hasNativeMacro(),
        custom: this._running, native: this._hasNativeMacro(),
        slot: this._targetSlot, epoch: this._holdEpoch,
      };
      if (token.native) this._stopNativeMacros();
      this._clearWait();
      if (token.held && !this.feedFollowsTab) this.release('switch', {native: false});
      return token;
    }
    afterSwitch(token, slot) {
      // A late spawn/switch callback must never re-arm feed after real key-up.
      if (!token?.held || token.epoch !== this._holdEpoch || !this.feedFollowsTab
          || this._disposed || !Number.isInteger(slot) || slot < 0) return false;
      this._held = true;
      this._targetSlot = slot;
      const route = this._resolveRoute();
      const blocked = this._blockedReason(route?.host);
      if (blocked) { this.release(blocked); return false; }
      if (!route || !this._isReady(route.host, route.nativeSlot)) {
        this._running = !this.usingNativeCadence;
        return this._waitForTarget();
      }
      if (this.usingNativeCadence) return this._startNativeRoute(route);
      this._running = true;
      // Preserve the existing timer deadline. No extra eject merely for a tab switch.
      if (this._timer === null && this.pulse()) this._schedule();
      return true;
    }

    // Physical input is independent of source connection and logical player.
    // The key code, not its current modifier spelling, owns release (Ctrl+W -> W).
    handleKeyboard(event, key) {
      const source = 'key:' + (event.code || key);
      if (event.type === 'keyup') return this._releaseInput(source);
      if (event.type !== 'keydown' || key !== this.host.settings?.hkMacroFeed) return false;
      if (event.repeat) return true;
      return this._pressInput(source);
    }
    handleMouse(event) {
      const source = 'mouse:' + event.button;
      if (event.type === 'mouseup') return this._releaseInput(source);
      const name = ['leftClick', 'middleClick', 'rightClick'][event.button];
      if (event.type !== 'mousedown' || !name || this.host.settings?.[name] !== 'macroFeed') return false;
      return this._pressInput(source);
    }
    _pressInput(source) {
      if (this._disposed) return false;
      if (!this._heldInputs.has(source)) {
        this._heldInputs.add(source);
        this._handleMacroFeed(true);
      }
      return true;
    }
    _releaseInput(source) {
      if (!this._heldInputs.delete(source)) return false;
      if (!this._heldInputs.size) this.release('input-up');
      return true;
    }
    _clearWait() {
      if (this._waitTimer !== null) this._clearTimeout(this._waitTimer);
      this._waitTimer = null;
      this._waiting = false;
      this._waitUntil = 0;
    }
    _waitForTarget() {
      if (!this._held || this._disposed) return false;
      this._clearScheduledPulse();
      if (!this._waiting) this._waitUntil = this._now() + 15000;
      this._waiting = true;
      if (this._waitTimer !== null) return true;
      const epoch = this._holdEpoch;
      this._waitTimer = this._setTimeout(() => {
        this._waitTimer = null;
        if (!this._held || epoch !== this._holdEpoch || this._disposed) return;
        const route = this._resolveRoute();
        const blocked = this._blockedReason(route?.host);
        if (blocked) { this.release(blocked); return; }
        if (this._activeSlot() !== this._targetSlot) { this.release('route-changed'); return; }
        if (this._now() >= this._waitUntil) { this.release('player-ready-timeout'); return; }
        if (!route || !this._isReady(route.host, route.nativeSlot)) {
          this._waitForTarget(); return;
        }
        this._clearWait();
        if (this.usingNativeCadence) this._startNativeRoute(route);
        else { this._running = true; if (this.pulse()) this._schedule(); }
      }, 40);
      return true;
    }
    _startNativeRoute(route) {
      if (this._nativeMacroHosts.has(route.host) && route.host.actions.macroFeedTab === route.nativeSlot) return true;
      this._stopNativeMacros();
      this._targetSlot = route.slot;
      this._nativeMacroHosts.add(route.host);
      // Original macroFeed captures its host's activeTab. Never route this
      // through the manager a second time, and never invent packet contents.
      this.host.actions.sendMouse?.();
      try {
        const result = this._callNativeMacroFeed(true, route.host);
        if (result === false) { this.release('send-rejected'); return false; }
        return true;
      } catch (error) {
        this._lastError = String(error?.message || error);
        this.release('send-error'); return false;
      }
    }

    onSwitch(slot) {
      if(this._targetSlot===slot)return true;
      const token=this.beforeSwitch();return this.afterSwitch(token,slot);
    }

    onMenu(isOpen = true) {
      if (isOpen) this.release('menu');
      return this.running;
    }

    onDisconnect() {
      return this.release('disconnect');
    }

    dispose() {
      if (this._disposed) return;
      this.release('dispose');
      this._disposed = true;
      for (const restore of this._restores.splice(0)) restore();
      if (rp.feedTiming === this) delete rp.feedTiming;
      if (controllers.get(this.host) === this) controllers.delete(this.host);
    }

    _install() {
      this._wrapAction();
      this._wrapTogglePlayer();
      this._wrapManager();
      this._observeHost(this.host);
      if (this.manager && this.manager.aux && this.manager.aux.host) {
        this._observeHost(this.manager.aux.host);
      }

      this._listen(window, 'blur', () => this.release('blur'));
      this._listen(window, 'pagehide', () => this.release('pagehide'));
      this._listen(window, 'beforeunload', () => this.release('beforeunload'));
      this._listen(document, 'visibilitychange', () => {
        if (document.hidden) this.release('hidden');
      });
    }

    _wrapAction() {
      this._wrapHostAction(this.host);
    }

    _wrapHostAction(host, slot = null) {
      if (!host || !host.actions || !isFunction(host.actions.macroFeed)) return;
      if (this._originalMacroFeeds.has(host)) return;

      const actions = host.actions;
      const originalMethod = actions.macroFeed;
      const original = originalMethod.bind(actions);
      this._originalMacroFeeds.set(host, original);
      if (host === this.host) this._originalMacroFeed = original;
      if (actions.isMacroFeeding) this._nativeMacroHosts.add(host);

      const controller = this;
      const routedSlot = Number.isInteger(slot) ? slot : null;
      const wrapped = function wrappedMacroFeed(state) {
        return controller._handleMacroFeed(!!state, host, host===controller.host?null:controller._slotForHost(host));
      };
      actions.macroFeed = wrapped;
      this._restores.push(() => {
        if (actions.macroFeed === wrapped) actions.macroFeed = originalMethod;
      });
    }

    _wrapTogglePlayer() {
      const actions = this.host.actions;
      if (!isFunction(actions.togglePlayer)) return;

      const controller = this;
      const originalMethod = actions.togglePlayer;
      const original = originalMethod.bind(actions);
      const wrapped = function wrappedTogglePlayer(...args) {
        const before = controller._activeSlot();
        const result = original(...args);
        // SenpaMultibox.select observes the two-connection path. This covers
        // host.request's native one-connection tab switch, whose native
        // toggle no longer sees isMacroFeeding while custom mode is active.
        if (!controller.manager || !controller.manager.multi) {
          const after = controller._activeSlot();
          if (after !== before) controller.onSwitch(after);
        }
        return result;
      };
      actions.togglePlayer = wrapped;
      this._restores.push(() => {
        if (actions.togglePlayer === wrapped) actions.togglePlayer = originalMethod;
      });
    }

    _handleMacroFeed(state, host = this.host, slot = null) {
      if (!state) {
        // A secondary UI/native stop event is not a physical release of W.
        // Real key-up uses _releaseInput; menu/blur/disconnect call release directly.
        if (this._heldInputs.size) return true;
        return this.release(this.usingNativeCadence ? 'native-input' : 'input');
      }
      const logical = Number.isInteger(slot) ? slot
        : host === this.host ? this._activeSlot() : this._slotForHost(host);
      if (!Number.isInteger(logical) || logical < 0 || this._disposed) return false;
      this._held = true;
      this._targetSlot = logical;
      if (this._waiting) return true;
      if (this.usingNativeCadence) {
        const route = this._resolveRoute();
        const blocked = this._blockedReason(route?.host);
        if (blocked || !route || !this._isReady(route.host, route.nativeSlot)) {
          this.release(blocked || 'unavailable'); return false;
        }
        return this._startNativeRoute(route);
      }
      if (this._hasNativeMacro()) this._stopNativeMacros();
      return this.start({slot: logical});
    }

    _callNativeMacroFeed(state, host = this.host) {
      const nativeMacro = host===this.host && this.manager?.original?.macroFeed
        ? this.manager.original.macroFeed
        : this._originalMacroFeeds.get(host) || (host===this.host?this._originalMacroFeed:null);
      return nativeMacro ? nativeMacro(state) : undefined;
    }

    _wrapManager() {
      const manager = this.manager;
      if (!manager) return;

      if(!manager.feedTransactions)this._wrapMethod(manager, 'select', (original, target, args) => {
        const token=this.beforeSwitch();const result=original.apply(target,args);
        if(result!==false)this.afterSwitch(token,this._activeSlot());
        else this.afterSwitch(token,token.slot);
        return result;
      });

      this._wrapMethod(manager, 'releaseFeed', (original, target, args) => {
        // In custom mode no macro stream was started, so invoking the native
        // manager release would add an unnecessary [23, slot, 1, 0] packet.
        this.release('release-feed', { native: false });
        if (this.usingNativeCadence) return original.apply(target, args);
        return undefined;
      });

      this._wrapMethod(manager, 'destroyAux', (original, target, args) => {
        this.release('destroy-aux');
        return original.apply(target, args);
      });

      this._wrapMethod(manager, 'dispose', (original, target, args) => {
        this.release('dispose');
        return original.apply(target, args);
      });

      this._wrapMethod(manager, 'installAuxLifecycle', (original, target, args) => {
        const result = original.apply(target, args);
        const engine = args[0];
        if (engine && engine.host) this._observeHost(engine.host);
        return result;
      });
    }

    _wrapMethod(target, name, callback) {
      if (!target || !isFunction(target[name])) return;
      const original = target[name];
      const controller = this;
      const wrapped = function wrappedFeedTimingMethod(...args) {
        return callback(original, this, args);
      };
      target[name] = wrapped;
      this._restores.push(() => {
        if (target[name] === wrapped) target[name] = original;
      });
    }

    _observeHost(host) {
      if (!host || this._observedHosts.has(host)) return;
      this._observedHosts.add(host);
      // The primary keyboard closure is always the dispatch source and must
      // resolve the current multibox active slot at each press. Only a native
      // auxiliary closure gets a fixed public slot.
      this._wrapHostAction(host, host === this.host ? null : this._slotForHost(host));

      const events = host.events || {};
      const bus = host.bus;
      if (bus && isFunction(bus.register)) {
        this._registerBusEvent(host, events.Socket_Cleanup, () => {
          // An auxiliary's initial native connect performs cleanup first. That
          // must not cancel a held key waiting for its initial spawn.
          if (host === this.host || (!this._waiting && this._resolveRoute()?.host === host)) this.release('disconnect');
        });
        this._registerBusEvent(host, events.Player_Died, () => {
          const route = this._resolveRoute();
          if (route && route.host !== host) return;
          // A different native slot dying does not release the selected slot's hold.
          if (host.world?.myCells && route && this._isReady(host, route.nativeSlot)) return;
          this.release('death');
        });
        this._registerBusEvent(host, events.Show_Menu, open => {if(open && (host === this.host || this._auxNeedsVerification(host)))this.release('menu');});
      }

      const menu = host.menu;
      if (menu && isFunction(menu.show)) {
        this._wrapMethod(menu, 'show', (original, target, args) => {
          if (host === this.host || this._auxNeedsVerification(host)) this.release('menu');
          return original.apply(target, args);
        });
      }
    }

    _registerBusEvent(host, event, callback) {
      if (event === undefined || event === null || !host.bus || !isFunction(host.bus.register)) return;
      const cleanup = host.bus.register(event, callback);
      if (isFunction(cleanup)) this._restores.push(cleanup);
    }

    _listen(target, event, callback) {
      if (!target || !isFunction(target.addEventListener)) return;
      target.addEventListener(event, callback);
      this._restores.push(() => {
        if (isFunction(target.removeEventListener)) target.removeEventListener(event, callback);
      });
    }

    _activeSlot() {
      if (this.manager && this.manager.multi && Number.isInteger(this.manager.active)) {
        return this.manager.active;
      }
      return this.host.player && Number.isInteger(this.host.player.activeTab)
        ? this.host.player.activeTab
        : 0;
    }

    _slotForHost(host) {
      if (!this.manager || !this.manager.multi || !host) return null;
      const width=this.manager.sourceSlotCount||1;
      if (host === this.manager.primary || host === this.host) return host.player?.activeTab||0;
      if (this.manager.aux && host === this.manager.aux.host) return width+(host.player?.activeTab||0);
      if (isFunction(this.manager.host)) {
        for (const slot of this.manager.slots?.()||[0, 1]) {
          if (this.manager.host(slot) === host) return slot;
        }
      }
      return null;
    }

    _resolveRoute() {
      const manager = this.manager;
      const slot = Number.isInteger(this._targetSlot) ? this._targetSlot : this._activeSlot();

      if (manager && manager.multi) {
        if (!(manager.slots?.()||[0,1]).includes(slot)) return null;
        const host = isFunction(manager.host) ? manager.host(slot) : null;
        if (!host) return null;
        return {
          slot,
          nativeSlot: manager.nativeSlot?.(slot)??0,
          host,
          // Multibox translates the selected public slot to native slot 0 on
          // the corresponding connection.
          send: () => isFunction(manager.packetAction)
            ? manager.packetAction('feed', slot, true)
            : host.packets.feed(manager.nativeSlot?.(slot)??0, true),
        };
      }

      const host = this.host;
      return {
        slot,
        nativeSlot: slot,
        host,
        send: () => manager && isFunction(manager.packetAction)
          ? manager.packetAction('feed', slot, true)
          : host.packets.feed(slot, true),
      };
    }

    _isReady(host, nativeSlot = 0) {
      if (!host || !host.packets || !isFunction(host.packets.feed)) return false;
      if (host.network && 'connected' in host.network && !host.network.connected) return false;
      if ('handshakeDone' in host.packets && !host.packets.handshakeDone) return false;

      // A multibox route may point at P2 while the primary host's player
      // state is alive. Read the routed native cell collection instead.
      if (host.world && host.world.myCells !== undefined && host.world.myCells !== null) {
        const cells = host.world.myCells instanceof Map
          ? host.world.myCells.get(nativeSlot)
          : host.world.myCells[nativeSlot];
        return this._hasAliveCells(cells);
      }
      return !host.player || host.player.isAlive !== false;
    }

    _hasAliveCells(cells) {
      if (cells === undefined || cells === null) return false;
      if (typeof cells.size === 'number') return cells.size > 0;
      if (typeof cells.length === 'number') return cells.length > 0;
      if (isFunction(cells.values)) {
        for (const cell of cells.values()) {
          if (cell && !cell.removed) return true;
        }
        return false;
      }
      return true;
    }

    _blockedReason(routeHost) {
      if (this.host.network?.isReplay || routeHost?.network?.isReplay) return 'replay';
      if (this.host.menu && (this.host.menu.isOpen||this.host.menu.isChatFocused)) return 'menu';
      if (routeHost && routeHost !== this.host && this._auxNeedsVerification(routeHost)) return 'verification';
      if (typeof document !== 'undefined' && document.hidden) return 'hidden';
      return null;
    }

    _auxNeedsVerification(host) {
      if (host && host.needsVerification === true) return true;
      return !!(this.manager && this.manager.aux && this.manager.aux.host === host
        && this.manager.aux.needsVerification === true);
    }

    _nativeMacroHostsSnapshot() {
      const hosts = new Set(this._nativeMacroHosts);
      if (this.host.actions && this.host.actions.isMacroFeeding) hosts.add(this.host);
      if (this.manager && this.manager.aux && this.manager.aux.host
        && this.manager.aux.host.actions && this.manager.aux.host.actions.isMacroFeeding) {
        hosts.add(this.manager.aux.host);
      }
      return hosts;
    }

    _hasNativeMacro() {
      return this._nativeMacroHostsSnapshot().size > 0;
    }

    _stopNativeMacros() {
      for (const host of this._nativeMacroHostsSnapshot()) this._callNativeMacroFeed(false, host);
      this._nativeMacroHosts.clear();
    }

    _clearScheduledPulse() {
      if (this._timer !== null) {
        this._clearTimeout(this._timer);
        this._timer = null;
      }
    }

    _schedule() {
      this._clearScheduledPulse();
      if (this._disposed || !this._running || this.usingNativeCadence) return;

      const generation = ++this._generation;
      this._timer = this._setTimeout(() => {
        this._timer = null;
        if (generation !== this._generation || !this._running || this.usingNativeCadence) return;
        if (this.pulse()) this._schedule();
      }, this.intervalMs);
    }
  }

  function installFeedTiming(h, r, options = {}) {
    if (!h || !h.actions) return null;

    const existing = controllers.get(h);
    if (existing && !existing._disposed) {
      if (options.intervalMs !== undefined || options.initialIntervalMs !== undefined) {
        existing.setIntervalMs(options.intervalMs === undefined ? options.initialIntervalMs : options.intervalMs);
      }
      return existing;
    }

    const controller = new FeedTimingController(h, r, options);
    controllers.set(h, controller);
    rp.feedTiming = controller;
    return controller;
  }

  rp.modules.FeedTiming = FeedTimingController;
  rp.modules.FeedTimingController = FeedTimingController;
  rp.modules.FEED_TIMING_LIMITS = Object.freeze({
    nativeIntervalMs: NATIVE_INTERVAL_MS,
    minIntervalMs: MIN_INTERVAL_MS,
    maxIntervalMs: MAX_INTERVAL_MS,
  });
  rp.modules.FEED_INTERVAL_MS = SETTING_KEY;
  rp.modules.installFeedTiming = installFeedTiming;
  // Short alias keeps the parent seam readable without changing the public API.
  rp.modules.installFeed = installFeedTiming;
})();