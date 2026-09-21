import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../src/app/feed.js', import.meta.url);
const source = fs.readFileSync(process.env.FEED_SOURCE || sourcePath, 'utf8');

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) || new Set();
    callbacks.add(callback);
    this.listeners.set(name, callbacks);
  }

  removeEventListener(name, callback) {
    this.listeners.get(name)?.delete(callback);
  }

  dispatch(name, detail) {
    for (const callback of [...(this.listeners.get(name) || [])]) callback(detail);
  }
}

class FakeClock {
  constructor() {
    this.time = 0;
    this.nextId = 1;
    this.jobs = new Map();
  }

  setTimeout = (callback, delay) => {
    const id = this.nextId++;
    this.jobs.set(id, { at: this.time + delay, callback });
    return id;
  };

  clearTimeout = id => {
    this.jobs.delete(id);
  };

  advance(milliseconds) {
    const target = this.time + milliseconds;
    while (true) {
      let nextId = null;
      let nextJob = null;
      for (const [id, job] of this.jobs) {
        if (job.at <= target && (!nextJob || job.at < nextJob.at)) {
          nextId = id;
          nextJob = job;
        }
      }
      if (!nextJob) break;
      this.jobs.delete(nextId);
      this.time = nextJob.at;
      nextJob.callback();
    }
    this.time = target;
  }
}

function makeHost(name, { activeTab = 0 } = {}) {
  const events = new FakeEventTarget();
  const packetLog = [];
  const busListeners = new Map();
  const host = {
    name,
    settings: { feedFollowsTab: true },
    network: { connected: true },
    packets: {
      handshakeDone: true,
      feed: (...args) => packetLog.push(args),
    },
    player: { activeTab, isAlive: true },
    menu: {
      show: () => events.dispatch('menu-shown'),
    },
    events: {
      Socket_Cleanup: 'socket-cleanup',
      Player_Died: 'player-died',
      Show_Menu: 'show-menu',
    },
    bus: {
      register: (event, callback) => {
        const callbacks = busListeners.get(event) || new Set();
        callbacks.add(callback);
        busListeners.set(event, callbacks);
        return () => callbacks.delete(callback);
      },
    },
    actions: {
      isMacroFeeding: false,
      macroFeed: state => {
        host.nativeMacroCalls.push(state);
        host.actions.isMacroFeeding = state;
      },
      feed: (...args) => host.singleFeedCalls.push(args),
      togglePlayer: () => {
        host.player.activeTab = host.player.activeTab === 0 ? 1 : 0;
      },
    },
    nativeMacroCalls: [],
    singleFeedCalls: [],
    packetLog,
    emitBus(event, detail) {
      for (const callback of [...(busListeners.get(event) || [])]) callback(detail);
    },
  };
  return host;
}

function makeEnvironment({ manager = null, host = makeHost('primary'), intervalMs = 0 } = {}) {
  const window = new FakeEventTarget();
  const document = new FakeEventTarget();
  document.hidden = false;
  const clock = new FakeClock();
  const rp = {
    modules: {},
    parentPort: { multibox: manager },
  };
  const context = {
    window: Object.assign(window, { RYUTEN_PORT: rp }),
    document,
    Date,
    Number,
    String,
    Math,
    Object,
    Map,
    Set,
    WeakMap,
    Error,
    TypeError,
    Array,
    console,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: sourcePath.pathname });
  const controller = rp.modules.installFeedTiming(host, null, {
    intervalMs,
    parentPort: { multibox: manager },
    now: () => clock.time,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });
  return { context, window, document, clock, rp, host, controller };
}

test('zero interval preserves native macro feed and single feed action', () => {
  const { host, controller } = makeEnvironment();

  assert.equal(controller.intervalMs, 0);
  assert.equal(controller.usingNativeCadence, true);
  host.actions.macroFeed(true);
  host.actions.macroFeed(false);
  host.actions.feed(0, true);

  assert.deepEqual(host.nativeMacroCalls, [true, false]);
  assert.deepEqual(host.singleFeedCalls, [[0, true]]);
  assert.equal(controller.pulseCount, 0);
});

