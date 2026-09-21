/* Native FFA and WindBine multibox.
 *
 * FFA has one assigned slot per connection; WindBine has two. Two connections
 * are created automatically after an FFA handshake, or on request in WindBine. The server remains authoritative for assignment,
 * spawning and all cell coordinates.
 */
class SenpaMultibox {
  constructor(port, primary, createEngine) {
    this.port = port; this.primary = primary; this.createEngine = createEngine;
    this.aux = null; this.loading = null; this.generation = 0; this.active = 0; this.activePair = 0;
    this.feedTransactions=true;this.intent = null; this.status = 'Off'; this.error = ''; this.lastSync = 0;
    this.lastAlive = [false, false, false, false]; this.lastCursor = [null, null, null, null]; this.closed = false;
    this.empty = new Map(); this.view = null; this.retired = new WeakSet();
    this.ownedSources = new Map(); this.authValue = undefined;
    this.lastPrimaryGeneration = primary.network.connectionGeneration;
    this.connectingEndpoint=null;this.lastAuxFrame=-1;
    this.accountSkinFallback=[primary.player.skin1||'',primary.player.skin2||''];
    let saved; try { saved = JSON.parse(localStorage.getItem('ryuten.senpa.v1.multibox') || 'null'); } catch {}
    this.windbineEnabled = saved?.enabled === true;
    this.ffaEnabled = saved?.ffaEnabled !== false;
    this.ffaAutoConnect = saved?.ffaAutoConnect !== false;
    this.autoFFASocket = null; // One automatic startup attempt per primary connection.
    this.nearSpawn = saved?.nearSpawn !== false;
    this.profiles = [0,1].map(i => this.sanitizeProfile(saved?.profiles?.[i] || {}, i));
    this.original = {};
    this.installInput(); this.installPrimaryLifecycle();
  }
  sanitizeProfile(raw, slot) {
    const name = typeof raw.name === 'string' ? raw.name.replace(/[\u0000\r\n]/g, '').slice(0,30) : '';
    let url = ''; try { const u = new URL(raw.url || ''); if (u.protocol==='https:' && !u.username && !u.password) url=u.href; } catch {}
    return { name, skinMode: ['account','url','none'].includes(raw.skinMode) ? raw.skinMode : 'account', url: url.slice(0,2048) };
  }
  persist() { try { localStorage.setItem('ryuten.senpa.v1.multibox', JSON.stringify({version:4,enabled:this.windbineEnabled,ffaEnabled:this.ffaEnabled,ffaAutoConnect:this.ffaAutoConnect,nearSpawn:this.nearSpawn,profiles:this.profiles})); } catch {} }
  get isWindBine() { const s=this.server();return /^windbine$/i.test(String(s?.name||'').trim()); }
  get isFFA() { const s=this.server();return String(s?.mode||'').toLowerCase()==='ffa'||/^free[ -]?for[ -]?all$/i.test(String(s?.modeName||'')); }
  get enabled() { return this.isFFA?this.ffaEnabled:this.windbineEnabled; }
  set enabled(value) { if(this.isFFA)this.ffaEnabled=!!value;else this.windbineEnabled=!!value; }
  setFFAEnabled(value) { if(value)this.autoFFASocket=null;this.ffaEnabled=!!value;this.persist();if(this.isFFA&&!this.ffaEnabled)this.destroyAux();this.port.child?.refreshMultiboxUI?.(); }
  setFFAAutoConnect(value) { this.ffaAutoConnect=!!value;this.persist();if(value)this.autoFFASocket=null;this.port.child?.refreshMultiboxUI?.(); }
  maybeAutoConnectFFA() {
    if(this.closed||!this.ffaAutoConnect||!this.isFFA||!this.multi||!this.ready(this.primary)||this.aux||this.loading)return false;
    const socket=this.primary.network.ws;
    if(!socket||socket===this.autoFFASocket)return false;
    // Mark before starting async initialization, so failure cannot create a RAF retry storm.
    this.autoFFASocket=socket;void this.ensureAux();return true;
  }
  setWindBineEnabled(value) { this.windbineEnabled=!!value;this.persist();if(this.isWindBine&&!value)this.destroyAux();this.port.child?.refreshMultiboxUI?.(); }
  get isSupported() { return this.isFFA||this.isWindBine; }
  get sourceSlotCount() { return this.isFFA?1:2; }
  tabCount() { return this.multi ? this.sourceSlotCount*2 : Math.max(2,this.primary.world.myPlayerIDs.length); }
  profileIndex(slot) { return Math.floor(Math.max(0,slot)/this.sourceSlotCount); }
  sourceIndex(slot) { return Math.floor(Math.max(0,slot)/this.sourceSlotCount); }
  nativeSlot(slot) { return Math.max(0,slot)%this.sourceSlotCount; }
  pairSlot(pair, nativeSlot=0) { return pair*this.sourceSlotCount+Math.max(0,Math.min(this.sourceSlotCount-1,nativeSlot)); }
  slots() { return Array.from({length:this.enabled&&this.isSupported?this.sourceSlotCount*2:Math.max(2,this.primary.world.myPlayerIDs.length)},(_,i)=>i); }
  profile(slot, patch) {
    if(slot!==0&&slot!==1)return;
    if(patch){this.profiles[slot]=this.sanitizeProfile({...this.profiles[slot],...patch},slot);this.persist();this.port.child?.refreshMultiboxUI?.();}
    return this.profiles[slot];
  }
  setNearSpawn(value) { this.nearSpawn=!!value;this.persist();this.error='';this.status=this.nearSpawn?'Nearby WindBine spawns enabled — empty pairs follow the active pair.':'Nearby WindBine spawns disabled — use native server spawn.';this.port.child?.refreshMultiboxUI?.(); }
  setEnabled(value) {
    const wasMulti=this.multi;if(value)this.autoFFASocket=null;this.enabled=!!value;this.persist();this.error='';
    if(!this.enabled&&wasMulti)this.primary.player.skin1=this.accountSkin(0);
    if(!this.enabled){this.destroyAux();this.status='Off';}
    else this.status=this.isSupported?'Ready — select a player':'Multibox is available on FFA and WindBine';
    this.port.child?.refreshMultiboxUI?.();
  }
  server() { const host=this.primary.network.url||this.port.selected; return this.port.tracker?.servers.find(s=>s.host===host); }
  get multi() { return this.enabled&&this.isSupported&&!this.primary.network.isReplay&&this.primary.world.myPlayerIDs.length===this.sourceSlotCount; }
  get anyAlive() { return this.multi ? this.slots().some(slot=>this.alive(slot)) : this.primary.player.isAlive; }
  host(slot=this.active) { return this.multi&&this.sourceIndex(slot)===1 ? this.aux?.host : this.primary; }
  alive(slot) { const h=this.host(slot),native=this.nativeSlot(slot);return !!h&&(!this.multi||h.network.connected)&&!!h.world.myCells[this.multi?native:slot]?.size; }
  pairAlive(pair) { if(!this.isWindBine)return this.alive(pair);return this.alive(this.pairSlot(pair,0))||this.alive(this.pairSlot(pair,1)); }
  ready(h) { return !!h?.network.connected&&!h.network.blockReconnect&&!!h.packets.handshakeDone&&h.world.myPlayerIDs.length===this.sourceSlotCount; }
  wantsSecondary() { return this.multi&&this.sourceIndex(this.intent?.slot??-1)===1; }
  notify(message) { this.error=message; this.port.notify(message); }
  accountSkin(slot) {
    const h=this.primary,a=h.store.account;
    if(a&&typeof a==='object'&&!a.error){
      try{return h.accountSkins(a,h.store.profiles?.selected||0)[slot]||'';}catch{}
    }
    const current=slot===1?h.player.skin2:h.player.skin1;
    if(current)this.accountSkinFallback[slot]=current;
    return current||this.accountSkinFallback[slot]||'';
  }
  setProfileIdentity(slot,h) {
    const pair=this.profileIndex(slot),p=this.profiles[pair];
    h.player.nick=p.name || this.primary.player.nick || 'Unnamed cell';
    h.player.teamTag=this.primary.player.teamTag;
    // WindBine assigns two native tabs per connection. A pair therefore shares
    // one profile name, while both tabs retain the real Senpa skin and hat slots
    // (or the explicitly selected local cosmetic mode).
    const skins=p.skinMode==='account'?(this.isFFA?[this.accountSkin(pair),'']:[this.accountSkin(0),this.accountSkin(1)]):p.skinMode==='url'?[p.url,p.url]:['',''];
    h.player.skin1=skins[0]||'';h.player.skin2=skins[1]||'';
    h.player.hat1=(this.isFFA&&pair===1?this.primary.player.hat2:this.primary.player.hat1)||0;h.player.hat2=this.primary.player.hat2||0;
    if(h!==this.primary){
      const token=this.primary.auth.authToken;
      if(h.auth.authToken!==token)h.auth.setAuthToken(token);
    }
  }
  setActiveSlot(slot) {
    const h=this.host(slot),native=this.nativeSlot(slot);
    if(h?.player)h.player.activeTab=native;
    this.active=slot;this.activePair=this.sourceIndex(slot);return h;
  }
  select(slot) {
    if(!this.multi||!this.slots().includes(slot)||!this.alive(slot))return false;
    if(slot===this.active)return true;
    const feed=this.port.child?.feedTiming;
    const transaction=feed?.beforeSwitch?.();
    const old=this.host(),feeding=!feed&&old?.actions.isMacroFeeding;
    if(feeding)this.call(old,'macroFeed',false);
    this.port.child?.lineSplit?.cancel?.('switch');
    this.setActiveSlot(slot);
    if(feed)feed.afterSwitch?.(transaction,slot);
    else if(feeding&&this.primary.settings.feedFollowsTab)this.call(this.host(),'macroFeed',true);
    this.primary.actions.sendMouse();
    this.copyCamera();this.port.child?.hideMenu?.();this.port.child?.updateTabs?.();return true;
  }
  requestPair(pair) {
    if(!this.isWindBine||(pair!==0&&pair!==1))return false;
    const h=this.host(this.pairSlot(pair,0));
    let native=h?.player?.activeTab===1?1:0;
    if(!this.alive(this.pairSlot(pair,native)))native=this.alive(this.pairSlot(pair,1-native))?1-native:0;
    return this.request('switch',this.pairSlot(pair,native));
  }
  request(kind,index) {
    // Before assignment, retain the request but never invent a server-native slot.
    if(!this.enabled||!this.isSupported||this.primary.network.isReplay)return false;
    const expected=this.sourceSlotCount;
    if(this.primary.world.myPlayerIDs.length && this.primary.world.myPlayerIDs.length!==expected)return false;
    if(kind==='spectate'){
      this.intent=null;
      if(this.anyAlive){this.notify('A multibox player is alive. Select a player or pair to resume.');return true;}
      return false; // Original Senpa spectator path; no extra spectator connection.
    }
    if(kind==='pair')return this.requestPair(index);
    let slot;
    if(Number.isInteger(index))slot=index;
    else if(kind==='switch-pair')slot=this.pairSlot(1-this.activePair,this.host(this.active)?.player?.activeTab||0);
    else if(kind==='switch')slot=this.isFFA?1-this.active:this.pairSlot(this.activePair,1-this.nativeSlot(this.active));
    else slot=this.active;
    if(!this.slots().includes(slot))return true;
    if(!this.multi){
      if(this.primary.world.myPlayerIDs.length)return false;
      this.intent={slot,sent:false,sentAt:0,positionedAt:null,anchor:null,createdAt:performance.now(),socket:null,endpoint:this.primary.network.url||this.port.selected};
      this.port.ensureConnection();return true;
    }
    if(this.alive(slot)){this.select(slot);return true;}
    const feed=this.port.child?.feedTiming, feedToken=feed?.beforeSwitch?.();
    this.port.child?.lineSplit?.cancel?.('spawn-switch');
    this.active=slot;this.activePair=this.sourceIndex(slot);
    feed?.afterSwitch?.(feedToken,slot);
    if(this.intent?.slot!==slot)this.intent={slot,sent:false,sentAt:0,positionedAt:null,anchor:null,createdAt:performance.now(),socket:null,endpoint:this.primary.network.url||this.port.selected};
    this.error='';this.port.ensureConnection();this.flush();return true;
  }
  async ensureAux() {
    if(!this.multi||!this.ready(this.primary)||this.aux||this.loading||this.closed)return;
    const generation=this.generation, endpoint=this.primary.network.url;
    this.status='Starting pair 2 native engine';
    const pending=(async()=>{
      const engine=await this.createEngine(this);
      if(this.closed||generation!==this.generation||!this.multi||endpoint!==this.primary.network.url){engine.dispose();return;}
      this.aux=engine;this.authValue=undefined;this.syncPreferences();this.installAuxLifecycle(engine);
      this.port.child?.motion?.watchHost?.(engine.host,engine.clockOffset);
      this.setProfileIdentity(this.sourceSlotCount,engine.host);
       this.status='Connecting pair 2';engine.host.network.connect(endpoint);this.copyCamera();
    })().catch(e=>{if(generation===this.generation){this.notify('Pair 2 could not start: '+String(e.message));this.status='Pair 2 startup failed';this.intent=null;}})
      .finally(()=>{if(this.loading===pending)this.loading=null;});
    this.loading=pending;return pending;
  }
  installAuxLifecycle(engine) {
    const h=engine.host,on=(name,fn)=>h.bus.register(h.events[name],(...args)=>{if(this.aux===engine&&!this.closed)fn(...args);});
    on('Request_Captcha',()=>{this.status='Pair 2 verification required';engine.needsVerification=true;engine.show();});
    on('Socket_Connected',()=>{this.status='Pair 2 handshake';this.error='';engine.connectedOnce=true;});
    on('Socket_Blocked',code=>{this.intent=null;this.status='Pair 2 refused by Senpa';this.notify('Senpa refused pair 2 (code '+code+'). Pair 1 was not disconnected.');});
    on('Server_Message_Update',text=>{if(text){this.status=String(text).slice(0,200);}});
    on('Socket_Cleanup',()=>{if(this.intent&&this.sourceIndex(this.intent.slot)===1){this.intent.sent=false;this.intent.positionedAt=null;this.intent.socket=null;}this.status=engine.connectedOnce?'Pair 2 reconnecting':'Connecting pair 2';});
    on('Player_Spawned',()=>{engine.needsVerification=false;engine.hide();this.status='Pair 2 playing';});
    // Never allow background native UI auto-connect/replay to move pair 2 to another server.
    const connect=h.network.connect.bind(h.network);
    h.network.connect=(url,...args)=>url===this.primary.network.url&&this.multi?connect(url,...args):false;
    const custom=h.network.connectCustomGame;
    h.network.connectCustomGame=()=>false;
    const sendMouse=h.actions.sendMouse;
    h.actions.sendMouse=()=>{}; // One primary 40ms input scheduler owns both connections.
    const update=h.camera.update;
    h.camera.update=()=>{}; // One visible camera, not one integrator per iframe.
    engine.restore=()=>{h.actions.sendMouse=sendMouse;h.camera.update=update;h.network.connectCustomGame=custom;};
    this.instrumentNative(h,1);
  }
  installPrimaryLifecycle() {
    const h=this.primary,on=(name,fn)=>h.bus.register(h.events[name],fn);
    on('Socket_Cleanup',()=>{
      const pending=this.intent;
      const endpoint=this.connectingEndpoint||h.network.url||this.port.selected;
      this.destroyAux();
      // Initial native connect calls cleanup before opening. Do not lose that user's P2 request.
      if(pending&&pending.endpoint===endpoint&&this.enabled){pending.sent=false;pending.socket=null;this.intent=pending;}
      this.view=null;
    });
    on('Socket_Connected',()=>{this.connectingEndpoint=null;});
    on('Socket_Blocked',()=>{this.destroyAux();});
    on('Replay_Bar',data=>{if(data?.show)this.destroyAux();});
    this.instrumentNative(h,0);
  }
  beforeConnect(endpoint,preserveIntent=false) {
    this.connectingEndpoint=endpoint;
    if(!preserveIntent||this.intent&&this.intent.endpoint!==endpoint)this.intent=null;
  }
  dispatchInput(device,type,event) {
    const input=this.primary.input[device];if(!input)return;
    if(this.primary.menu.isChatFocused||event?.target?.isContentEditable||event?.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    if(!this.multi)return input.handleEvent(type,event);
    // Native key eligibility originally reads only the primary player's isAlive. The
    // active pair-2 player still owns its real parser state: expose it just for the
    // synchronous input gate, then restore.
    const alive=!!this.host()?.player.isAlive,p=this.primary.player;
    const descriptor=Object.getOwnPropertyDescriptor(p,'isAlive');
    Object.defineProperty(p,'isAlive',{configurable:true,get:()=>alive});
    try{return input.handleEvent(type,event);}finally{
      if(descriptor)Object.defineProperty(p,'isAlive',descriptor);else delete p.isAlive;
    }
  }
  packetAction(method,slot,...args) {
    if(!this.multi)return this.primary.packets[method]?.(slot,...args);
    if(!this.slots().includes(slot))return;
    const h=this.host(slot),native=this.nativeSlot(slot);if(h&&this.ready(h))return h.packets[method]?.(native,...args);
  }
  instrumentNative(h,slot) {
    // Native parser remains authoritative. Prevent packet-info refresh from replacing slot identity.
    const spawn=h.packets.spawn.bind(h.packets);
    h.packets.spawn=index=>{
      if(this.multi){
        const native=Number.isInteger(index)?Math.max(0,Math.min(this.sourceSlotCount-1,index)):h.player.activeTab||0;
        this.setProfileIdentity(slot*this.sourceSlotCount,h);h.player.activeTab=native;index=native;
      }
      return spawn(index);
    };
  }
  call(host,name,...args) {
    if(!host)return;
    if(host===this.primary&&this.original[name])return this.original[name](...args);
    return host.actions[name]?.(...args);
  }
  installInput() {
    const h=this.primary;
    for(const name of ['feed','macroFeed','split','doubleSplit','tripleSplit','split16','split32','split64','stop','sendEmoji','toggleSpectateMode']){
      const original=h.actions[name].bind(h.actions);this.original[name]=original;
      h.actions[name]=(...args)=>{
        if(name==='feed'||name.startsWith('split')||name==='doubleSplit'||name==='tripleSplit')h.actions.sendMouse();
        return this.multi?this.call(this.host(),name,...args):original(...args);
      };
    }
    const toggle=h.actions.togglePlayer.bind(h.actions);
    h.actions.togglePlayer=()=>this.enabled&&this.isSupported?this.port.request('switch'):toggle();
    const chat=h.packets.chat.bind(h.packets);
    h.packets.chat=(...args)=>{
      const target=this.multi?this.host():h;
      // Never recurse through this wrapper when primary owns the active tab.
      return target&&target!==h&&target.network.connected?target.packets.chat(...args):chat(...args);
    };
    const send=h.actions.sendMouse.bind(h.actions);
    h.actions.sendMouse=()=>{
      if(!this.multi)return send();
      this.copyCamera();
      const active=this.host();
      let x,y;
      if(active&&!active.player.isStopped){
        const canvas=h.renderer.canvas,ratio=canvas.width/Math.max(1,window.innerWidth);
        const zoom=Math.max(.0001,h.camera.zoom*ratio);
        x=h.camera.x+(h.input.mouse.x*ratio-canvas.width/2)/zoom;
        y=h.camera.y+(h.input.mouse.y*ratio-canvas.height/2)/zoom;
        if(Number.isFinite(x)&&Number.isFinite(y))this.lastCursor[this.active]={x,y};
      }
      for(const slot of this.slots()){
        const host=this.host(slot),native=this.nativeSlot(slot);if(!host||!this.ready(host)||host.player.isStopped)continue;
        // Keep one cursor per native slot; switching a pair must not overwrite
        // the inactive tab's target.
        const point=this.lastCursor[slot];if(point&&this.alive(slot))host.packets.cursor(point.x,point.y,native);
        else if(slot===this.active&&!this.alive(slot)&&host.player.isSpectating&&Number.isFinite(x)&&Number.isFinite(y))host.packets.cursor(x,y,native);
      }
    };
    const camera=h.camera.update.bind(h.camera);
    h.camera.update=(...args)=>{
      this.advanceAux(performance.now());this.auxFramePrepared=true;
      if(!this.multi||!this.anyAlive)return camera(...args);
      const centers=[],radii=[];
      for(const slot of this.slots()){
        const host=this.host(slot),native=this.nativeSlot(slot);if(!host)continue;
        let x=0,y=0,n=0;for(const cell of host.world.myCells[native]?.values()||[]){if(cell.removed)continue;x+=cell.x;y+=cell.y;n++;radii.push(cell.radius);}
        if(n)centers.push({x,y,n});
      }
      if(!centers.length)return camera(...args);
      // Captured Senpa B.update: mean of every living own cell (not a mean of means).
      // Active-tab changes do not reset targetZoom, camera position, or integration.
      const before={x:h.player.x,y:h.player.y,auto:h.camera.autoZoom};
      const descriptor=Object.getOwnPropertyDescriptor(h.player,'isAlive');
      const count=centers.reduce((s,c)=>s+c.n,0);
      h.player.x=centers.reduce((s,c)=>s+c.x,0)/count;
      h.player.y=centers.reduce((s,c)=>s+c.y,0)/count;
      h.camera.autoZoom=Math.pow(Math.min(64/Math.max(1,radii.reduce((s,r)=>s+r,0)),1),.4)*Math.max(window.innerWidth/1920,window.innerHeight/1080);
      Object.defineProperty(h.player,'isAlive',{configurable:true,get:()=>true});
      try{return camera(...args);}finally{
        if(descriptor)Object.defineProperty(h.player,'isAlive',descriptor);else delete h.player.isAlive;
        h.player.x=before.x;h.player.y=before.y;h.camera.autoZoom=before.auto;
        this.copyCamera();
      }
    };
  }
  releaseFeed() { for(const h of [this.primary,this.aux?.host])if(h?.actions.isMacroFeeding)this.call(h,'macroFeed',false); }
  copyCamera() {
    const a=this.aux?.host;if(!a)return;const p=this.primary;
    a.camera.x=p.camera.x;a.camera.y=p.camera.y;a.camera.zoom=p.camera.zoom;
    a.input.mouse.x=p.input.mouse.x;a.input.mouse.y=p.input.mouse.y;
  }
  syncPreferences() {
    const h=this.aux?.host;if(!h)return;
    for(const key of Object.keys(this.primary.settingsStore.definitions)){
      if(key==='useWebGL'||key==='instantReplay')continue;
      const value=this.primary.settings[key];if(h.settings[key]!==value)h.settings[key]=value;
    }
    h.player.teamTag=this.primary.player.teamTag;
    const token=this.primary.auth.authToken;
    if(this.authValue!==token){this.authValue=token;h.auth.setAuthToken(token);}
    // Native sendEmoji checks equipped slots in its own realm. Share the real
    // account selection, not a fabricated local emoji or a persistent token.
    const emojis=this.primary.auth.emojiSlots;
    if(JSON.stringify(h.auth.emojiSlots)!==JSON.stringify(emojis))h.auth.setEmojiSlots(emojis);
  }
  advanceAux(now) {
    if(!this.aux||now===this.lastAuxFrame)return;this.lastAuxFrame=now;
    const h=this.aux.host,t=now-this.aux.clockOffset;
    h.loop.time=t;h.player.update(t);h.world.update(t);
  }
  tick(now=performance.now()) {
    if(this.closed)return;
    // A tracker label is not proof of the server's assigned slot width. Never
    // keep a pre-handshake P2 intent pending forever or fabricate a native tab.
    if(this.intent&&this.primary.packets.handshakeDone&&this.primary.world.myPlayerIDs.length&&
       this.primary.world.myPlayerIDs.length!==this.sourceSlotCount){
      this.intent=null;this.status='Using native Senpa tabs: server assignment differs from tracker mode';
      this.notify(this.status+'. Choose a native player to continue.');
    }
    if(!this.multi&&this.aux)this.destroyAux();
    this.maybeAutoConnectFFA();
    if(this.aux&&this.ready(this.primary)&&this.aux.host.packets.handshakeDone&&this.aux.host.world.myPlayerIDs.length){
      const w=this.aux.host.world,p=this.primary.world;
      if(w.myPlayerIDs.length!==this.sourceSlotCount||w.myClientID===p.myClientID||w.myPlayerIDs.some(id=>p.myPlayerIDs.includes(id))){
        this.status='Secondary assignment rejected';this.notify('Senpa did not assign an independent expected slot set. P2 was stopped; P1 stays connected.');
        this.destroyAux();return;
      }
    }
    if(this.aux){
      if(!this.auxFramePrepared)this.advanceAux(now); // No hidden-iframe RAF dependency.
      this.auxFramePrepared=false;
      if(now-this.lastSync>500){this.lastSync=now;this.syncPreferences();}
    }
    if(this.multi){
      const previouslyAlive=this.lastAlive.some(Boolean);
      for(const slot of this.slots()){
        const alive=this.alive(slot);
        if(this.lastAlive[slot]&&!alive&&this.active===slot&&this.primary.settings.autoSwitchCells){
          const sameSource=this.slots().find(candidate=>this.sourceIndex(candidate)===this.sourceIndex(slot)&&this.alive(candidate));
          const next=sameSource??this.slots().find(candidate=>this.alive(candidate));
          if(next!==undefined)this.select(next);
        }
        this.lastAlive[slot]=alive;
      }
      if(previouslyAlive&&!this.lastAlive.some(Boolean)&&this.port.mode==='ryuten')this.port.child?.showMenu?.();
      this.flush();
    }
  }
  spawnAnchor(pair) {
    if(!this.isWindBine)return null;
    const other=this.host(this.pairSlot(1-pair,0));
    if(!other?.network.connected||other.network.url!==this.primary.network.url)return null;
    const valid=cell=>!cell.removed&&Number.isFinite(cell.x)&&Number.isFinite(cell.y)&&Number.isFinite(cell.radius);
    const activeNative=other.player.activeTab===1?1:0;
    const preferred=[...(other.world.myCells[activeNative]?.values()||[])].filter(valid);
    if(preferred.length){
      let x=0,y=0,radius=0;for(const cell of preferred){x+=cell.x;y+=cell.y;radius=Math.max(radius,cell.radius);}
      return {x:x/preferred.length,y:y/preferred.length,radius,pair:1-pair};
    }
    const cells=[];for(const set of other.world.myCells.slice(0,2))for(const cell of set?.values()||[])if(valid(cell))cells.push(cell);
    let anchor=null;for(const cell of cells)if(!anchor||cell.radius>anchor.radius)anchor=cell;
    return anchor?{x:anchor.x,y:anchor.y,radius:anchor.radius,pair:1-pair}:null;
  }
  spectateForSpawn(host) {
    if(!host?.bus||host.player.isSpectating)return true;
    try{host.bus.dispatch(host.events.Request_Spectate);}catch{}
    return !!host.player.isSpectating;
  }
  sendSpawnCursor(host,anchor,native) {
    const mode=host.actions.specMode;
    try{host.actions.specMode=1;host.packets.cursor(anchor.x,anchor.y,native);}finally{host.actions.specMode=mode;}
  }
  flush() {
    const intent=this.intent;if(!intent||!this.enabled||!this.isSupported)return;
    if(!this.ready(this.primary))return;
    if(!this.multi){this.intent=null;this.status='Using native Senpa player tabs';return;}
    const slot=intent.slot;
    if(!this.slots().includes(slot)){this.intent=null;return;}
    const source=this.sourceIndex(slot),native=this.nativeSlot(slot),pair=source;
    if(this.alive(slot)){this.intent=null;this.select(slot);return;}
    if(source===1&&!this.aux){void this.ensureAux();return;}
    const h=this.host(slot);if(!h||h.network.blockReconnect){if(h?.network.blockReconnect)this.intent=null;return;}
    if(!this.ready(h)){if(source===1&&!this.aux?.needsVerification)this.status='Waiting for pair 2 connection / verification';return;}
    if(source===1&&(h.world.myClientID===this.primary.world.myClientID||h.world.myPlayerIDs.some(id=>this.primary.world.myPlayerIDs.includes(id)))){this.notify('Senpa assigned overlapping identities; pair 2 is unavailable for this session.');this.destroyAux();return;}
    if(h.world.myPlayerIDs.length!==this.sourceSlotCount){this.notify('This server did not assign the expected '+this.sourceSlotCount+' native slot(s). The secondary connection was stopped.');this.destroyAux();return;}
    if(intent.socket!==h.network.ws){intent.sent=false;intent.socket=h.network.ws;}
    if(!intent.sent){
      this.setActiveSlot(slot);this.setProfileIdentity(slot,h);
      if(!this.pairAlive(pair)){
        const anchor=this.nearSpawn?(intent.anchor||this.spawnAnchor(pair)):null;
        intent.anchor=anchor||null;
        if(anchor){
          if(intent.positionedAt===null){
            if(!this.spectateForSpawn(h)){this.status='Waiting for native spectator mode before nearby spawn';return;}
            intent.positionedAt=performance.now();
          }
          this.sendSpawnCursor(h,anchor,native);
          const settle=Math.max(100,Math.min(400,h.network.latency||100));
          if(performance.now()-intent.positionedAt<settle){this.status='Positioning pair '+(pair+1)+' near pair '+(anchor.pair+1)+'…';return;}
        }
      }
      h.packets.spawn(native);h.menu.onPlay();intent.sent=true;intent.sentAt=performance.now();
      this.status='Spawn requested for pair '+(pair+1)+', player '+(native+1);this.port.log('multibox-spawn-request',{slot:slot+1,pair:pair+1,nativeSlot:native+1,mode:this.isFFA?'FFA':'WindBine'});
      if(!this.aux?.needsVerification)this.port.child?.hideMenu?.();
    }else if(performance.now()-intent.sentAt>15000&&!this.aux?.needsVerification){
      this.intent=null;this.status='Pair '+(pair+1)+' spawn not acknowledged';
      this.notify(this.status+'. No repeated spawn was sent. Press that slot to retry.');
    }
  }
  snapshot() {
    const slots=this.multi?this.slots():Array.from({length:Math.max(2,this.primary.world.myPlayerIDs.length)},(_,i)=>i);
    const pairs=this.isWindBine?[0,1].map(pair=>{const slot=this.pairSlot(pair,0),h=this.host(slot);return {pair,connected:!!h?.network.connected,ready:this.multi?this.ready(h):!!h?.network.connected,activeTab:h?.player?.activeTab||0,alive:[this.alive(this.pairSlot(pair,0)),this.alive(this.pairSlot(pair,1))],verification:pair===1&&!!this.aux?.needsVerification};}):[];
    return {enabled:this.enabled,ffa:this.isFFA,ffaEnabled:this.ffaEnabled,ffaAutoConnect:this.ffaAutoConnect,autoFFAStartupAttempted:!!this.primary.network.ws&&this.autoFFASocket===this.primary.network.ws,windbine:this.isWindBine,windbineEnabled:this.windbineEnabled,active:this.multi?this.active:this.primary.player.activeTab,activePair:this.activePair,
      mode:this.multi?(this.isFFA?'two-connection FFA':'two-connection WindBine pairs'):'native Senpa tabs',nearSpawn:this.nearSpawn,status:this.status,error:this.error,
      pending:this.intent?.slot??null,slots:slots.map(slot=>({slot,pair:this.sourceIndex(slot),nativeSlot:this.nativeSlot(slot),name:this.profiles[this.profileIndex(slot)]?.name||'',alive:this.alive(slot),
        ready:this.multi?this.ready(this.host(slot)):!!this.primary.network.connected,connected:!!this.host(slot)?.network.connected,verification:this.sourceIndex(slot)===1&&!!this.aux?.needsVerification})),pairs};
  }
  destroyAux() {
    // Respect an explicit disconnect / refused startup until a new P1 socket or manual retry.
    this.autoFFASocket=this.primary.network.ws||null;
    this.generation++;this.loading=null;this.intent=null;this.active=0;this.activePair=0;this.releaseFeed();
    const old=this.aux;this.aux=null;if(old)old.dispose();
    this.view=null;this.retired=new WeakSet();this.ownedSources.clear();this.lastCursor=[null,null,null,null];this.lastAlive=[false,false,false,false];this.lastAuxFrame=-1;
  }
  dispose() {this.closed=true;this.destroyAux();}
}

/* Independent native WASM+network state in a same-origin, non-rendering engine frame.
 * The frame is shown only for Senpa's real verification/account UI when requested.
 */
async function createSenpaAuxEngine(controller) {
  const parentPort=controller.port,generation=controller.generation;
  const frame=document.createElement('iframe');frame.id='senpa-multibox-engine';frame.title='Senpa P2 verification';
  frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;visibility:hidden;pointer-events:none;z-index:2147483630';
  document.body.append(frame);
  const win=frame.contentWindow;
  const intervals=new Set(),timeouts=new Set();let disposed=false;
  const setI=win.setInterval.bind(win),setT=win.setTimeout.bind(win),clearI=win.clearInterval.bind(win),clearT=win.clearTimeout.bind(win);
  win.setInterval=(fn,ms,...args)=>{const id=setI(fn,ms,...args);intervals.add(id);return id;};
  win.setTimeout=(fn,ms,...args)=>{let id=setT(()=>{timeouts.delete(id);if(!disposed)fn(...args);},ms);timeouts.add(id);return id;};
  const storage=new Map();
  // Secondary UI preferences are isolated, never writing over the primary nickname/profile.
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('senpaio:'))storage.set(k,localStorage.getItem(k));}
  storage.delete('senpaio:server');
  const memory={getItem:k=>storage.get(String(k))??null,setItem:(k,v)=>storage.set(String(k),String(v)),removeItem:k=>storage.delete(String(k)),clear:()=>storage.clear(),key:i=>[...storage.keys()][i]??null,get length(){return storage.size;}};
  Object.defineProperty(win,'localStorage',{configurable:true,value:memory});
  installHTML(win.document,PAYLOAD.senpaHTML);
  win.document.documentElement.classList.remove('ryuten-active');
  let resolveHost;
  const ready=new Promise(resolve=>resolveHost=resolve);
  const auxiliary={hostStarted:false,wasmBytes:decode(PAYLOAD.senpaWasm),hostReadyResolve:resolveHost,installHost:()=>{}};
  win.SENPA_PORT=auxiliary;
  const close=win.document.createElement('button');close.textContent='Back to Ryuten · P2 continues connecting';
  close.style.cssText='position:fixed;top:8px;left:8px;z-index:2147483647;padding:9px 12px;cursor:pointer';
  win.document.body.append(close);
  const engine={frame,host:null,clockOffset:win.performance.timeOrigin-performance.timeOrigin,needsVerification:false,
    show(){if(disposed)return;frame.style.visibility='visible';frame.style.pointerEvents='auto';win.focus();},
    hide(){frame.style.visibility='hidden';frame.style.pointerEvents='none';parentPort.frame?.contentWindow.focus();},
    dispose(){if(disposed)return;disposed=true;try{this.host?.actions.macroFeed(false);this.host?.network.cleanUp();}catch{}for(const id of intervals)clearI(id);for(const id of timeouts)clearT(id);frame.remove();}
  };
  close.onclick=()=>engine.hide();
  auxiliary.hostReadyResolve=h=>{
    const nativeConnect=h.network.connect.bind(h.network);
    // Install before React mounts: cached native UI may otherwise request a connection
    // while this realm is still initializing. Only the selected EU WindBine is allowed.
    h.network.connect=(url,...args)=>engine.initialized&&url===controller.primary.network.url?nativeConnect(url,...args):false;
    resolveHost(h);
  };
  try{
    parentPort.test?.prepareAux?.(win,auxiliary);
    auxiliary.loadVerification=()=>{if(win.turnstile||win.document.getElementById('senpa-verification-sdk'))return;const sdk=win.document.createElement('script');sdk.id='senpa-verification-sdk';sdk.src='https://challenges.cloudflare.com/turnstile/v0/api.js';sdk.async=true;sdk.defer=true;win.document.head.append(sdk);};
    win.Function(PAYLOAD.senpaJS+'\n//# sourceURL=senpa-port://native-senpa-p2.js').call(win);
    let startupTimer;
    try{engine.host=await Promise.race([ready,new Promise((_,reject)=>{startupTimer=setTimeout(()=>reject(Error('P2 native startup timed out')),15000);})]);}
    finally{clearTimeout(startupTimer);}
    await new Promise(resolve=>setTimeout(resolve,150));
    if(generation!==controller.generation)throw Error('P2 startup cancelled');
    const h=engine.host;
    h.renderer.initialize=function(){if(this.initialized)return;this.initialized=true;this.canvas=win.document.getElementById('screen');this.ctx=this.canvas.getContext('2d');this.setScreenSize();win.addEventListener('resize',()=>this.setScreenSize());};
    h.renderer.run=()=>{};h.minimap.run=()=>{};h.renderer.captureFrame=()=>parentPort.child?.reference.X_._4894;
    h.actions.sendMouse=()=>{}; // Primary scheduler routes input, even before an auxiliary handshake.
    // The original UI can request its saved server on mount: this frame must use only the selected WindBine.
    const connect=h.network.connect.bind(h.network);
    h.network.connect=(url,...args)=>url===controller.primary.network.url?connect(url,...args):false;
    h.loop.initialize();h.loop.loaded=true;
    // Full Senpa account identity remains primary-owned; reuse only the active user's in-memory auth.
    h.auth.setAuthToken(controller.primary.auth.authToken);
    engine.initialized=true;return engine;
  }catch(error){engine.dispose();throw error;}
}

