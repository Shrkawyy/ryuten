const port = window.SENPA_PORT = { version: PAYLOAD.version, hostStarted: false, ready: false, mode: 'boot', pending: null, spawnPending: new Map(), logs: [], hostReadyResolve: null, onFrame: null };
const decode = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
port.wasmBytes = decode(PAYLOAD.senpaWasm);
port.hostReady = new Promise(resolve => port.hostReadyResolve = resolve);
port.log = (event, detail = {}) => { const sanitized = JSON.parse(JSON.stringify(detail, (key, value) => /token|cookie|authorization|password|secret/i.test(key) ? '[REDACTED]' : value)); port.logs.push({ at: Math.round(performance.now()), event, detail: sanitized }); if (port.logs.length > 250)
    port.logs.shift(); console.info('[Ryuten Senpa]', event, sanitized); };
port.notify = message => { port.message = String(message); port.child?.notice?.('Senpa', port.message); };
const installHTML = (doc, html) => { const parsed = new DOMParser().parseFromString(html, 'text/html'); if (parsed.querySelector('script'))
    throw Error('Unsafe bootstrap: script remained in template'); const root = doc.importNode(parsed.documentElement, true); while (doc.firstChild)
    doc.removeChild(doc.firstChild); doc.appendChild(doc.implementation.createDocumentType('html', '', '')); doc.appendChild(root); };
installHTML(document, PAYLOAD.senpaHTML);
document.documentElement.classList.add('ryuten-active');
const boot = document.createElement('div');
boot.id = 'senpa-port-boot';
boot.textContent = 'Loading Senpa engine and Ryuten presentation…';
document.body.append(boot);
const back = document.createElement('button');
back.id = 'senpa-return';
back.hidden = true;
back.textContent = 'Back to Ryuten';
document.body.append(back);
port.showNative = (reason = 'Senpa account, skins, hats, replays and custom servers') => { port.mode = 'native'; if (port.frame) {
    port.frame.style.visibility = 'hidden';
    port.frame.style.pointerEvents = '';
} document.documentElement.classList.remove('ryuten-active'); window.focus(); back.hidden = false; back.title = reason; const h = port.host; h.menu.isSettingsMenuOpen = false; h.menu.show(); h.actions.macroFeed(false); };
port.showRyuten = () => { port.nativePickerObserver?.disconnect();port.nativePickerObserver=null; if (!port.ready)
    return; port.mode = 'ryuten'; document.documentElement.classList.add('ryuten-active'); port.frame.style.visibility = 'visible'; port.frame.style.pointerEvents = ''; back.hidden = true; port.child?.showMenu?.(); port.frame.contentWindow.focus(); };