test('custom interval emits one native single-feed pulse per elapsed period', () => {
  const { clock, host, controller } = makeEnvironment({ intervalMs: 100 });

  host.actions.macroFeed(true);
  assert.deepEqual(host.packetLog, [[0, true]]);
  assert.deepEqual(host.nativeMacroCalls, []);

  clock.advance(99);
  assert.equal(host.packetLog.length, 1);
  clock.advance(1);
  assert.equal(host.packetLog.length, 2);
  clock.advance(200);
  assert.equal(host.packetLog.length, 4);
  assert.equal(controller.pulseCount, 4);
  assert.deepEqual(host.packetLog, [[0, true], [0, true], [0, true], [0, true]]);

  host.actions.macroFeed(false);
  clock.advance(500);
  assert.equal(host.packetLog.length, 4);
  assert.equal(controller.running, false);
  assert.deepEqual(host.nativeMacroCalls, []);
});

test('multibox routes every pulse to the selected host as native slot zero', () => {
  const primary = makeHost('primary');
  const auxiliary = makeHost('auxiliary');
  const manager = {
    multi: true,
    active: 0,
    aux: { host: auxiliary },
    host: slot => slot === 0 ? primary : auxiliary,
    packetAction(method, slot, ...args) {
      assert.equal(method, 'feed');
      const selected = this.host(slot);
      return selected.packets.feed(0, ...args);
    },
    select(slot) {
      this.active = slot;
      return true;
    },
    releaseFeed() {},
    destroyAux() {},
    dispose() {},
  };
  const { clock, controller } = makeEnvironment({ manager, host: primary, intervalMs: 100 });

  primary.actions.macroFeed(true);
  assert.deepEqual(primary.packetLog, [[0, true]]);
  manager.select(1);
  assert.equal(controller.targetSlot, 1);
  assert.deepEqual(auxiliary.packetLog, []); // Switch is not another press.
  clock.advance(100);
  assert.deepEqual(auxiliary.packetLog, [[0, true]]);
  assert.deepEqual(primary.packetLog, [[0, true]]);

  manager.releaseFeed();
  clock.advance(500);
  assert.equal(controller.running, false);
  assert.deepEqual(auxiliary.packetLog, [[0, true]]);

  // The primary keyboard closure remains dynamic even though the installer
  // was created while the manager was already in multi mode.
  manager.active = 1;
  primary.actions.macroFeed(true);
  assert.equal(controller.targetSlot, 1);
  assert.deepEqual(auxiliary.packetLog, [[0, true], [0, true]]);
  manager.releaseFeed();
});

test('blur, menu, death, disconnect, and aux disposal release the timer', () => {
  const primary = makeHost('primary');
  const auxiliary = makeHost('auxiliary');
  const manager = {
    multi: true,
    active: 0,
    aux: { host: auxiliary },
    host: slot => slot === 0 ? primary : auxiliary,
    packetAction(method, slot, ...args) {
      return this.host(slot).packets.feed(0, ...args);
    },
    releaseFeed() {},
    destroyAux() {},
    dispose() {},
  };
  const { clock, window, document, controller } = makeEnvironment({ manager, host: primary, intervalMs: 100 });

  primary.actions.macroFeed(true);
  window.dispatch('blur');
  assert.equal(controller.running, false);
  clock.advance(500);
  assert.equal(primary.packetLog.length, 1);

  primary.actions.macroFeed(true);
  document.hidden = true;
  document.dispatch('visibilitychange');
  assert.equal(controller.running, false);

  primary.actions.macroFeed(true);
  primary.emitBus(primary.events.Player_Died);
  assert.equal(controller.running, false);

  primary.actions.macroFeed(true);
  primary.emitBus(primary.events.Socket_Cleanup);
  assert.equal(controller.running, false);

  primary.actions.macroFeed(true);
  manager.destroyAux();
  assert.equal(controller.running, false);
});

test('setting interval while native macro is active releases native cadence once', () => {
  const { host, controller } = makeEnvironment();

  host.actions.macroFeed(true);
  assert.deepEqual(host.nativeMacroCalls, [true]);
  assert.equal(controller.setIntervalMs(10), 10);
  assert.deepEqual(host.nativeMacroCalls, [true, false]);
  assert.equal(controller.intervalMs, 10);
});

test('installer is idempotent and onSwitch supports the one-connection parent seam', () => {
  const host = makeHost('primary');
  const result = makeEnvironment({ host, intervalMs: 100 });
  const second = result.rp.modules.installFeedTiming(host, null, { intervalMs: 200 });
  assert.equal(second, result.controller);
  assert.equal(result.controller.intervalMs, 200);

  host.actions.macroFeed(true);
  host.actions.togglePlayer();
  assert.equal(result.controller.targetSlot, 1);
  assert.deepEqual(host.packetLog, [[0, true]]);
  result.clock.advance(200);
  assert.deepEqual(host.packetLog, [[0, true], [1, true]]);
  assert.equal(result.rp.feedTiming, result.controller);
});

test('one-connection switch stops the inactive stream when feed follows tab is disabled', () => {
  const host = makeHost('primary');
  host.settings.feedFollowsTab = false;
  const { clock, controller } = makeEnvironment({ host, intervalMs: 100 });

  host.actions.macroFeed(true);
  assert.equal(controller.targetSlot, 0);
  host.player.activeTab = 1;
  assert.equal(controller.onSwitch(1), false);
  assert.equal(controller.running, false);
  assert.equal(controller.targetSlot, null);
  clock.advance(100);
  assert.deepEqual(host.packetLog, [[0, true]]);
});

test('multibox select still releases custom feed when feed follows tab is disabled', () => {
  const primary = makeHost('primary');
  const auxiliary = makeHost('auxiliary');
  primary.settings.feedFollowsTab = false;
  const manager = {
    multi: true,
    active: 0,
    aux: { host: auxiliary },
    host: slot => slot === 0 ? primary : auxiliary,
    packetAction(method, slot, ...args) {
      return this.host(slot).packets.feed(0, ...args);
    },
    select(slot) {
      this.active = slot;
      return true;
    },
    releaseFeed() {},
    destroyAux() {},
    dispose() {},
  };
  const { clock, controller } = makeEnvironment({ manager, host: primary, intervalMs: 100 });

  primary.actions.macroFeed(true);
  manager.select(1);
  clock.advance(500);
  assert.equal(controller.running, false);
  assert.deepEqual(primary.packetLog, [[0, true]]);
  assert.deepEqual(auxiliary.packetLog, []);
});

test('auxiliary macro action uses its public slot while preserving native slot zero', () => {
  const primary = makeHost('primary');
  const auxiliary = makeHost('auxiliary');
  const manager = {
    multi: true,
    active: 0,
    aux: { host: auxiliary },
    host: slot => slot === 0 ? primary : auxiliary,
    packetAction(method, slot, ...args) {
      assert.equal(method, 'feed');
      return this.host(slot).packets.feed(0, ...args);
    },
    releaseFeed() {},
    destroyAux() {},
    dispose() {},
  };
  const { clock, controller } = makeEnvironment({ manager, host: primary, intervalMs: 100 });

  auxiliary.actions.macroFeed(true);
  assert.equal(controller.targetSlot, 1);
  assert.deepEqual(primary.packetLog, []);
  assert.deepEqual(auxiliary.packetLog, [[0, true]]);
  clock.advance(100);
  assert.deepEqual(auxiliary.packetLog, [[0, true], [0, true]]);

  // P2's native frame can stay hidden while it is the active playing host;
  // only its explicit verification state should block a routed pulse.
  auxiliary.menu.isOpen = true;
  clock.advance(100);
  assert.deepEqual(auxiliary.packetLog, [[0, true], [0, true], [0, true]]);
  manager.aux.needsVerification = true;
  clock.advance(100);
  assert.equal(controller.running, false);
  assert.deepEqual(auxiliary.packetLog, [[0, true], [0, true], [0, true]]);

  auxiliary.actions.macroFeed(false);
  clock.advance(500);
  assert.equal(controller.running, false);
  assert.deepEqual(auxiliary.nativeMacroCalls, []);
});