back.onclick=()=>{port.nativeContext=null;port.host?.bus.dispatch(port.host.events.Hide_Modals);port.mode==='replay'?port.showNative('Senpa replay controls'):port.showRyuten();};
// Uses the original React skin gallery, its auth/level checks, and original account save route.
port.openSkinPicker=slot=>{
    slot=slot===1?1:0;
    port.showNative('Senpa skin gallery');
    port.nativeContext={kind:'skins',slot};
    let attempts=0;
    const open=()=>{
        const button=document.getElementById('skin-preview-'+(slot+1));
        if(button){
            let wasOpen=false;
            port.nativePickerObserver?.disconnect();
            port.nativePickerObserver=new MutationObserver(()=>{
                const visible=document.querySelector('.skins-modal');
                if(visible&&!wasOpen){
                    wasOpen=true;
                    // A programmatic native button click does not move keyboard focus out of the iframe.
                    visible.setAttribute('tabindex','-1');visible.focus({preventScroll:true});
                }
                else if(!visible&&wasOpen&&port.mode==='native'&&port.nativeContext?.kind==='skins'){
                    port.nativeContext=null;port.showRyuten();
                }
            });
            port.nativePickerObserver.observe(document.body,{childList:true,subtree:true});
            button.click();return;
        }
        if(++attempts<60)requestAnimationFrame(open);
        else port.notify('Senpa skin picker is not ready. Use the native account screen and try again.');
    };open();
};
window.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||port.mode!=='native'||!port.nativeContext)return;
    if(document.querySelector('.swal2-container'))return; // Native warnings/auth dialogs own their keys.
    event.preventDefault();event.stopImmediatePropagation();
    port.host.bus.dispatch(port.host.events.Hide_Modals);
    port.nativeContext=null;port.showRyuten();
},true);
// Retained only for explicit advanced-support diagnostics. Normal skin buttons
// are rebound to the Ryuten account panel during presentation startup.
port.openLegacySkinPicker=port.openSkinPicker;
port.setSetting = (key, value) => { const h = port.host, def = h.settingsStore.definitions[key]; if (!def || key === 'useWebGL')
    return false; const valid = h.settingsStore.sanitize(def, value); if (h.settings[key] !== valid) {
    h.settings[key] = valid;
    port.child?.settingsChanged?.(key, valid);
    port.multibox?.syncPreferences();
} return true; };
port.connect = (host, { preserveIntent = false } = {}) => { const known = port.tracker.servers.find(s => s.host === host); if (!known) {
    port.notify('Refresh the tracker and select a valid Senpa server.');
    return false;
} if (!preserveIntent) {
    port.spawnPending.clear();
    port.pending = null;
} port.multibox?.beforeConnect(host,preserveIntent);port.selected = host; try {
    localStorage.setItem('senpaio:server',port.selected);localStorage.setItem('ryuten.senpa.v1.selected', host);
}
catch { } port.host.bus.dispatch(port.host.events.Request_Connect, host); port.log('connect-selected-server', { host }); return true; };
port.readyToAct = () => { const h = port.host; return !!(h && h.network.connected && h.packets.handshakeDone && h.world.myPlayerIDs.length); };
port.ensureConnection = () => { const h = port.host; if (h.network.connected || h.network.ws?.readyState === 0 || h.network.pendingConnect || h.network.moduleWaitTimer)
    return; const target = port.selected || port.tracker.servers[0]?.host; if (target && !port.connectionRequested) {
    port.connectionRequested = true;
    port.connect(target, { preserveIntent: true });
    setTimeout(() => port.connectionRequested = false, 3000);
} };
port.selectNative = index => {
    const feed=port.child?.feedTiming,token=feed?.beforeSwitch?.();
    port.child?.lineSplit?.cancel?.('switch');port.host.player.activeTab=index;
    feed?.afterSwitch?.(token,index);port.host.actions.sendMouse();port.child?.updateTabs?.();
};
port.request = (kind, index) => {
    const h = port.host;
    if (!h)
        return;
    port.child?.commitIdentity?.();
    if(port.multibox?.request(kind,index))return;
    if (kind === 'switch') {
        const n = h.world.myPlayerIDs.length;
        index = Number.isInteger(index) ? index : n ? (h.player.activeTab + 1) % n : 1;
        if (index < 0 || index >= Math.max(n, 2))
            return;
        if (h.world.myCells[index]?.size) {
            port.selectNative(index);
            port.child?.hideMenu?.();
            return;
        }
        kind = 'play';
    }
    if (kind === 'spectate') {
        if (h.player.isAlive) {
            port.notify('Your current player is alive. Resume play or wait for it to die before spectating.');
            return;
        }
        port.pending = { kind, index: 0, at: performance.now() };
    }
    else {
        index = Number.isInteger(index) ? index : Math.max(0, h.player.activeTab || 0);
        if (h.world.myCells[index]?.size) {
            port.selectNative(index);
            port.child?.hideMenu?.();
            return;
        }
        port.spawnPending.set(index, { at: performance.now(), sent: 0 });
        port.pending = { kind: 'play', index, at: performance.now() };
    }
    port.ensureConnection();
    port.flushActions();
    if (!port.readyToAct())
        port.notify('Request queued. Senpa connection verification must complete first.');
};
port.flushActions = () => {
    const h = port.host;
    if (!port.readyToAct())
        return;
    for (const [index, pending] of port.spawnPending) {
        if (h.world.myCells[index]?.size) {
            port.spawnPending.delete(index);
            continue;
        }
        if (index >= h.world.myPlayerIDs.length) {
            port.spawnPending.delete(index);
            if (port.pending?.index === index)
                port.pending = null;
            port.notify('This Senpa mode assigned ' + h.world.myPlayerIDs.length + ' player tab(s).');
            continue;
        }
        if (!pending.sent) {
            port.selectNative(index);
            h.menu.onPlay();
            h.packets.spawn(index);
            pending.sent = performance.now();
            port.child?.hideMenu?.();
            port.log('spawn-request', { tab: index + 1 });
        }
        else if (performance.now() - pending.sent > 12000) {
            port.spawnPending.delete(index);
            port.notify('Senpa has not acknowledged this spawn. Check the native screen for a server or verification message, then try again.');
        }
    }
    if (port.pending?.kind === 'spectate') {
        h.bus.dispatch(h.events.Request_Spectate);
        port.pending = null;
        port.child?.hideMenu?.();
    }
    else if (port.pending && h.world.myCells[port.pending.index]?.size)
        port.pending = null;
};
port.installHost = h => {
    port.host = h;
    port.multibox=new SenpaMultibox(port,h,createSenpaAuxEngine);
    port.multibox.worldView=new SenpaMultiWorld(port.multibox);
    h.renderer.run = () => { if (port.ready) {
        try {
            port.multibox?.tick(performance.now());
            port.flushActions();
            port.onFrame?.(performance.now());
        }
        catch (e) {
            if(port.child?.metrics)port.child.metrics.errors++;
            if (!port.lastFrameError || performance.now() - port.lastFrameError > 2000) {
                port.lastFrameError = performance.now();
                port.log('presentation-error', { message: e.message, stack: String(e.stack) });
            }
        }
    } /* Never draw the second world underneath the Ryuten scene. */ };
    const on = (key, fn) => h.bus.register(h.events[key], fn);
    on('Player_Spawned', () => { port.child?.hideMenu?.(); });
    on('Player_Died', () => { if(!port.multibox?.anyAlive)port.child?.showMenu?.(); });
    on('Show_Menu', open => { if (port.mode === 'native' || open&&port.multibox?.multi&&port.multibox.anyAlive)
        return; open ? port.child?.showMenu?.() : port.child?.hideMenu?.(); });
    on('Request_Captcha', () => { port.notify('Senpa requested verification. Complete the original challenge shown by Senpa.'); });
    on('Socket_Connected',()=>{port.selected=h.network.url;port.selectedServerId=port.tracker?.servers.find(s=>s.host===h.network.url)?.id;port.child?.renderServers?.();});
    on('Socket_Cleanup', () => {port.child?.lineSplit?.cancel?.('disconnect'); for (const pending of port.spawnPending.values())
        pending.sent = 0; port.child?.resetWorld?.(); });
    on('Settings', () => port.child?.settingsChanged?.());
    on('LeaderBoard_Update', data => { port.leaderboard = data; port.child?.updateHUD?.(); });
    on('Teamlist_Update', data => { port.teamlist = data; port.child?.updateHUD?.(); });
    on('Server_Time', data => port.serverTime = data);
    on('RoomStats_Update', data => port.roomStats = data);
    on('Notify_ShowNotification', data => { port.child?.addChat?.(data); });
    on('Tabs_Update', () => port.child?.updateTabs?.());
    on('Hide_Modals',()=>{if(port.nativeContext?.kind==='skins'){port.nativeContext=null;setTimeout(()=>{port.child?.syncAccountSkins?.();port.showRyuten();},100);}});
    on('Replay_Bar', data => { if (!port.ready)
        return; if (data.show) {
        port.mode = 'replay';
        document.documentElement.classList.add('ryuten-active');
        port.frame.style.visibility = 'visible';
        port.frame.style.pointerEvents = 'none';
        port.child?.hideMenu?.();
        back.hidden = false;
        back.textContent = 'Senpa replay controls';
    }
    else if (port.mode === 'replay') {
        port.frame.style.pointerEvents = '';
        back.textContent = 'Back to Ryuten';
        port.showNative('Senpa replay gallery');
    } });
    window.addEventListener('focus', () => { port.flushActions(); });
    port.log('native-host-ready', { settings: Object.keys(h.settingsStore.definitions).length });
};
async function start() {
    // The real verification SDK is loaded only when native Senpa requests a challenge.
    // It cannot be replaced with offline tokens. Gameplay/auth may require this external service.
    port.loadVerification=()=>{
      if(window.turnstile||document.getElementById('senpa-verification-sdk'))return;
      const challenge=document.createElement('script');challenge.id='senpa-verification-sdk';
      challenge.src='https://challenges.cloudflare.com/turnstile/v0/api.js';challenge.async=true;challenge.defer=true;
      document.head.append(challenge);
    };
    new Function(PAYLOAD.senpaJS + '\n//# sourceURL=senpa-port://native-senpa.js')();
    const h = await port.hostReady;
    port.host = h;
    // Native React registers verification handlers on mount; initialize the game once after that mount.
    await new Promise(resolve => setTimeout(resolve, 120));
    // The legacy surface exists for native cursor scaling and replay thumbnails only.
    // Do not initialize the legacy world texture atlas or paint a competing renderer.
    h.renderer.initialize = function () { if (this.initialized)
        return; this.initialized = true; this.canvas = document.getElementById('screen'); this.ctx = this.canvas.getContext('2d'); this.setScreenSize(); window.addEventListener('resize', () => this.setScreenSize(), { passive: true }); };
    h.renderer.captureFrame = () => port.child?.reference.X_._4894 || h.renderer.canvas;
    port.startHost();
    port.tracker = new SenpaTracker({ onChange: () => { port.child?.renderServers?.(); if (!port.selected && port.tracker.servers.length)
            port.selected = port.tracker.servers[0].host; if (port.pending)
            port.ensureConnection(); } });
    try {
        port.selected = localStorage.getItem('ryuten.senpa.v1.selected') || localStorage.getItem('senpaio:server') || '';
    }
    catch { }
    port.tracker.start();
    const frame = document.createElement('iframe');
    frame.id = 'ryuten-senpa-frame';
    frame.title = 'Ryuten presentation for Senpa';
    document.body.append(frame);
    port.frame = frame;
    const win = frame.contentWindow;
    installHTML(win.document, PAYLOAD.ryutenHTML);
    port.test?.prepareChild?.(win);
    const rp = win.RYUTEN_PORT = { assets: PAYLOAD.assets, build: { version: PAYLOAD.version, variant: PAYLOAD.buildVariant || 'standard' }, wasmBytes: decode(PAYLOAD.ryutenWasm), parentPort: port };
    const evaluate = (source, label) => win.Function(source + '\n//# sourceURL=senpa-port://' + label).call(win);
    evaluate(PAYLOAD.childScripts, 'presentation-modules.js');
    evaluate(PAYLOAD.ryutenVendors, 'ryuten-vendors.js');
    evaluate(PAYLOAD.ryutenChunk, 'ryuten-chunk.js');
    evaluate(PAYLOAD.ryutenJS, 'ryuten-native.js');
    await rp.start();
    port.child = rp;
    port.ready = true;
    port.mode = 'ryuten';
    port.onFrame = rp.frame;
    boot.hidden = true;
    win.focus();
    // Selection is live tracker-backed; connecting happens through an explicit Play/Spectate request.
    rp.renderServers();
    port.log('port-ready', { version: PAYLOAD.version, renderer: 'Ryuten PixiJS', host: 'captured native Senpa', nativeAnimation: h.settings.cellAnimation });
}
start().catch(error => { port.error = String(error.stack || error); boot.hidden = false; boot.textContent = 'Ryuten for Senpa could not start.\n\n' + port.error + '\n\nDisable this userscript and reload to return to native Senpa. Your Senpa settings were not deleted.'; console.error('[Ryuten Senpa startup]', error); });
window.addEventListener('pagehide', () => {port.tracker?.stop();port.multibox?.dispose();});