test('readiness follows routed myCells and timer pulses stop for menu or hidden document', () => {
  const host = makeHost('primary');
  host.world = { myCells: [new Set()] };
  const { clock, document, controller } = makeEnvironment({ host, intervalMs: 100 });

  host.actions.macroFeed(true);
  assert.equal(controller.running, false);
  assert.deepEqual(host.packetLog, []);

  host.world.myCells[0].add({ removed: false });
  host.actions.macroFeed(true);
  assert.deepEqual(host.packetLog, [[0, true]]);
  host.menu.isOpen = true;
  clock.advance(100);
  assert.equal(controller.running, false);
  assert.deepEqual(host.packetLog, [[0, true]]);

  host.menu.isOpen = false;
  host.actions.macroFeed(true);
  assert.deepEqual(host.packetLog, [[0, true], [0, true]]);
  document.hidden = true;
  clock.advance(100);
  assert.equal(controller.running, false);
  assert.deepEqual(host.packetLog, [[0, true], [0, true]]);
});

test('multibox readiness checks the routed auxiliary cell, not primary player state', () => {
  const primary = makeHost('primary');
  const auxiliary = makeHost('auxiliary');
  primary.player.isAlive = false;
  primary.world = { myCells: [new Set()] };
  auxiliary.player.isAlive = false;
  auxiliary.world = { myCells: [new Set([{ removed: false }])] };
  const manager = {
    multi: true,
    active: 1,
    aux: { host: auxiliary },
    host: slot => slot === 0 ? primary : auxiliary,
    packetAction(method, slot, ...args) {
      return this.host(slot).packets.feed(0, ...args);
    },
    releaseFeed() {},
    destroyAux() {},
    dispose() {},
  };
  const { controller } = makeEnvironment({ manager, host: primary, intervalMs: 100 });

  primary.actions.macroFeed(true);
  assert.equal(controller.targetSlot, 1);
  assert.deepEqual(primary.packetLog, []);
  assert.deepEqual(auxiliary.packetLog, [[0, true]]);
});

test('four-slot custom feed routes slots 0,1,2,3 without injecting switch pulses',()=>{
 const primary=makeHost('primary'),aux=makeHost('aux'),manager={multi:true,active:0,primary,sourceSlotCount:2,aux:{host:aux},
   slots:()=>[0,1,2,3],nativeSlot:s=>s%2,host:s=>s<2?primary:aux,
   packetAction(method,s,...args){return this.host(s).packets.feed(s%2,...args);},select(s){this.active=s;this.host(s).player.activeTab=s%2;return true;},releaseFeed(){},destroyAux(){},dispose(){}};
 const {clock,controller}=makeEnvironment({host:primary,manager,intervalMs:100});primary.actions.macroFeed(true);
 for(const slot of [1,2,3,0]){clock.advance(40);const before=primary.packetLog.length+aux.packetLog.length;manager.select(slot);assert.equal(primary.packetLog.length+aux.packetLog.length,before);clock.advance(60);assert.equal(controller.targetSlot,slot);assert.equal(manager.host(slot).packetLog.at(-1)[0],slot%2);}
 primary.actions.macroFeed(false);const n=primary.packetLog.length+aux.packetLog.length;clock.advance(200);assert.equal(primary.packetLog.length+aux.packetLog.length,n);
});
test('native feed stops the old host before starting the newly selected host',()=>{
 const p=makeHost('primary'),a=makeHost('aux'),order=[];
 for(const h of[p,a])h.actions.macroFeed=state=>{order.push([h.name,state,h.player.activeTab]);h.actions.isMacroFeeding=state;};
 const m={multi:true,active:0,primary:p,sourceSlotCount:2,aux:{host:a},slots:()=>[0,1,2,3],nativeSlot:s=>s%2,host:s=>s<2?p:a,
   select(s){this.active=s;this.host(s).player.activeTab=s%2;return true;},releaseFeed(){},destroyAux(){},dispose(){}};
 const {controller}=makeEnvironment({host:p,manager:m,intervalMs:0});p.actions.macroFeed(true);m.select(3);
 assert.deepEqual(order,[['primary',true,0],['primary',false,0],['aux',true,1]]);p.actions.macroFeed(false);
 assert.deepEqual(order.at(-1),['aux',false,1]);assert.equal(p.actions.isMacroFeeding,false);assert.equal(a.actions.isMacroFeeding,false);
});


// Held-input regressions: transport commands are not the physical key state.
const key = (type, code='KeyW') => ({type, code, repeat:false});
function dualEnvironment(intervalMs=0) {
  const p=makeHost('primary'),a=makeHost('aux');
  p.settings.hkMacroFeed='W';
  for(const h of [p,a])h.world={myCells:[new Map([[1,{removed:false}]]),new Map([[2,{removed:false}]])]};
  const m={multi:true,active:0,primary:p,sourceSlotCount:2,aux:{host:a},slots:()=>[0,1,2,3],nativeSlot:s=>s%2,host:s=>s<2?p:a,
    packetAction(method,s,...args){return this.host(s).packets.feed(s%2,...args);},
    select(s){this.active=s;this.host(s).player.activeTab=s%2;return true;},releaseFeed(){},destroyAux(){},dispose(){}};
  return {...makeEnvironment({manager:m,host:p,intervalMs}),manager:m,auxiliary:a};
}
for(const intervalMs of [0,10,100]) {
  test(`held key survives repeated four-slot switches, interval ${intervalMs}`,()=>{
    const {host,auxiliary,controller,manager,clock}=dualEnvironment(intervalMs);
    controller.handleKeyboard(key('keydown'),'W');
    for(const slot of [1,2,3,0,2,1,3]){
      manager.select(slot);clock.advance(110);
      assert.equal(controller.snapshot().held,true);assert.equal(controller.targetSlot,slot);
      if(!intervalMs){assert.equal(manager.host(slot).actions.isMacroFeeding,true);assert.equal((slot<2?auxiliary:host).actions.isMacroFeeding,false);}
    }
    controller.handleKeyboard(key('keyup'),'W');clock.advance(300);
    assert.equal(controller.snapshot().held,false);assert.equal(clock.jobs.size,0);
    assert.equal(host.actions.isMacroFeeding,false);assert.equal(auxiliary.actions.isMacroFeeding,false);
  });
  test(`held feed waits for a spawn and resumes without a second press, interval ${intervalMs}`,()=>{
    const {host,auxiliary,controller,manager,clock}=dualEnvironment(intervalMs);
    auxiliary.world.myCells[1].clear();controller.handleKeyboard(key('keydown'),'W');manager.select(3);
    assert.equal(controller.snapshot().held,true);assert.equal(controller.snapshot().waitingForPlayer,true);
    const n=auxiliary.packetLog.length;clock.advance(400);assert.equal(auxiliary.packetLog.length,n);
    auxiliary.world.myCells[1].set(2,{removed:false});clock.advance(110);
    assert.equal(controller.snapshot().waitingForPlayer,false);assert.equal(controller.targetSlot,3);
    if(intervalMs)assert.ok(auxiliary.packetLog.length>n);else assert.equal(auxiliary.actions.isMacroFeeding,true);
    controller.handleKeyboard(key('keyup'),'W');assert.equal(clock.jobs.size,0);
    assert.equal(host.actions.isMacroFeeding,false);assert.equal(auxiliary.actions.isMacroFeeding,false);
  });
  test(`keyup during pending spawn prevents delayed restart, interval ${intervalMs}`,()=>{
    const {auxiliary,controller,manager,clock}=dualEnvironment(intervalMs);
    auxiliary.world.myCells[0].clear();controller.handleKeyboard(key('keydown'),'W');manager.select(2);
    controller.handleKeyboard(key('keyup'),'W');auxiliary.world.myCells[0].set(1,{removed:false});clock.advance(20000);
    assert.equal(controller.snapshot().held,false);assert.equal(auxiliary.packetLog.length,0);
    assert.equal(auxiliary.actions.isMacroFeeding,false);assert.equal(clock.jobs.size,0);
  });
}
test('physical release uses key code, even after modifier spelling changes',()=>{
  const {controller,host}=dualEnvironment();host.settings.hkMacroFeed='CTRL+W';
  controller.handleKeyboard(key('keydown'),'CTRL+W');assert.equal(controller.snapshot().held,true);
  controller.handleKeyboard(key('keyup'),'W');assert.equal(controller.snapshot().held,false);
});
test('an old transfer token cannot restart a released key',()=>{
  const {controller,manager}=dualEnvironment();controller.handleKeyboard(key('keydown'),'W');
  const token=controller.beforeSwitch();controller.handleKeyboard(key('keyup'),'W');manager.active=2;
  assert.equal(controller.afterSwitch(token,2),false);assert.equal(controller.snapshot().held,false);
});
test('keyboard and mouse feed share hold intent without releasing each other',()=>{
  const {host,controller}=dualEnvironment();host.settings.middleClick='macroFeed';
  controller.handleKeyboard(key('keydown'),'W');controller.handleMouse({type:'mousedown',button:1});
  controller.handleMouse({type:'mouseup',button:1});assert.equal(controller.snapshot().held,true);
  controller.handleKeyboard(key('keyup'),'W');assert.equal(controller.snapshot().held,false);
});
test('auxiliary native false is not a physical W release',()=>{
  const {auxiliary,controller,manager}=dualEnvironment();controller.handleKeyboard(key('keydown'),'W');manager.select(2);
  auxiliary.actions.macroFeed(false);assert.equal(controller.snapshot().held,true);
  controller.handleKeyboard(key('keyup'),'W');assert.equal(auxiliary.actions.isMacroFeeding,false);
});
test('auxiliary initial cleanup and hidden menu do not cancel pending held feed',()=>{
  const {auxiliary,controller,manager,clock}=dualEnvironment();auxiliary.world.myCells[0].clear();
  controller.handleKeyboard(key('keydown'),'W');manager.select(2);
  auxiliary.emitBus(auxiliary.events.Socket_Cleanup);auxiliary.menu.show();auxiliary.emitBus(auxiliary.events.Show_Menu,true);
  assert.equal(controller.snapshot().held,true);auxiliary.world.myCells[0].set(1,{removed:false});clock.advance(40);
  assert.equal(auxiliary.actions.isMacroFeeding,true);controller.release('test-end');
});
test('waiting is bounded and does not enqueue feed into an unavailable source',()=>{
  const {auxiliary,controller,manager,clock}=dualEnvironment(10);auxiliary.world.myCells[0].clear();
  controller.handleKeyboard(key('keydown'),'W');manager.select(2);clock.advance(15100);
  assert.equal(controller.snapshot().held,false);assert.equal(controller.lastReleaseReason,'player-ready-timeout');
  assert.equal(auxiliary.packetLog.length,0);assert.equal(clock.jobs.size,0);
});
test('an inactive native slot dying does not cancel the selected slot feed',()=>{
  const {host,controller}=dualEnvironment();controller.handleKeyboard(key('keydown'),'W');host.world.myCells[1].clear();
  host.emitBus(host.events.Player_Died);assert.equal(controller.snapshot().held,true);controller.release('test-end');
});
for(const reason of ['blur','hidden','menu','disconnect','verification'])test(`held input still stops safely for ${reason}`,()=>{
 const {host,auxiliary,controller,manager,clock,window,document}=dualEnvironment(10);
 controller.handleKeyboard(key('keydown'),'W');
 if(reason==='blur')window.dispatch('blur');
 if(reason==='hidden'){document.hidden=true;document.dispatch('visibilitychange');}
 if(reason==='menu')host.menu.show();
 if(reason==='disconnect')host.emitBus(host.events.Socket_Cleanup);
 if(reason==='verification'){manager.select(2);manager.aux.needsVerification=true;clock.advance(10);}
 assert.equal(controller.snapshot().held,false);assert.equal(clock.jobs.size,0);
 controller.handleKeyboard({...key('keydown'),repeat:true},'W');assert.equal(controller.snapshot().held,false);
});

for(const intervalMs of [0,10])test(`old-API regression: held macro survives pending-player selection (${intervalMs} ms)`,()=>{
  const {host,auxiliary,controller,manager,clock}=dualEnvironment(intervalMs);
  auxiliary.world.myCells[0].clear();host.actions.macroFeed(true);manager.select(2);clock.advance(100);
  auxiliary.world.myCells[0].set(1,{removed:false});clock.advance(120);
  if(intervalMs)assert.ok(auxiliary.packetLog.length>0,'No feed after pending player became ready');
  else assert.equal(auxiliary.actions.isMacroFeeding,true,'Native macro did not resume');
  host.actions.macroFeed(false);assert.equal(clock.jobs.size,0);
});
