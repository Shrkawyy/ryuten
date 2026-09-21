(() => {
    'use strict';
    const rp = window.RYUTEN_PORT;
    rp.modules = {};
    rp.status = { phase: 'initializing', ready: false, renderer: 'pending' };
    rp.listeners = [];
    rp.shieldsEnabled = rp.build.variant !== 'no-shields';
    rp.localInventory = rp.shieldsEnabled;
    rp.nativeStorage = { getItem: k => localStorage.getItem('ryuten.senpa.v1.native.' + k), setItem: (k, v) => localStorage.setItem('ryuten.senpa.v1.native.' + k, v), removeItem: k => localStorage.removeItem('ryuten.senpa.v1.native.' + k) };
    rp.setting = (key, fallback) => { try {
        const v = JSON.parse(localStorage.getItem('ryuten.senpa.v1.preferences') || '{}');
        return key in v ? v[key] : fallback;
    }
    catch {
        return fallback;
    } };
    rp.saveSetting = (key, value) => { let v = {}; try {
        v = JSON.parse(localStorage.getItem('ryuten.senpa.v1.preferences') || '{}');
    }
    catch { } v[key] = value; localStorage.setItem('ryuten.senpa.v1.preferences', JSON.stringify(v)); };
    rp.log = (level, event, detail = {}) => rp.parentPort.log(event, detail);
    rp.on = (target, event, fn, options) => { target.addEventListener(event, fn, options); rp.listeners.push(() => target.removeEventListener(event, fn, options)); };
    rp.timeout = (promise, ms, label) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error(label + ' timed out')), ms); Promise.resolve(promise).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); }); });
    rp.missingAssets=new Set();
    rp.asset = url => {
        const raw=String(url||'');if(/^(data:|blob:)/.test(raw))return raw;
        if(rp.assets[raw])return rp.assets[raw];
        let key=raw.replace(/^\.\//,'');
        try{if(/^https?:/.test(key)){
            const u=new URL(key);
            // Account/opponent media is server-supplied data, not executable client code.
            // A local asset pack may override its exact URL above.
            if(!['ryuten.io','www.ryuten.io'].includes(u.hostname))return raw;
            key=u.pathname.replace(/^\/(play\/)?/,'');
        }}catch{}
        key=key.split(/[?#]/)[0];if(rp.assets[key])return rp.assets[key];
        rp.missingAssets.add(key);return rp.assets['local/missing.svg'];
    };
    rp.request = async (url, type = 'text', ms = 10000) => { const control = new AbortController(), timer = setTimeout(() => control.abort(), ms); try {
        const response = await fetch(url, { credentials: 'omit', signal: control.signal });
        if (!response.ok)
            throw Error('HTTP ' + response.status);
        return type === 'json' ? await response.json() : type === 'arraybuffer' ? await response.arrayBuffer() : await response.text();
    }
    finally {
        clearTimeout(timer);
    } };
    rp.loadImage = async (url) => { const image = new Image(); image.crossOrigin = 'anonymous'; image.decoding = 'async'; image.src = rp.asset(url); await image.decode(); return image; };
    rp.createAudio = url => { const sound = new Audio(); sound.preload = 'none'; const play = sound.play.bind(sound); sound.play = () => { if (!sound.src)
        sound.src = rp.asset(url); return play().catch(() => { }); }; return sound; };
    rp.referencePromise = new Promise(resolve => rp.referenceResolve = resolve);
    rp.wasmPromise = new Promise(resolve => rp.wasmReadyResolve = resolve);
    rp.el = (tag, attributes = {}, text) => { const element = document.createElement(tag); for (const [k, v] of Object.entries(attributes)) {
        if (k in element)
            element[k] = v;
        else
            element.setAttribute(k, v);
    } if (text != null)
        element.textContent = text; return element; };
    rp.download = (name, content, type = 'application/json') => { const url = URL.createObjectURL(new Blob([content], { type })); const a = rp.el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); };
})();

(() => {
    'use strict';
    const rp = window.RYUTEN_PORT;
    // Original vector fallbacks. These are ordinary SVG icons, not redistributed font/glyph files.
    const paths = {
        add: 'M12 4v16M4 12h16', 'arrow-down': 'M12 3v18m-7-7 7 7 7-7', 'arrow-up': 'M12 21V3m-7 7 7-7 7 7', back: 'M20 12H4m7-7-7 7 7 7',
        cash: 'M3 6h18v12H3zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
        'chat-bubble': 'M3 4h18v13H9l-6 4z', check: 'm4 12 5 5L20 5', checkbox: 'M3 3h18v18H3zM6 12l4 4 8-9', 'checkbox-outline': 'M3 3h18v18H3z',
        'chevron-left': 'm15 4-8 8 8 8', 'chevron-right': 'm9 4 8 8-8 8', circle: 'M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0', close: 'm5 5 14 14M19 5 5 19',
        coin: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M15 8c-5-3-6 2-2 4s2 6-4 4M12 5v14',
        copy: 'M8 8h13v13H8zM4 16H2V2h14v2', 'copy-all': 'M8 8h13v13H8zM4 16H2V2h14v2', delete: 'M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
        discord: 'M6 6c4-3 8-3 12 0l3 12-5 2-2-3h-4l-2 3-5-2zM8 12h1m6 0h1',
        edit: 'm4 16 12-12 4 4L8 20H4zM13 7l4 4', facebook: 'M15 3h-3L9 6v15m-4-11h12',
        'gamepad-btns-plus': 'M7 7h10l4 12-5-2H8l-5 2zM6 11h5M8.5 8.5v5m6-3h1m1 2h1',
        globe: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0M2 12h20M12 2c-6 6-6 14 0 20m0-20c6 6 6 14 0 20',
        'import-export': 'M7 2v18m-4-4 4 4 4-4M17 22V4m-4 4 4-4 4 4',
        'info-white': 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0M12 11v7m0-12v1',
        keyboard: 'M2 5h20v14H2zM5 8h1m3 0h1m3 0h1m3 0h1M5 11h1m3 0h1m3 0h1m3 0h1M6 16h12',
        link: 'm9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m4 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
        list: 'M8 5h13M8 12h13M8 19h13M3 5h1m-1 7h1m-1 7h1', medal: 'M8 2l4 7 4-7M5 16a7 7 0 1 0 14 0 7 7 0 1 0-14 0',
        mouse: 'M5 9a7 7 0 0 1 14 0v6a7 7 0 0 1-14 0zM12 2v7', mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6',
        new: 'M3 7h18v10H3zM6 14V10l3 4v-4m3 0v4h2m-2-2h2m3-2v4',
        'north-east': 'M5 19 19 5M8 5h11v11', 'open-in-browser': 'M10 4H3v17h17v-7M13 3h8v8M10 14 21 3',
        pause: 'M8 4v16M16 4v16', person: 'M8 6a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 21v-3c0-7 18-7 18 0v3',
        play: 'm6 3 15 9-15 9z', 'playback-speed': 'm3 5 10 7-10 7zM13 5l8 7-8 7', record: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0',
        replay: 'M4 8a9 9 0 1 1-1 7M3 3v6h6', save: 'M3 3h15l3 3v15H3zM7 3v6h10V3M7 21v-8h10v8',
        settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
        sort: 'M4 6h16M7 12h10m-7 6h4', 'south-west': 'M19 5 5 19m0-11v11h11', spinner: 'M12 2a10 10 0 1 1-10 10',
        star: 'm12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z', stop: 'M4 4h16v16H4z', 'triangle-top-rights': 'M5 4h15v15z',
        warning: 'm12 2 10 19H2zM12 8v6m0 3v1',
    };
    paths.reset = paths.replay;
    paths.restart = paths.replay;
    paths['info-fa-white'] = paths['info-white'];
    rp.modules.installFonts = () => {
        document.documentElement.classList.add('rp-icons-fallback');
        const style = document.createElement('style');
        style.id = 'port-vector-icons';
        style.textContent = 'html.rp-icons-fallback .iconfont::before{content:""!important;display:inline-block;width:1em;height:1em;vertical-align:-.12em;background:currentColor;-webkit-mask:var(--rp-icon) center/contain no-repeat;mask:var(--rp-icon) center/contain no-repeat;}' + Object.entries(paths).map(([name, path]) => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            return `.iconfont-${name}{--rp-icon:url("data:image/svg+xml,${encodeURIComponent(svg)}")}`;
        }).join('');
        document.head.appendChild(style);
        // System typography and local SVGs: no font binaries or font-provider request.
        rp.status.fonts={interface:'system-local',icons:'svg-local',numerals:'generated-local'};
        rp.fontsReady=Promise.resolve({text:true,icons:false});return rp.fontsReady;
    };
})();

/** Cancellation boundary around the captured Ryuten loading screen. */
(() => {
    'use strict';
    const rp = window.RYUTEN_PORT;
    rp.modules.installLoadingLifecycle = loading => {
        let dismissed = false;
        let initialization = null;
        const begin = loading._2794.bind(loading);
        const hide = loading._5075.bind(loading);
        const clearTicker = () => {
            window.clearInterval(loading._1275);
            loading._1275 = 0;
        };
        loading._2794 = () => {
            if (dismissed)
                return Promise.resolve();
            // Native initialization awaits background.decode() + a 500 ms fade BEFORE
            // assigning its interval. A fast local-asset boot can dismiss the screen first.
            // Clear an interval created by a late completion before its first callback runs.
            if (!initialization)
                initialization = Promise.resolve().then(begin).finally(() => {
                    if (dismissed)
                        clearTicker();
                });
            return initialization;
        };
        loading._5075 = () => {
            if (dismissed)
                return;
            dismissed = true;
            clearTicker();
            return hide();
        };
        rp.listeners.push(() => { dismissed = true; clearTicker(); });
    };
})();

/* Presentation only. Senpa still owns game state, collision/eject physics and input.
 * Ryuten remains packet-linear. XPLUS ULTRA is deliberately delayed, cinematic
 * rendering, not a competitive/physics-accurate or video-calibrated profile.
 */
(() => {
  'use strict';
  const rp=window.RYUTEN_PORT, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const clock=()=>parent.performance.now();
  const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  // Three cascaded positive first-order filters, integrated analytically for a
  // held target. Output position, velocity and acceleration remain continuous
  // across target changes; unlike a hard-clamped spring, reversals may coast.
  // exp(-q)*(1+q+q*q/2)=.05 at q=6.29579362187199.
  const RATE95=6.29579362187199;
  const MAX_XPLUS_MS=500;
  function normalizeXplusMs(value){
    let number;try{number=Number(value);}catch{return 420;}
    return Number.isFinite(number)?clamp(Math.round(number),120,MAX_XPLUS_MS):420;
  }
  const derivedMs=(ms,ratio)=>Math.min(MAX_XPLUS_MS,ms*ratio);
  function stage(value){return {a:value,b:value,c:value};}
  function filter3(s,target,dt,settleMs){
    if(!Number.isFinite(target)||!Number.isFinite(dt)||dt<=0)return s.c;
    if(!(settleMs>0)||!Number.isFinite(settleMs)){s.a=s.b=s.c=target;return target;}
    const q=RATE95*dt/settleMs;
    if(q>80){s.a=s.b=s.c=target;return target;}
    const d=Math.exp(-q),a=s.a-target,b=s.b-target,c=s.c-target;
    s.a=target+a*d;s.b=target+(b+q*a)*d;s.c=target+(c+q*b+q*q*a/2)*d;
    return s.c;
  }
  class MotionProfiles {
    constructor(h,r){
      this.h=h;this.r=r;this.style='Senpa';this.records=new WeakMap();this.watchedHosts=new WeakSet();
      this.frameNow=clock();this.ultraView=null;this.watchHost(h,0);this.installInputProjection();
      r.Q.PRESENTATION_STYLE._4935('change',value=>this.select(value));
      this.select(r.Q.PRESENTATION_STYLE._5997());
    }
    watchHost(h,offset=0){
      if(this.watchedHosts.has(h))return;this.watchedHosts.add(h);
      const motion=this,update=h.Cell.prototype.update;
      Object.defineProperty(h.Cell.prototype,'_rpClockOffset',{configurable:true,value:offset});
      h.Cell.prototype.update=function(...args){const result=update.apply(this,args);if(motion.style!=='Senpa'&&this.type!==2)motion.retarget(this);return result;};
    }
    get ultraActive(){return this.style==='XPLUS'&&rp.parentPort.mode!=='native'&&!this.h.network.isReplay;}
    get delay(){return this.style==='XPLUS'?normalizeXplusMs(this.r.Q.XPLUS_SETTLE_MS?._5997()??420):this.r.Q.ELEMENT_ANIMATION_SOFTENING._5997();}
    create(cell,now){
      const s={x:cell.x,y:cell.y,r:cell.radius,fromX:cell.x,fromY:cell.y,fromR:cell.radius,
        toX:cell.endX,toY:cell.endY,toR:cell.endRadius,at:now,last:now,vx:0,vy:0,vr:0,u:1};
      this.records.set(cell,s);return s;
    }
    seedStages(s){s.fx=stage(finite(s.x));s.fy=stage(finite(s.y));s.fr=stage(Math.max(0,finite(s.r)));}
    sampleRecord(s,now){
      // Every consumer at the same timestamp gets exactly the same pose.
      if(!Number.isFinite(now)||now<s.last)now=s.last;
      if(this.style==='XPLUS'){
        if(!s.fx)this.seedStages(s);
        // A stall/background-tab gap must not become a single visual teleport.
        // Intentional time dilation after stalls, not a claim to recover lost frames.
        const dt=Math.min(64,now-s.last),ms=this.delay;
        s.x=filter3(s.fx,s.toX,dt,ms);s.y=filter3(s.fy,s.toY,dt,ms);
        s.r=Math.max(0,filter3(s.fr,s.toR,dt,derivedMs(ms,1.25)));
        const w=RATE95/ms;s.vx=w*(s.fx.b-s.fx.c);s.vy=w*(s.fy.b-s.fy.c);s.vr=(RATE95/derivedMs(ms,1.25))*(s.fr.b-s.fr.c);
        s.u=clamp((now-s.at)/Math.max(1,ms),0,1);
      }else{
        const u=this.delay>0?clamp((now-s.at)/this.delay,0,1):1;
        s.x=s.fromX+(s.toX-s.fromX)*u;s.y=s.fromY+(s.toY-s.fromY)*u;
        s.r=Math.max(0,s.fromR+(s.toR-s.fromR)*u);s.u=u;
      }
      s.last=now;return s;
    }
    retarget(cell){
      const at=Number.isFinite(cell.updateTime)?cell.updateTime+(cell._rpClockOffset||0):clock();
      let s=this.records.get(cell);
      if(!s){s=this.create(cell,at);s.x=s.fromX=cell.startX;s.y=s.fromY=cell.startY;s.r=s.fromR=cell.startRadius;}
      else{this.sampleRecord(s,at);s.fromX=s.x;s.fromY=s.y;s.fromR=s.r;}
      s.toX=cell.endX;s.toY=cell.endY;s.toR=cell.endRadius;s.at=s.last=Math.max(at,s.last);s.u=0;
    }
    rebind(from,to,now=this.frameNow){
      if(this.style==='Senpa'||!from||!to||from===to)return;
      const previous=this.records.get(from);if(!previous)return;
      this.sampleRecord(previous,now);const next=this.create(to,now);
      next.fromX=next.x=previous.x;next.fromY=next.y=previous.y;next.fromR=next.r=previous.r;
      next.vx=previous.vx;next.vy=previous.vy;next.vr=previous.vr;next.u=0;
      // Preserve every filter stage, not just its output, when source affinity changes.
      if(previous.fx){next.fx={...previous.fx};next.fy={...previous.fy};next.fr={...previous.fr};}
      this.records.delete(from);
    }
    sample(cell,now=this.frameNow){
      // Native pellets and native removal lifetime deliberately remain unchanged.
      if(this.style==='Senpa'||cell.type===2||rp.parentPort.mode==='native'||this.h.network.isReplay)
        return {x:cell.x,y:cell.y,r:cell.radius,u:cell.dt};
      let s=this.records.get(cell);if(!s)s=this.create(cell,now);
      const pose=this.sampleRecord(s,now);
      return cell.removed?{x:pose.x,y:pose.y,r:pose.r,u:cell.dt}:pose;
    }
    select(style){
      if(!['Senpa','Ryuten','XPLUS'].includes(style)||style===this.style)return;
      const now=clock(),poses=[];
      for(const cell of (rp.world?.model||this.h.world).cells.values())poses.push([cell,{...this.sample(cell,now)}]);
      this.style=style;this.records=new WeakMap();this.frameNow=now;this.ultraView=null;
      for(const[cell,pose]of poses){const s=this.create(cell,now);s.fromX=s.x=pose.x;s.fromY=s.y=pose.y;s.fromR=s.r=pose.r;s.u=0;}
      // Never replace native camera state or controls. Returning to another
      // profile immediately restores native presentation (may visibly realign).
      rp.saveSetting('motion-style',style);rp.refreshMotionUI?.();
    }
    inputCamera(){return this.ultraActive&&this.ultraView?this.ultraView:this.h.camera;}
    installInputProjection(){
      const h=this.h,motion=this,send=h.actions?.sendMouse;
      if(typeof send!=='function')return;
      h.actions.sendMouse=function(...args){
        if(!motion.ultraActive||!motion.ultraView)return send.apply(this,args);
        // Reuse the complete native/port input routing, with its stop/tab rules.
        // Only its screen-to-world projection reads the *displayed* transform.
        const c=h.camera,v=motion.ultraView,x=c.x,y=c.y,z=c.zoom;
        c.x=v.x;c.y=v.y;c.zoom=v.zoom;
        try{return send.apply(this,args);}
        finally{c.x=x;c.y=y;c.zoom=z;rp.parentPort.multibox?.copyCamera?.();}
      };
    }
    camera(){
      if(!this.ultraActive){this.ultraView=null;return false;}
      const h=this.h,r=this.r,now=this.frameNow,ms=this.delay,base=h.camera;
      let v=this.ultraView;
      if(!v){
        const x=finite(base.x),y=finite(base.y),z=Math.max(.0001,finite(base.zoom,.15));
        v=this.ultraView={x,y,zoom:z,fx:stage(x),fy:stage(y),fz:stage(Math.log(z)),last:now};
      }
      // Follow the visual center, not a different unsmoothed physical center.
      // Retain Senpa's all-own-fragment mean; never alter active player/pairing.
      let x=0,y=0,count=0;
      for(const set of (rp.world?.model||h.world).myCells||[]){
        for(const cell of set.values()){
          if(cell.removed)continue;const pose=this.sample(cell,now);
          if(!Number.isFinite(pose.x)||!Number.isFinite(pose.y))continue;
          x+=pose.x;y+=pose.y;count++;
        }
      }
      const tx=count?x/count:finite(base.x,v.x),ty=count?y/count:finite(base.y,v.y);
      const dt=Math.min(64,Math.max(0,finite(now,v.last)-v.last));
      v.x=filter3(v.fx,tx,dt,derivedMs(ms,1.55));v.y=filter3(v.fy,ty,dt,derivedMs(ms,1.55));
      // Native wheel limits/auto zoom determine the target. Deliberately filter
      // its output in log space for smooth proportional zoom; no physics writes.
      v.zoom=Math.exp(filter3(v.fz,Math.log(Math.max(.0001,finite(base.zoom,v.zoom))),dt,derivedMs(ms,2.1)));
      v.last=Math.max(v.last,finite(now,v.last));
      const scale=r.X_._3473/Math.max(1,window.innerWidth),offset=rp.world?.offset||0;
      r.z_._3852._5117(v.x+offset,v.y+offset);r.z_._4336=v.zoom*scale;r.z_._9695();
      return true;
    }
    wheel(event){return this.h.camera.onMouseWheel(event);}
    useUltraPreset(ms=420){
      const setting=this.r.Q.XPLUS_SETTLE_MS,value=normalizeXplusMs(ms);
      setting?._7531(value);this.r.Q.PRESENTATION_STYLE._7531('XPLUS');return this.snapshot();
    }
    snapshot(){return {profile:this.style,delayMs:this.style==='Senpa'?this.h.settings.cellAnimation:this.delay,
      cameraOwner:this.ultraActive?'XPLUS display-only (experimental)':'Senpa',cameraSpeed:this.h.settings.cameraSpeed,
      cameraDivisor:31-this.h.settings.cameraSpeed,wheelFactor:this.h.settings.zoomSpeed,
      zoom:this.h.camera.zoom,targetZoom:this.h.camera.targetZoom,
      renderCamera:this.ultraView?{x:this.ultraView.x,y:this.ultraView.y,zoom:this.ultraView.zoom}:null,
      experiment:'XPLUS ULTRA SMOOTH',xplusFilter:'analytic three-pole, unclamped reversal',
      xplusCameraSettleMs:this.style==='XPLUS'?derivedMs(this.delay,1.55):null,
      xplusZoomSettleMs:this.style==='XPLUS'?derivedMs(this.delay,2.1):null,
      xplusMaxMs:MAX_XPLUS_MS,visualStepCapMs:64,physicsOwner:'Senpa server',xplusCalibrated:false};}
    reset(){this.records=new WeakMap();this.ultraView=null;}
  }
  rp.modules.normalizeXplusMs=normalizeXplusMs;rp.modules.MotionProfiles=MotionProfiles;rp.modules.xplusFilter3=filter3;rp.modules.xplusStage=stage;
})();

/* Keep Ryuten's original map shader and UVs; never use its loading wallpaper.
 * The reference's gameplay image is external and was NOT inside the capture.
 * A missing original gets a plain renderer background, not invented artwork.
 * Map textures are local-only; opponent/account skins keep their existing path.
 */
(() => {
  'use strict';
  const rp=window.RYUTEN_PORT;
  const ORIGINAL='https://i.imgur.com/aKvo1jQ.png';
  const LOADING='assets/images/loading-screen/background.webp';
  const raster=/^data:image\/(?:png|jpeg|webp);base64,/i;
  const clean=value=>String(value||'').trim();
  const isOriginal=value=>/^https?:\/\/i\.imgur\.com\/aKvo1jQ\.png(?:[?#].*)?$/i.test(clean(value));
  const isWallpaper=value=>{
    const s=clean(value);
    return !!s&&(s===rp.assets[LOADING]||/(?:^|\/)assets\/images\/loading-screen\/background\.webp(?:[?#].*)?$/i.test(s));
  };
  const bundled=()=>{const image=rp.assets[ORIGINAL];return raster.test(image||'')&&!isWallpaper(image)?image:null;};
  const describe=value=>raster.test(value)?'Local raster image':isOriginal(value)?ORIGINAL:clean(value).slice(0,180);
  rp.modules.bundledRyutenMap=bundled;
  rp.modules.worldMapPolicy={originalURL:ORIGINAL,isWallpaper,isOriginal,describe};
  rp.modules.migrateWorldMap=(h,r)=>{
    const current=clean(h.settings.backgroundImageURL),original=bundled();
    const wrong=isWallpaper(current),legacy=current==='https://senpa.io/backgrounds/bg1.png'||isOriginal(current);
    if(!current||wrong||legacy){
      // Backup metadata only; duplicating a megabyte-long wallpaper in localStorage is wasteful.
      if(wrong)rp.saveSetting('map-wallpaper-migration',{from:'loading-screen/background.webp',to:original?'bundled-original':'missing-original'});
      rp.parentPort.setSetting('backgroundImageURL',original||'');
      if(wrong||legacy||!current)rp.parentPort.setSetting('backgroundImage',!!original);
    }
    rp.saveSetting('map-v3-local-gameplay',true);
  };
  rp.modules.installWorldMap=r=>{
    const layer=r.It;let generation=0,usable=false,lastRequested='';
    const initial=clean(r.Q.BACKGROUND_IMAGE_URL._5997());
    rp.mapState={status:initial?'idle':'missing-original',url:describe(initial||ORIGINAL),
      error:initial?'':'Original gameplay image is absent from the capture. Import a local image; the loading wallpaper is not a map.',retryAt:0};
    function state(status,url,error=''){
      rp.mapState={status,url:describe(url),error,retryAt:0};
    }
    const load=url=>new Promise((resolve,reject)=>{
      const img=new Image();let settled=false;
      const end=(error)=>{if(settled)return;settled=true;clearTimeout(timer);img.onload=img.onerror=null;error?reject(error):resolve(img);};
      const timer=setTimeout(()=>{end(Error('Local image decode timed out'));img.src='';},10000);
      img.onload=()=>end();img.onerror=()=>end(Error('Invalid or unreadable local image'));
      img.src=url;
    });
    function resolveLocal(url){
      const raw=clean(url);
      if(!raw||isOriginal(raw)){const original=bundled();if(original)return original;throw Error('Original Ryuten gameplay image is not bundled. Import the original image locally.');}
      if(isWallpaper(raw))throw Error('Ryuten loading artwork cannot be used as the gameplay map.');
      const resolved=rp.assets[raw]||raw;
      if(isWallpaper(resolved))throw Error('Ryuten loading artwork cannot be used as the gameplay map.');
      if(!raster.test(resolved))throw Error('Map images must be bundled or imported PNG, JPEG or WebP files; external map fetching is disabled.');
      return resolved;
    }
    layer._5594=async function(url,quality){
      const serial=++generation;lastRequested=clean(url);state('loading',url);
      try{
        const local=resolveLocal(url),img=await load(local);
        if(serial!==generation)return false;
        if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>8192||img.naturalHeight>8192)
          throw Error('Map dimensions must be within 8192 × 8192 pixels.');
        const canvas=document.createElement('canvas'),scale=Number.isFinite(quality)?quality:1;
        canvas.width=canvas.height=Math.min(4096,Math.max(512,2048*scale));
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D is unavailable');
        ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const texture=new r.c.VL4(canvas,{mipmap:r.c.WBB.OFF});
        if(serial!==generation){texture.destroy();return false;}
        const old=this._5683.uTexture;this._5683.uTexture=texture;usable=true;
        if(old!==r.c.xEZ.WHITE.baseTexture&&old!==texture)old.destroy();
        state('ready',url);return true;
      }catch(error){
        if(serial!==generation)return false;
        state(!url||isOriginal(url)?'missing-original':'error',url||ORIGINAL,error.message);
        // Retain a good local image on a failed replacement, but never retry a missing remote image each frame.
        rp.log('warn','world-map-unavailable',{message:error.message});return false;
      }
    };
    const draw=layer._4659.bind(layer);
    layer._4659=function(){draw();if(!usable)this._4435.removeChildren();};
    rp.restoreRyutenMap=()=>{
      const image=bundled();
      if(!image){
        state('missing-original',ORIGINAL,'Original gameplay image is not bundled. Use Import local map image; no replacement artwork has been substituted.');
        rp.notice?.('Ryuten map',rp.mapState.error);return false;
      }
      r.Q.BACKGROUND_IMAGE_URL._7531(image);r.Q.BACKGROUND_IMAGE_COLOR._7531(0xc0c0c0);r.Q.WORLD_BACKGROUND_IMAGE._7531(true);
      return layer._5594(image,layer._1848._4641);
    };
    rp.reloadMap=()=>layer._5594(r.Q.BACKGROUND_IMAGE_URL._5997()||lastRequested,layer._1848._4641);
    rp.importWorldMap=async file=>{
      if(!file||file.size<=0||file.size>2*1024*1024)throw Error('Choose a PNG/JPEG/WebP file no larger than 2 MiB.');
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Only PNG, JPEG and WebP map files are supported.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const png=bytes.length>8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
      const jpeg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      const webp=bytes.length>12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
      if(!(file.type==='image/png'&&png||file.type==='image/jpeg'&&jpeg||file.type==='image/webp'&&webp))throw Error('File signature does not match its image type.');
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const uri='data:'+file.type+';base64,'+btoa(binary);
      resolveLocal(uri);const img=await load(uri);
      if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>8192||img.naturalHeight>8192)throw Error('Map dimensions must be within 8192 × 8192 pixels.');
      // Native setting owns persistence; no extra long data URI in port preferences.
      const previous=r.Q.BACKGROUND_IMAGE_URL._5997(),enabled=r.Q.WORLD_BACKGROUND_IMAGE._5997();
      try{
        r.Q.BACKGROUND_IMAGE_URL._7531(uri);r.Q.WORLD_BACKGROUND_IMAGE._7531(true);
        if(r.Q.BACKGROUND_IMAGE_URL._5997()!==uri)throw Error('Native settings rejected the local image.');
        const ok=await layer._5594(uri,layer._1848._4641);if(!ok)throw Error(rp.mapState.error||'Map was superseded by another selection.');
      }catch(e){r.Q.BACKGROUND_IMAGE_URL._7531(previous);r.Q.WORLD_BACKGROUND_IMAGE._7531(enabled);throw e;}
      return {local:true,width:img.naturalWidth,height:img.naturalHeight,bytes:bytes.length};
    };
  };
})();

/* Senpa world targets and lifetimes are authoritative.
 * Draw native Senpa coordinates or sample the independently selected Ryuten client profile.
 * No duplicate socket or stacked position/camera interpolator. */
(() => {
    'use strict';
    const rp = window.RYUTEN_PORT;
    class WorldBridge {
        constructor(host, reference) {
            this.h = host;
            this.r = reference;
            this.cells = new Map();
            this.clients = new Map();
            this.players = new Map();
            this.nextView = 1;
            this.offset = 0;
            this.lastSide = 0;
            this.lastClientId = -999;
            this.model=host.world;this.selfGroup=null;
            this.frameCount = 0;this.seen=new Set();
            reference.Be._2997 = (slot, alive) => { reference.Be._7330[slot] = alive; reference.Be._6881 = reference.Be._7330.some(Boolean); };
        }
        reset() { rp.motion?.reset();rp.cosmetics?.reset(); this.cells.clear(); this.clients.clear(); this.players.clear(); this.r.ne._6212(); this.r.Be._6212(); this.lastClientId = -999; this.nextView = 1;this.selfGroup=null; }
        client(id, source) { let c = this.clients.get(id); if (!c) {
            c = new this.r.p(id, '', '', '', 0, ['', 0], '');
            this.clients.set(id, c);
            this.r.ne._2708.set(id, c);
        } const own = id>=0&&(this.model.ownedClientIDs?this.model.ownedClientIDs.has(id):id===this.h.world.myClientID); c._9710 = own; c._6988 = String(source?.nick || (own ? this.h.player.nick : '') || 'Unnamed player'); c._senpaTeamId = String(source?.tag || ''); c._9067 = String(source?.clanTag || ''); c._8313 = own && rp.shieldsEnabled ? (this.r.pe._2874.shield || '') : ''; if (own && !this.model.isMultibox) {
            this.r.Be._4167 = id;
            this.r.Be._1059 = c;
        } c._senpaNameColor=rp.nameColor(source?.teamColor);return c; }
        player(id, source) { let p = this.players.get(id); if (!p) {
            p = this.r.ne._2986(id, new this.r.y(133, 133, 133), '');
            this.players.set(id, p);
        } const index = this.model.ownerSlots?.get(id) ?? this.model.myPlayerIDs.indexOf(id); const own = index >= 0; const cid = this.model.isMultibox?(source?.parentClientID??-1):own ? this.h.world.myClientID : (source?.parentClientID ?? -1); const client = this.client(cid, this.model.clientsList.get(cid) || source?.parentClient); if (p._1059 !== client) {
            if (p._1059 && p._1059 !== this.r.f)
                p._1059._4221.delete(id);
            p._1059 = client;
            client._4221.set(id, p);
        } p._3090 = own ? index : Math.max(0, [...client._4221.keys()].indexOf(id)); p._6728._4659(source?.r ?? 133, source?.g ?? 133, source?.b ?? 133); const ownClient = this.model.clientsList.get(this.h.world.myClientID); const teammate = cid === this.h.world.myClientID || !!(ownClient?.tag && ownClient.tag === client._senpaTeamId); const showSkin = this.h.settings.cellSkin && (own || (teammate ? this.h.settings.teammateCellSkin : this.h.settings.enemyCellSkin)); const local=own&&this.model.isMultibox?rp.parentPort.multibox.profile(rp.parentPort.multibox.profileIndex(index)):null;const skin = showSkin ? (local?.skinMode==='none'?'':local?.skinMode==='url'?local.url:rp.resolveSkinURL(source?.skinURL || '')) : ''; if (p._3661 !== skin)
            p._3661 = skin; if (own && !this.r.Be._6328[index])
            this.r.Be._6328[index] = new this.r.g; return p; }
        remove(key, entry) { if (entry.view._2182 !== this.r.C)
            entry.view._2182._2430.delete(entry.view._9782); this.r.ne._2430.delete(entry.view._9782); this.cells.delete(key); }
        sync() {
            const base=this.h;this.model=rp.parentPort.multibox?.worldView?.build()||base.world;
            const h={...base,world:this.model},r=this.r,side=Math.max(1,h.border.right-h.border.left);
            this.offset = (65535 - side) / 2 - h.border.left;
            if (this.lastSide !== side) {
                r.ne._2908(side);
                this.lastSide = side;
            }
            if (this.lastClientId !== h.world.myClientID) {
                this.lastClientId = h.world.myClientID;
            }
            for (const [id, c] of h.world.clientsList)
                this.client(id, c);
            for (const [id, p] of h.world.playersList)
                this.player(id, p);
            if (h.world.myClientID >= 0) {
                this.client(h.world.myClientID, h.world.clientsList.get(h.world.myClientID));
                for (const id of h.world.myPlayerIDs)
                    this.player(id, h.world.playersList.get(id));
            }
            const seen=this.seen;seen.clear();
            for (const [key, cell] of h.world.cells) {
                if (cell.type < 0 || cell.type > 3 || cell.type === 3 && !h.settings.pellets)
                    continue;
                seen.add(key);
                let entry = this.cells.get(key);
                if (entry && entry.source !== cell) {
                    if(this.model.isMultibox && entry.source.id===cell.id && entry.source.parentPlayerID===cell.parentPlayerID && !entry.source.removed && !cell.removed){
                        // The view outlives either mirrored native Cell object.
                        rp.motion?.rebind(entry.source,cell,rp.motion.frameNow);
                        entry.source=cell;entry.view._senpaSource=cell;
                    }else{this.remove(key,entry);entry=null;}
                }
                if (!entry) {
                    const view = r.ne._9190(this.nextView++, cell.x + this.offset, cell.y + this.offset, Math.max(0, cell.radius), [1, 3, 2, 4][cell.type] ?? 1);
                    entry = { source: cell, view };
                    this.cells.set(key, entry);
                    view._senpaSource = cell;
                    view._senpaBridge = this;
                    view._5792 = function () { const s = this._senpaSource, o = this._senpaBridge.offset, pose=rp.motion?.sample(s)||{x:s.x,y:s.y,r:s.radius,u:s.dt}; this._7847 = pose.x + o; this._9202 = pose.y + o; this._1904 = Math.max(0, pose.r); this._5277 = s.endX + o; this._1299 = s.endY + o; this._3933 = Math.max(0, s.endRadius); this._9491 = !!s.removed; this._8215 = pose.u; };
                    Object.defineProperty(view, '_2427', { get: () => entry.source.removed ? Math.max(0, 1 - view._8215) : 1 });
                }
                const view = entry.view;
                view._5792();
                view._7926 = [1, 3, 2, 4][cell.type] ?? 1;
                const parent = (cell.parentPlayerID >= 0) ? this.player(cell.parentPlayerID, h.world.playersList.get(cell.parentPlayerID) || cell.parentPlayer) : r.C;
                if (view._2182 !== parent) {
                    if (view._2182 !== r.C)
                        view._2182._2430.delete(view._9782);
                    view._2182 = parent;
                    if (parent !== r.C && !cell.removed)
                        parent._2430.set(view._9782, view);
                }
                if (cell.removed && parent !== r.C)
                    parent._2430.delete(view._9782);
                if (cell.color&&entry.lastColor!==cell.color) {
                    entry.lastColor=cell.color;const rgb = parseInt(String(cell.color).replace('#', ''), 16);
                    if (Number.isFinite(rgb))
                        view._6728._4659((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
                }
            }
            for (const [key, entry] of this.cells)
                if (!seen.has(key))
                    this.remove(key, entry);
            if(this.model.isMultibox){
                this.selfGroup??=new r.p(-2,'','','',0,['',0],'');this.selfGroup._9710=true;this.selfGroup._4221.clear();
                for(const id of h.world.myPlayerIDs){const p=this.players.get(id);if(p)this.selfGroup._4221.set(id,p);}
                r.Be._4167=h.world.myClientID;r.Be._1059=this.selfGroup;
            }
            r.Be._7330 = h.world.myCells.map(c => c.size > 0);
            r.Be._6881 = this.model.isMultibox?r.Be._7330.some(Boolean):!!h.player.isAlive;
            r.Be._4409 = this.model.isMultibox?this.model.activeSlot:Math.max(0,h.player.activeTab||0);
            r.Be._8709 = h.player.nick;
            r.Be._6448 = h.player.teamTag;
            if (++this.frameCount % 30 === 0) {
                for (const [id, p] of this.players)
                    if (!h.world.playersList.has(id) && !h.world.myPlayerIDs.includes(id) && !p._2430.size) {
                        p._1059?._4221.delete(id);
                        r.ne._4221.delete(id);
                        this.players.delete(id);
                    }
                for (const [id, c] of this.clients)
                    if (!h.world.clientsList.has(id) && !h.world.ownedClientIDs?.has(id) && id !== h.world.myClientID && !c._4221.size) {
                        this.clients.delete(id);
                        r.ne._2708.delete(id);
                    }
            }
            const teamSeen = new Set();
            for (const [id, member] of h.world.minimapPlayers) {
                const p = this.players.get(id);
                if (!p)
                    continue;
                teamSeen.add(id);
                let m = r.ne._8202.get(id);
                if (!m) {
                    m = r.ne._5492(id, p);
                    m._5792 = () => { };
                }
                m._6771 = true;
                m._2182 = p;
                m._7847 = m._5277 = member.x + this.offset;
                m._9202 = m._1299 = member.y + this.offset;
                m._7906 = Math.max(0, member.radius * member.radius / 100);
            }
            for (const id of r.ne._8202.keys())
                if (!teamSeen.has(id))
                    r.ne._8202.delete(id);
        }
        camera() { if(rp.motion?.camera())return; const r = this.r, h = this.h; const scale = r.X_._3473 / Math.max(1, window.innerWidth); r.z_._3852._5117(h.camera.x + this.offset, h.camera.y + this.offset); r.z_._4336 = Math.max(.0001, h.camera.zoom * scale); r.z_._9695(); }
        snapshot() { return { views: this.cells.size, nativeCells: (this.model||this.h.world).cells.size, players: this.players.size, ownFragments: (this.model||this.h.world).myCells.map(x => x.size), active: this.model?.isMultibox?this.model.activeSlot:this.h.player.activeTab, animationMs: this.h.settings.cellAnimation, style: rp.motion?.style||'Senpa', ryutenAnimationMs:rp.motion?.delay, camera: { x: this.h.camera.x, y: this.h.camera.y, zoom: this.h.camera.zoom } }; }
    }
    rp.modules.WorldBridge = WorldBridge;
})();

/* One canonical setting per shared concept. Hidden aliases exist only for native render internals. */
(() => {
  'use strict';
  const rp=window.RYUTEN_PORT;
  rp.modules.mergeSettings=(h,r)=>{
    const bindings=[],covered=new Set(),nativeRows=new Map();let syncing=false;
    const definitions=h.settingsStore.definitions;
    const keyOut=k=>k==='ESC'?'ESCAPE':k==='NONE'?'NO KEY':k==='BACKQUOTE'?'TILDE':k;
    const keyIn=k=>[k==='NO KEY'?'NONE':k,'NONE'];
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const hide=(...keys)=>keys.forEach(k=>{if(r.Q[k])r.Q[k]._portHidden=true;});
    const add=(key,setting,defaultValue)=>{
      r.Q[key]=setting;r.F[key]=defaultValue??setting._5997();setting._4935('change',r.Y);return setting;
    };
    function wire(qkey,hkey,to=v=>v,from=v=>v){
      const s=r.Q[qkey];if(!s||!definitions[hkey])return;
      covered.add(hkey);bindings.push({qkey,hkey,toNative:to,fromNative:from});
      s._5738=from(h.settings[hkey]);
      s._4935('change',value=>{if(!syncing)rp.parentPort.setSetting(hkey,to(value));});
    }
    const style=add('PRESENTATION_STYLE',new r.L({_8192:'Animation / gameplay style',
      _5901:'Senpa/Ryuten keep native camera and gameplay. XPLUS ULTRA deliberately delays visible cells, camera and zoom for a floaty test. No server physics changes; not video-calibrated.',
      _8592:['Gameplay','Animation'],_8328:rp.setting('motion-style','Senpa'),_5331:['Senpa','Ryuten','XPLUS']}),'Senpa');
    const condition=value=>[{_9782:'PRESENTATION_STYLE',_8328:value}];
    const feedValue=Number(rp.setting('feed-interval-ms',0));
    const feed=add('FEED_INTERVAL_MS',new r.T({_8192:'Macro feed interval',
      _5901:'0 uses native Senpa automatic feed. Custom feed sends one native eject request every 1–5000 ms while held. Very small browser timers are best effort; server rate limits and pellet physics remain authoritative.',
      _8592:['Gameplay','Feed'],_8328:Number.isFinite(feedValue)&&feedValue>0?Math.max(1,Math.min(5000,Math.round(feedValue))):0,
      _1690:0,_8146:5000,_8604:1,_2782:v=>v===0?'Native (server cadence)':v+' ms',
      _1195:v=>Number.isInteger(v)&&(v===0||v>=1&&v<=5000)}),0);
    // Optional request-rate experiment. Native held-feed remains the default.
    const fast=add('FAST_FEED_TEST',new r.I({_8192:'Fast feed test — 10 ms requests',
      _5901:'While the feed key is held, request one native eject every 10 ms (up to 100 requests/s before browser delays). This does not bypass Senpa cooldowns or promise faster accepted pellets. Switching keeps the current timer; blur/chat/menu/disconnect stops it.',
      _8592:['Gameplay','Feed'],_8328:rp.setting('fast-feed-test',false)===true}),false);
    rp.effectiveFeedInterval=()=>fast._5997()?10:feed._5997();
    rp.applyFeedTiming=()=>{rp.feedTiming?.setIntervalMs(rp.effectiveFeedInterval());rp.refreshFeedUI?.();};
    feed._4935('change',value=>{rp.saveSetting('feed-interval-ms',value);rp.applyFeedTiming();});
    fast._4935('change',value=>{
      rp.feedTiming?.release('feed-test-mode-change');
      rp.saveSetting('fast-feed-test',value);rp.applyFeedTiming();
    });
    function nativeRow(key,category,group,label){
      const d=definitions[key];if(!d)return;
      const opt={_8192:label||d.name||key,_5901:(d.message||'')+' Native Senpa preference; changes are shared with Senpa’s own settings.',
        _8592:[category,group],_8328:h.settings[key]};
      let s,to=v=>v,from=v=>v;
      if(d.type==='range')s=new r.T({...opt,_1690:d.min,_8146:d.max,_8604:d.step||1,
        _2782:v=>key==='cellAnimation'?v+' ms':String(v)});
      else if(d.type==='toggle')s=new r.I({...opt,_8328:!!h.settings[key]});
      else if(d.type==='dropdown'){
        s=new r.L({...opt,_8328:String(h.settings[key]),_5331:(d.list||[]).map(x=>String(x.value))});
        to=v=>d.list.find(x=>String(x.value)===v)?.value;from=v=>String(v);
      }else if(d.type==='hotkey'){
        s=new r.M({...opt,_8328:keyIn(h.settings[key])});to=v=>keyOut(v[0]);from=keyIn;
      }else if(d.type==='colorpicker'){
        to=v=>'#'+(Number(v)&0xffffff).toString(16).padStart(6,'0');
        from=v=>parseInt(String(v).replace('#',''),16)||0;
        s=new r.R({...opt,_6728:from(h.settings[key])});
      }else s=new r.N({...opt,_8328:String(h.settings[key]??''),_7341:2048});
      const qkey='SENPA_'+key;add(qkey,s,from(d.default));wire(qkey,key,to,from);nativeRows.set(key,s);return s;
    }
    nativeRow('cellAnimation','Gameplay','Animation','Senpa animation delay')._4039=condition('Senpa');
    nativeRow('cameraSpeed','Gameplay','Camera','Senpa camera speed (Senpa / Ryuten)');
    nativeRow('zoomSpeed','Gameplay','Camera','Wheel zoom increment (all profiles)');
    // RC1 overwrote these source ranges with Senpa's values. Restore source defaults only in the NEW profile.
    for(const [key,label,defaultMs,min,max,step,format] of [
      ['ELEMENT_ANIMATION_SOFTENING','Ryuten animation delay',160,80,300,10,v=>`${(v-80)/2}% · ${v} ms`],
      ['CAMERA_MOVEMENT_SPEED','Ryuten camera follow',8,101,2,-1,v=>(102-v)+'%'],
      ['CAMERA_ZOOM_SPEED','Ryuten wheel zoom speed',4,2,20,1,v=>(v*.5)+'x']]){
      const old=r.Q[key];const saved=rp.setting('ryuten-motion-'+key,defaultMs);
      const setting=add(key,new r.T({_8192:label,_5901:'Original captured Ryuten client response. Camera coefficients are per rendered frame, as in the source.',
        _8592:old._8592,_8328:Math.max(Math.min(min,max),Math.min(Math.max(min,max),Number(saved)||defaultMs)),_1690:min,_8146:max,_8604:step,_2782:format,_4039:condition('Ryuten')}),defaultMs);
      setting._4935('change',v=>{rp.saveSetting('ryuten-motion-'+key,v);rp.refreshMotionUI?.();});
    }
    hide('CAMERA_MOVEMENT_SPEED','CAMERA_ZOOM_SPEED'); // No misleading inert Ryuten camera knobs.
    const xp=add('XPLUS_SETTLE_MS',new r.T({_8192:'XPLUS ULTRA smoothness / visual delay',
      _5901:'95% stationary-step cell settling. Cell, radius, camera and zoom settling are capped at 500 ms. Higher = floatier and later. Visual positions can disagree with collision state. Experimental; Senpa/Ryuten unchanged.',
      _8592:['Gameplay','Animation'],_8328:rp.modules.normalizeXplusMs(rp.setting('xplus-ultra-settle-ms',420)),
      _1690:120,_8146:500,_8604:10,_2782:v=>v+' ms · visual lag',_4039:condition('XPLUS')}),420);
    // Clamp every entry point, including imports, resets and the console API.
    const setXplus=xp._7531.bind(xp);
    xp._7531=value=>setXplus(rp.modules.normalizeXplusMs(value));
    const priorXplus=rp.setting('xplus-ultra-settle-ms',420);
    if(priorXplus!==xp._5997()){
      rp.saveSetting('xplus-before-500-cap',priorXplus);
      rp.saveSetting('xplus-ultra-settle-ms',xp._5997());
    }
    xp._4935('change',v=>{rp.saveSetting('xplus-ultra-settle-ms',v);rp.refreshMotionUI?.();});
    const ring=add('MULTIBOX_RING',new r.I({_8192:'Active multibox ring',_5901:'Independent active-unit ring. Does not replace, equip, or require an account shield.',
      _8592:['Gameplay','Visibility scopes'],_8328:rp.setting('multibox-ring',true)}),true);
    ring._4935('change',v=>rp.saveSetting('multibox-ring',v));
    const line=add('HK_LINE_SPLIT',new r.M({_8192:'Line split toward mouse (experimental)',
      _5901:'Optional one-shot directional split. Centers aim briefly, then splits toward the captured mouse direction. Server rules still control the outcome. Unbound by default.',
      _8592:['Controls','Game controls'],_8328:rp.setting('line-split-key',['NONE','NONE'])}),['NONE','NONE']);
    line._4935('change',v=>rp.saveSetting('line-split-key',v));
    wire('SHOW_ENEMY_USERNAME','cellNick');r.Q.SHOW_ENEMY_USERNAME._8192='Show names';
    wire('SHOW_ENEMY_ENERGY','cellMass');r.Q.SHOW_ENEMY_ENERGY._8192='Show mass';
    wire('SHOW_CUSTOM_SKINS','cellSkin');r.Q.SHOW_CUSTOM_SKINS._8192='Show skins';
    wire('SHOW_TEAM_NAME','cellClanTag');r.Q.SHOW_TEAM_NAME._8192='Show clan tags';
    r.Q.SHOW_TEAM_NAME._5901='Displays Senpa clanTag when supplied. Internal team membership IDs are never shown as labels.';
    hide('SHOW_OWN_USERNAME','SHOW_OWN_ENERGY','SHOW_OWN_CUSTOM_SKINS');
    r.Q.SHOW_OWN_USERNAME._5997=()=>!!(h.settings.cellNick&&h.settings.ownCellNick);
    r.Q.SHOW_OWN_ENERGY._5997=()=>!!(h.settings.cellMass&&h.settings.ownCellMass);
    r.Q.SHOW_OWN_CUSTOM_SKINS._5997=()=>!!h.settings.cellSkin;
    nativeRow('ownCellNick','Gameplay','Visibility scopes','Include my name')._4039=[{_9782:'SHOW_ENEMY_USERNAME',_8328:true}];
    nativeRow('ownCellMass','Gameplay','Visibility scopes','Include my mass')._4039=[{_9782:'SHOW_ENEMY_ENERGY',_8328:true}];
    nativeRow('enemyCellSkin','Gameplay','Visibility scopes','Include enemy skins')._4039=[{_9782:'SHOW_CUSTOM_SKINS',_8328:true}];
    nativeRow('teammateCellSkin','Gameplay','Visibility scopes','Include teammate skins')._4039=[{_9782:'SHOW_CUSTOM_SKINS',_8328:true}];
    for(const [qkey,hkey]of Object.entries({CAMERA_AUTO_ZOOM:'autoZoom',AUTO_SWITCH_ACTIVE_PLAYER_UNIT:'autoSwitchCells',
      CURSOR_LINES:'mouseTracker',ACTIVE_PLAYER_UNIT_ARROW_INDICATOR:'activeCellIndicator'}))wire(qkey,hkey);
    // Native Senpa owns replay and input; remove the second recorder toggle and duplicate replay controls.
    hide('INSTANT_REPLAY','HK_SELECT_PLAYER_FOR_SPECTATING','HK_RESPAWN','COMMANDER','HK_COMMANDER',
      'HK_TOGGLE_OWN_USERNAME','HK_TOGGLE_OWN_ENERGY','HK_TOGGLE_OWN_CUSTOM_SKINS',
      'HK_CHATROOM_SWITCH_TO_GLOBAL','HK_CHATROOM_SWITCH_TO_TEAM');
    wire('HK_TOGGLE_ENEMY_USERNAME','hkToggleNick',v=>keyOut(v[0]),keyIn);r.Q.HK_TOGGLE_ENEMY_USERNAME._8192='Toggle names';
    wire('HK_TOGGLE_ENEMY_ENERGY','hkToggleMass',v=>keyOut(v[0]),keyIn);r.Q.HK_TOGGLE_ENEMY_ENERGY._8192='Toggle mass';
    wire('HK_TOGGLE_CUSTOM_SKINS','hkToggleOwnSkin',v=>keyOut(v[0]),keyIn);r.Q.HK_TOGGLE_CUSTOM_SKINS._8192='Toggle skins';
    r.Q.HK_SAVE_INSTANT_REPLAY._4039=[];
    const keys={HK_SPLIT:'hkSplit',HK_SPLIT_2X:'hkDoubleSplit',HK_SPLIT_3X:'hkTripleSplit',HK_SPLIT_4X:'hkSplit16',
      HK_SPLIT_6X:'hkSplit64',HK_EJECT:'hkFeed',HK_MACRO_EJECT:'hkMacroFeed',HK_SWITCH_ACTIVE_PLAYER_UNIT:'hkTogglePlayer',
      HK_CHANGE_SPECTATE_MODE:'hkToggleSpectateMode',HK_STOP_MOVEMENT:'hkStop',HK_SAVE_INSTANT_REPLAY:'hkReplay'};
    for(const [q,hk]of Object.entries(keys))wire(q,hk,v=>keyOut(v[0]),keyIn);
    for(let i=1;i<=10;i++){wire('QUICK_CHAT_'+i+'_MESSAGE','command'+i);wire('HK_QUICK_CHAT_'+i,'hkCommand'+i,v=>keyOut(v[0]),keyIn);}
    for(let i=1;i<=5;i++)wire('HK_ZOOM_LEVEL_'+i,'hkZoom'+i,v=>keyOut(v[0]),keyIn);
    // The menu/loading wallpaper is NOT the gameplay map. Resolve only a
    // locally bundled original or an explicitly imported image, never that logo.
    rp.modules.migrateWorldMap(h,r);
    wire('WORLD_BACKGROUND_IMAGE','backgroundImage');r.Q.WORLD_BACKGROUND_IMAGE._8192='Map background image';
    wire('BACKGROUND_IMAGE_URL','backgroundImageURL');r.Q.BACKGROUND_IMAGE_URL._8192='Local map image (import below)';
    r.F.WORLD_BACKGROUND_IMAGE=!!rp.modules.bundledRyutenMap();
    r.F.BACKGROUND_IMAGE_URL=rp.modules.bundledRyutenMap()||'';
    for(const [qkey,hkey]of Object.entries({BORDER_COLOR:'borderColor',PARTICLE_COLOR:'foodColor',BACKGROUND_COLOR:'backgroundColor',
      ILL_ORB_BORDER_COLOR:'virusColor2',ILL_ORB_BASE_COLOR:'virusColor1',ACTIVE_PLAYER_UNIT_ACCENT_COLOR:'activeCellBorderColor',BORDER_GLOW_COLOR:'borderGlowColor'}))
      wire(qkey,hkey,v=>'#'+(Number(v)&0xffffff).toString(16).padStart(6,'0'),v=>parseInt(String(v).replace('#',''),16));
    // The single opacity control drives the actual Ryuten compositor; no competing transparency slider.
    hide('ORB_TRANSPARENCY');r.Q.ORB_TRANSPARENCY._5997=()=>100-h.settings.cellOpacity;
    nativeRow('cellOpacity','Theme','Orb','Cell opacity');
    // Width ranges must use native units, not silently clamp Senpa's 250 to a Ryuten-only range.
    const width=definitions.borderWidth;
    add('BORDER_SIZE',new r.T({_8192:'Border width',_5901:'Shared border width in world units.',_8592:['Theme','World'],_8328:h.settings.borderWidth,_1690:width.min,_8146:width.max,_8604:width.step}),width.default);
    wire('BORDER_SIZE','borderWidth');
    r.Q.BORDER_SIZE._5997=()=>h.settings.mapBorders?h.settings.borderWidth:0;
    covered.add('ownCellColoring');
    r.Q.OWN_ORB_COLORING._5331=['default','custom','multibox'];
    r.Q.OWN_ORB_COLORING._5738=rp.setting('own-color-mode',h.settings.ownCellColoring==='multibox'?'multibox':'default');
    r.Q.OWN_ORB_COLORING._5901='DEFAULT: authoritative game colors. CUSTOM: own-color picker. MULTIBOX: active/inactive accents for every logical slot, independent of equipped shields.';
    r.Q.OWN_ORB_COLORING._4935('change',v=>{rp.saveSetting('own-color-mode',v);rp.parentPort.setSetting('ownCellColoring',v==='multibox'?'multibox':'normal');});
    // Original-native-only rendering details are not duplicated as nonfunctional switches in the Pixi UI.
    const nativeOnly=new Set(['useWebGL','graphicsQuality','nicknameFont','massFont','cellTextAnimation','useFoodGlow','foodGlowColor','foodGlowDistance','foodGlowStrength',
      'useVirusGlow','virusGlowColor','virusGlowDistance','virusGlowStrength','virusBorderWidth','activeCellBorderWidth','activeCellBorder','activeCellIndicatorColor','activeCellIndicatorSize',
      'useRainbow','useBorderGlow','borderGlowDistance','borderGlowStrength','mapSectors','grid','sectorGridColor','sectorGridWidth','sectorTextColor','sectorTextSize',
      'emojiSize','emojiEnabled','directionMarkerType','cellMassFormat','nickSize','massSize','cellNickStroke','cellMassStroke','autoHideText']);
    rp.nativeOnlySettings=[...nativeOnly];
    for(const [category,groups]of Object.entries(h.schema))for(const [group,defs]of Object.entries(groups))for(const [key,d]of Object.entries(defs)){
      if(d.type==='button'||covered.has(key)||nativeOnly.has(key)||category==='importexport')continue;
      const cat=category==='controls'?'Controls':category==='theme'?'Theme':category==='mobile'?'Gameplay':category==='settings'?'Gameplay':'Gameplay';
      nativeRow(key,cat,group.replaceAll('_',' '));
    }
    rp.settingsBindings=bindings;rp.nativeSettingCount=covered.size;rp.nativeOnlySettings.sort();
    rp.settingsChanged=()=>{
      if(syncing)return;syncing=true;
      try{for(const b of bindings){const value=b.fromNative(h.settings[b.hkey]),s=r.Q[b.qkey];if(!same(s._5997(),value))s._7531(value);}}
      finally{syncing=false;}
      rp.refreshMotionUI?.();
    };
    rp.exportSettings=()=>rp.download('ryuten-senpa-settings.json',JSON.stringify({version:2,
      senpa:Object.fromEntries(Object.keys(definitions).filter(k=>k!=='useWebGL').map(k=>[k,h.settings[k]])),
      ryuten:Object.fromEntries(Object.entries(r.Q).filter(([k,v])=>!v._portHidden&&!bindings.some(b=>b.qkey===k)).map(([k,v])=>[k,v._5997()])),
      cosmetics:{shield:r.pe._2874.shield},multibox:{version:1,profiles:rp.parentPort.multibox?.profiles}},null,2));
    rp.importSettings=async file=>{
      if(file.size>2*1024*1024)throw Error('Settings file is too large');
      const data=JSON.parse(await file.text());
      if(![1,2].includes(data.version)||!data.senpa||!data.ryuten)throw Error('Not a merged Ryuten / Senpa settings file');
      for(const [key,value]of Object.entries(data.senpa))if(Object.hasOwn(definitions,key))rp.parentPort.setSetting(key,value);
      for(const [key,value]of Object.entries(data.ryuten))if(Object.hasOwn(r.Q,key)&&!r.Q[key]._portHidden&&!bindings.some(b=>b.qkey===key))r.Q[key]._7531(value);
      if(data.cosmetics?.shield&&r.pe._1763[data.cosmetics.shield])r.Me._2232(data.cosmetics.shield);
      // Account skins are NOT credentials-free settings; never overwrite an authenticated skin selection on import.
      if(Array.isArray(data.multibox?.profiles))data.multibox.profiles.slice(0,2).forEach((p,i)=>rp.parentPort.multibox?.profile(i,p));
      rp.modules.migrateWorldMap(h,r);rp.refreshMultiboxUI?.();rp.settingsChanged();
    };
    // All aliases participate in native rendering but not Discard/Reset transactions.
    r.bt._8758=function(){for(const [key,value]of Object.entries(this._2194))if(!r.Q[key]._portHidden)r.Q[key]._7531(Array.isArray(value)?value.slice():value);rp.settingsChanged();};
    r.bt._1817=function(){for(const [key,value]of Object.entries(r.F)){const s=r.Q[key];if(s&&!s._portHidden&&s._8592[0]===this._4247)s._7531(Array.isArray(value)?value.slice():value);}rp.settingsChanged();this._1338();};
  };
})();

/* Optional appearance presets based on the supplied Onyxx CSS/custom palette.
 * Applying a theme never changes animation, camera, account, skins or networking.
 */
(()=>{'use strict';const rp=window.RYUTEN_PORT;
  rp.modules.installThemes=(h,r)=>{
    const palettes={
      'Onyxx Gold':{BACKGROUND_COLOR:0x0e0e12,BORDER_COLOR:0xe0a82e,BORDER_GLOW_COLOR:0xffcb3d,
        PARTICLE_COLOR:0xe0a82e,ILL_ORB_BORDER_COLOR:0xe0a82e,ACTIVE_PLAYER_UNIT_ACCENT_COLOR:0xe0a82e},
      'Onyxx Nova':{BACKGROUND_COLOR:0x05060c,BORDER_COLOR:0x22d3ee,BORDER_GLOW_COLOR:0xa78bfa,
        PARTICLE_COLOR:0x38bdf8,ILL_ORB_BORDER_COLOR:0xa78bfa,ACTIVE_PLAYER_UNIT_ACCENT_COLOR:0x22d3ee}
    };
    const key='APPEARANCE_PRESET',saved=rp.setting('appearance-preset','Ryuten');
    let current='Ryuten';let backup=rp.setting('appearance-before-onyxx',null);
    const apply=value=>{
      if(!['Ryuten','Onyxx Gold','Onyxx Nova'].includes(value))return;
      if(value!=='Ryuten'&&current==='Ryuten'&&!backup){backup=Object.fromEntries(Object.keys(palettes['Onyxx Gold']).filter(k=>r.Q[k]).map(k=>[k,r.Q[k]._5997()]));rp.saveSetting('appearance-before-onyxx',backup);}
      if(value==='Ryuten'&&current!=='Ryuten'&&backup){for(const[k,v]of Object.entries(backup))r.Q[k]?._7531(v);backup=null;rp.saveSetting('appearance-before-onyxx',null);}
      else if(palettes[value])for(const[k,v]of Object.entries(palettes[value]))r.Q[k]?._7531(v);
      current=value;document.documentElement.dataset.appearance=value==='Ryuten'?'ryuten':value==='Onyxx Gold'?'onyxx-gold':'onyxx-nova';
      rp.saveSetting('appearance-preset',value);rp.refreshMultiboxUI?.();
    };
    r.Q[key]=new r.L({_8192:'Appearance preset',_5901:'Ryuten is unchanged by default. Onyxx Gold/Nova adapt the supplied theme palettes; no motion or gameplay settings change.',_8592:['Theme','Preset'],_8328:['Ryuten','Onyxx Gold','Onyxx Nova'].includes(saved)?saved:'Ryuten',_5331:['Ryuten','Onyxx Gold','Onyxx Nova']});
    r.F[key]='Ryuten';r.Q[key]._4935('change',r.Y);r.Q[key]._4935('change',apply);
    apply(r.Q[key]._5997());
  };
})();

/* Main Ryuten multibox UI: EU WindBine only. */
(()=>{'use strict';const rp=window.RYUTEN_PORT,pp=rp.parentPort;
  rp.modules.multiboxSettings=(h,r)=>{
    const m=pp.multibox,key='WINDBINE_MULTIBOX_ENABLED';
    r.Q[key]=new r.I({_8192:'WindBine multibox — two pairs',_5901:'EU WindBine only. Each pair uses one name and both native Senpa player tabs. Pair 2 starts only when requested, using the original Senpa engine and server verification. Native dual modes are unchanged.',_8592:['Gameplay','Multibox'],_8328:m.windbineEnabled});
    r.F[key]=false;r.Q[key]._4935('change',r.Y);r.Q[key]._4935('change',v=>m.setWindBineEnabled(v));
    r.Q.FFA_MULTIBOX_ENABLED=new r.I({_8192:'FFA multibox (default on)',_5901:'Two isolated native FFA engines with one assigned player each. P2 connects automatically after the primary FFA handshake by default, and must pass Senpa verification. Selecting P2 still owns spawning. Other game modes retain their own native tab count.',_8592:['Gameplay','Multibox'],_8328:m.ffaEnabled});
    r.F.FFA_MULTIBOX_ENABLED=true;r.Q.FFA_MULTIBOX_ENABLED._4935('change',r.Y);r.Q.FFA_MULTIBOX_ENABLED._4935('change',v=>m.setFFAEnabled(v));
    r.Q.FFA_AUTO_CONNECT=new r.I({_8192:'Auto-connect FFA P2 (default on)',_5901:'Open the existing secondary FFA connection after P1 has a valid single-slot handshake. No auto-spawn, no extra connections, no verification bypass. A manual disconnect is respected until rejoining or an explicit retry.',_8592:['Gameplay','Multibox'],_8328:m.ffaAutoConnect});
    r.F.FFA_AUTO_CONNECT=true;r.Q.FFA_AUTO_CONNECT._4935('change',r.Y);r.Q.FFA_AUTO_CONNECT._4935('change',v=>m.setFFAAutoConnect(v));
  };
  rp.modules.installMultiboxUI=(h,r)=>{
    const m=pp.multibox,el=rp.el,$=id=>document.getElementById(id),isWindBine=()=>m.isWindBine;
    const accountSync=rp.syncAccountSkins;
    rp.syncAccountSkins=()=>{
      accountSync();if(!m.enabled||!m.isSupported)return;if(m.isFFA){for(let slot=0;slot<2;slot++){const profile=m.profiles[slot];if(profile.skinMode!=='account'){const url=profile.skinMode==='url'?profile.url:'';r.Be._4564[slot]=url;r.is._2736[slot+2]=url;r.Ue._3901[slot===0?'_9315':'_8053']=url;}}return;}
      const p=m.profiles[0],url=p.skinMode==='url'?p.url:'';
      if(p.skinMode!=='account'){for(let slot=0;slot<2;slot++){r.Be._4564[slot]=url;r.is._2736[slot+2]=url;}r.Ue._3901._9315=url;r.Ue._3901._8053=url;}
    };
    const nativePicker=pp.openSkinPicker;
    pp.openSkinPicker=slot=>{if(m.enabled&&m.isSupported)m.profile(slot===1?1:0,{skinMode:'account'});return nativePicker(slot===1?1:0);};
    const hero=$('senpa-hero'),identity=$('senpa-identity'),firstInput=identity.querySelectorAll('input')[1];
    const secondLabel=el('label',{id:'senpa-pair2-name-label'},'PAIR 2 NAME');
    const secondName=el('input',{id:'senpa-pair2-name',maxLength:30,autocomplete:'off','aria-label':'WindBine pair 2 name',value:m.profiles[1].name});secondLabel.append(secondName);identity.append(secondLabel);
    if(m.enabled&&m.profiles[0].name)firstInput.value=m.profiles[0].name;
    const commit=rp.commitIdentity;
    rp.commitIdentity=()=>{const n1=firstInput.value.trim(),n2=secondName.value.trim();commit();if(m.enabled&&m.isSupported){m.profile(0,{name:n1});m.profile(1,{name:n2});}rp.refreshMultiboxUI?.();};
    secondName.onchange=rp.commitIdentity;
    const trigger=el('button',{id:'senpa-multibox-button',className:'sp-button'},'WindBine multibox');hero.append(trigger);
    const dialog=el('dialog',{id:'senpa-multibox-dialog','aria-label':'WindBine multibox settings'});rp.multiboxDialog=dialog;
    const heading=el('header');heading.append(el('h2',{},'FFA / WindBine multibox'));
    const close=el('button',{type:'button',className:'sp-button','aria-label':'Close multibox'},'Back [Esc]');close.onclick=()=>dialog.close();heading.append(close);dialog.append(heading);
    const enabled=el('input',{id:'senpa-multibox-enable',type:'checkbox'});
    const enabledLabel=el('label',{className:'sp-mb-enable'},'Enable EU WindBine multibox ');enabledLabel.prepend(enabled);dialog.append(enabledLabel);
    enabled.onchange=()=>{if(enabled.checked&&!m.profiles[0].name)m.profile(0,{name:firstInput.value.trim()});r.Q.WINDBINE_MULTIBOX_ENABLED._7531(enabled.checked);rp.refreshMultiboxUI();};
    const ffa=el('input',{id:'senpa-ffa-enable',type:'checkbox'}),ffaLabel=el('label',{className:'sp-mb-enable'},'Enable FFA multibox by default ');
    ffaLabel.prepend(ffa);dialog.append(ffaLabel);ffa.onchange=()=>{r.Q.FFA_MULTIBOX_ENABLED._7531(ffa.checked);rp.refreshMultiboxUI();};
    const autoFFA=el('input',{id:'senpa-ffa-auto-connect',type:'checkbox'}),autoLabel=el('label',{className:'sp-mb-enable'},'Connect FFA P2 automatically after joining ');
    autoLabel.prepend(autoFFA);dialog.append(autoLabel);autoFFA.onchange=()=>r.Q.FFA_AUTO_CONNECT._7531(autoFFA.checked);
    const message=el('p',{id:'senpa-multibox-explanation'},'FFA: P1/P2 are independent native connections; Tab switches players. WindBine: two connections with two native tabs each; Tab switches within the pair and Q changes pairs. Every connection must pass the original server verification.');dialog.append(message);
    const near=el('input',{id:'senpa-multibox-near-spawn',type:'checkbox'}),nearLabel=el('label',{className:'sp-mb-enable'},'Spawn empty pairs next to the active pair ');nearLabel.prepend(near);near.onchange=()=>m.setNearSpawn(near.checked);dialog.append(nearLabel);
    const cards=el('div',{className:'sp-mb-cards'}),controls=[];
    for(let slot=0;slot<2;slot++){
      const card=el('section',{className:'sp-mb-card','data-slot':String(slot)});card.append(el('h3',{},'PAIR '+(slot+1)));
      const name=el('input',{maxLength:30,'aria-label':'Pair '+(slot+1)+' name'});
      const nameLabel=el('label',{},'Name (next spawn)');nameLabel.append(name);card.append(nameLabel);
      name.onchange=()=>{m.profile(slot,{name:name.value});(slot===0?firstInput:secondName).value=name.value;if(slot===0)commit();};
      const mode=el('select',{'aria-label':'Pair '+(slot+1)+' skin source'});
      for(const[value,title]of[['account','Senpa account skins'],['url','Local URL cosmetic'],['none','No skins']])mode.append(el('option',{value},title));
      const modeLabel=el('label',{},'Skins');modeLabel.append(mode);card.append(modeLabel);
      const url=el('input',{type:'url',placeholder:'https://…','aria-label':'Pair '+(slot+1)+' local skin URL',maxLength:2048});card.append(url);
      const picker=el('button',{className:'sp-button'},'Open Senpa skin '+(slot+1));picker.onclick=()=>{dialog.close();m.profile(slot,{skinMode:'account'});pp.openSkinPicker(slot);};card.append(picker);
      const preview=el('img',{className:'sp-mb-skin-preview',alt:'Pair '+(slot+1)+' skin preview',referrerPolicy:'no-referrer'});preview.hidden=true;preview.onerror=()=>{preview.hidden=true;};card.append(preview);
      mode.onchange=()=>{m.profile(slot,{skinMode:mode.value});rp.refreshMultiboxUI();};
      url.onchange=()=>{const p=m.profile(slot,{url:url.value});if(url.value&&!p.url)rp.notice('Skin URL','Use a complete HTTPS image URL.');url.value=p.url;rp.refreshMultiboxUI();};
      const play=el('button',{className:'sp-button'},'Activate / spawn pair '+(slot+1));play.onclick=()=>{rp.commitIdentity();dialog.close();m.isFFA?m.request('switch',slot):m.requestPair(slot);};card.append(play);
      const state=el('p',{className:'sp-mb-slot-state'});card.append(state);cards.append(card);controls.push({name,mode,url,picker,preview,state,play});
    }dialog.append(cards);
    dialog.append(el('p',{className:'sp-mb-note'},'Account skins use your real Senpa account and its native equip/verification rules. URL cosmetics are visible only in this browser; they do not grant account skins or bypass server restrictions. Names apply on the next pair spawn.'));
    const theme=el('select',{'aria-label':'Appearance preset'});for(const name of ['Ryuten','Onyxx Gold','Onyxx Nova'])theme.append(el('option',{value:name},name));
    theme.onchange=()=>r.Q.APPEARANCE_PRESET._7531(theme.value);
    const themeLabel=el('label',{className:'sp-mb-theme'},'Appearance (independent of animation) ');themeLabel.append(theme);dialog.append(themeLabel);
    const status=el('p',{id:'senpa-multibox-state'}),verify=el('button',{className:'sp-button',id:'senpa-pair2-verify'},'Open pair 2 verification');
    verify.onclick=()=>{dialog.close();m.aux?.show();};dialog.append(status,verify);
    const stop=el('button',{className:'sp-button'},'Disconnect pair 2');stop.onclick=()=>{m.destroyAux();m.status='Pair 2 disconnected — select it to reconnect';rp.refreshMultiboxUI();};dialog.append(stop);
    document.body.append(dialog);trigger.onclick=()=>{rp.commitIdentity();rp.refreshMultiboxUI();dialog.showModal();};
    document.addEventListener('keydown',event=>{if(!m.enabled||!isWindBine()||event.repeat||String(event.key).toUpperCase()!=='Q'||event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;event.preventDefault();event.stopImmediatePropagation();m.request('switch-pair');},true);
    rp.refreshMultiboxUI=()=>{
      rp.syncAccountSkins();const s=m.snapshot();if(m.enabled&&document.activeElement!==firstInput&&m.profiles[0].name)firstInput.value=m.profiles[0].name;if(document.activeElement!==secondName)secondName.value=m.profiles[1].name;enabled.checked=m.windbineEnabled;ffa.checked=m.ffaEnabled;autoFFA.checked=m.ffaAutoConnect;near.checked=m.nearSpawn;near.disabled=!m.enabled||!m.isWindBine;nearLabel.hidden=!m.isWindBine;theme.value=r.Q.APPEARANCE_PRESET._5997();
      secondLabel.hidden=!(m.enabled&&m.isSupported);secondLabel.firstChild.textContent=m.isFFA?'PLAYER 2 NAME':'PAIR 2 NAME';firstInput.parentElement.firstChild.textContent=m.enabled&&m.isSupported?(m.isFFA?'PLAYER 1 NAME':'PAIR 1 NAME'):'SENPA NICKNAME';
      trigger.textContent=m.isFFA?'FFA multibox · '+(m.ffaEnabled?(m.multi?'P'+(s.active+1):'Ready'):'Off'):m.enabled?'WindBine multibox · '+(m.multi?'Pair '+(s.activePair+1):isWindBine()?'Ready':'FFA / WindBine only'):'Multibox settings';
      status.textContent=s.error||s.status;verify.hidden=!m.aux;stop.disabled=!m.aux&&!m.loading;
      for(let slot=0;slot<2;slot++){
        const c=controls[slot],p=m.profiles[slot],pair=s.pairs[slot]||(m.isFFA?s.slots[slot]:null),active=m.isFFA?!!pair?.alive:!!pair?.alive?.some(Boolean);
        if(document.activeElement!==c.name)c.name.value=p.name||(slot===0?firstInput.value:'');
        c.mode.value=p.skinMode;if(document.activeElement!==c.url)c.url.value=p.url;
        c.url.hidden=p.skinMode!=='url';c.picker.hidden=p.skinMode!=='account';
        const skin=p.skinMode==='url'?p.url:p.skinMode==='account'?(slot===0?r.Be._4564[0]||r.Be._4564[1]:''):'';
        if(skin&&c.preview.getAttribute('src')!==skin){c.preview.src=skin;c.preview.hidden=false;}if(!skin)c.preview.hidden=true;
        c.state.textContent=active?'Alive'+(s.activePair===slot?' · Active':''):s.pending!=null&&m.sourceIndex(s.pending)===slot?'Respawn queued':pair?.verification?'Verification required':pair?.ready?'Ready':!m.isSupported?'FFA / WindBine only':'Not connected';
      }
    };
    const tabs=rp.updateTabs;
    rp.updateTabs=()=>{tabs();if(!m.multi)return;[...$('senpa-tabs').children].forEach((button,i)=>{button.classList.toggle('active',m.active===i);button.classList.toggle('pending',m.intent?.slot===i);const pair=m.sourceIndex(i),native=m.nativeSlot(i);button.textContent='P'+(i+1);button.title=(m.isFFA?'FFA player '+(i+1):'Pair '+(pair+1)+' · player '+(native+1))+' · '+(m.profiles[pair]?.name||'Player')+' · '+(m.alive(i)?'Alive':'Activate / respawn');});};
    const hud=rp.updateHUD;
    rp.updateHUD=()=>{hud();if(!m.multi)return;
      const team=$('senpa-team');team.querySelectorAll('[data-owned-pair]').forEach(e=>e.remove());for(let pair=0;pair<2;pair++){const base=m.pairSlot(pair,0),host=m.host(base);if(!host)continue;let mass=0,alive=false;for(let native=0;native<m.sourceSlotCount;native++){const id=host.world.myPlayerIDs[native],player=host.world.playersList.get(id);if(m.alive(m.pairSlot(pair,native)))alive=true;if(Number.isFinite(player?.mass))mass+=player.mass;else for(const c of host.world.myCells[native]?.values()||[])if(!c.removed)mass+=c.radius*c.radius/100;}if(!alive)continue;
        const row=el('div',{'data-owned-pair':String(pair)});row.append(el('span',{},'Pair '+(pair+1)+' '+(m.profiles[pair].name||host.player.nick||'Unnamed')),el('span',{},String(Math.round(mass))));team.append(row);
      }
    };
    const after=rp.afterFrame;let last=0;
    rp.afterFrame=now=>{after(now);if(now-last>250){last=now;rp.refreshMultiboxUI();if(m.multi)$('senpa-status').textContent=m.error?m.error:m.intent?'Connection '+(m.sourceIndex(m.intent?.slot??m.active)+1)+' · '+m.status:(m.isFFA?'FFA · Player '+(m.active+1):'WindBine · Pair '+(m.activePair+1))+' active · '+(m.pairAlive(0)?'P1 alive':'P1 ready')+' / '+(m.pairAlive(1)?'P2 alive':'P2 ready');}};
    rp.refreshMultiboxUI();
  };
})();

/* Native decoded artwork and server emoji lifetimes, drawn by Ryuten's Pixi.
 * Never infer ownership or broadcast a local emoji in place of a server event. */
(() => {
  'use strict';
  const rp=window.RYUTEN_PORT;
  rp.nameColor=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value)?value:'#ffffff';
  rp.nameTint=view=>parseInt(rp.nameColor(view?._2182?._1059?._senpaNameColor).slice(1),16);
  rp.modules.installCosmetics=(h,r)=>{
    const records=new Map();let lastSweep=0;
    // Independent active-slot indicator: it is not an equipped shield or account item.
    const ringCanvas=document.createElement('canvas');ringCanvas.width=ringCanvas.height=128;
    const ringContext=ringCanvas.getContext('2d');ringContext.strokeStyle='#fff';ringContext.lineWidth=3;
    ringContext.beginPath();ringContext.arc(64,64,61,0,Math.PI*2);ringContext.stroke();
    const ringTexture=new r.c.xEZ(new r.c.VL4(ringCanvas)),ringPool=[];let ringIndex=0;
    rp.orbTint=(view,fallback)=>{
      if(!view?._senpaSource)return fallback;
      const owned=!!view._2182?._1059?._9710,mode=r.Q.OWN_ORB_COLORING._5997();
      if(owned&&mode==='custom')return r.Q.CUSTOM_OWN_ORB_COLOR._5997();
      if(owned&&mode==='multibox')return view._2182._3090===r.Be._1393?r.Q.ACTIVE_PLAYER_UNIT_ACCENT_COLOR._5997():r.Q.INACTIVE_PLAYER_UNIT_ACCENT_COLOR._5997();
      return (owned||r.Q.ORB_COLORING._5997()!=='tint')?view._6728._1026:fallback;
    };
    // Senpa's eject texture is a 64px full white disc, tinted at draw time.
    // Keep its native radius, opacity and interpolation; no Drag padding or Ryuten grow-in.
    const pelletCanvas=document.createElement('canvas');pelletCanvas.width=pelletCanvas.height=64;
    const pelletContext=pelletCanvas.getContext('2d');pelletContext.fillStyle='#fff';
    pelletContext.beginPath();pelletContext.arc(32,32,32,0,Math.PI*2);pelletContext.fill();
    const pelletTexture=new r.c.xEZ(new r.c.VL4(pelletCanvas));
    const ejectDraw=r.Bt._7703;
    r.Bt._7703=function(view,container){
      if(view._senpaSource?.type!==2)return ejectDraw.call(this,view,container);
      const sprite=this._2899[this._2072]||(this._2899[this._2072]=new r.c.jyi(pelletTexture));this._2072++;
      sprite.texture=pelletTexture;sprite.anchor.set(.5);sprite.position.set(view._7847,view._9202);
      sprite.width=sprite.height=2*Math.max(0,view._1904);sprite.tint=view._6728._1026;sprite.alpha=1;container.addChild(sprite);
    };
    rp.renderParity={pelletTexture,ringTexture,ringPool,pelletDiameter:radius=>Math.max(0,Number(radius)||0)*2};
    const destroy=record=>{for(const sprite of record.pool)sprite.destroy({texture:false,baseTexture:false});for(const texture of record.textures)texture.destroy(false);record.base.destroy();};
    function recordFor(kind,url,entry,now){
      const key=kind+':'+url;let record=records.get(key);
      if(record&&record.entry!==entry){destroy(record);records.delete(key);record=null;}
      if(!record){
        // Copy across realms: Pixi 6 tests canvas resources with instanceof.
        const source=kind==='emoji'?entry.sheet:entry.canvas,canvas=document.createElement('canvas');
        canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);
        const base=new r.c.VL4(canvas),textures=[];
        if(kind==='emoji')for(let i=0;i<entry.frameCount;i++)textures.push(new r.c.xEZ(base,new r.c.AeJ(entry.frameX(i),entry.frameY(i),entry.frameSize,entry.frameSize)));
        else textures.push(new r.c.xEZ(base));
        record={entry,base,textures,pool:[],index:0,used:now,kind,url};records.set(key,record);
      }
      record.used=now;return record;
    }
    function add(record,container,view,frame,diameter,alpha,offsetY=0){
      const sprite=record.pool[record.index]||(record.pool[record.index]=new r.c.jyi(record.textures[0]));record.index++;
      sprite.texture=record.textures[frame];sprite.anchor.set(.5,.5);sprite.position.set(view._7847,view._9202+offsetY);
      sprite.width=sprite.height=diameter;sprite.alpha=alpha;container.addChild(sprite);return sprite;
    }
    rp.cosmetics={records,begin(now){
      ringIndex=0;
      const sweep=now-lastSweep>=1000;
      if(sweep){lastSweep=now;h.emojiCache.sweep(now);h.hatCache.sweep(now);}
      for(const [key,record]of records){const cache=record.kind==='emoji'?h.emojiCache:h.hatCache;
        if(!sweep){record.index=0;continue;}
        if(now-record.used>60000||cache.peek(record.url)!==record.entry){destroy(record);records.delete(key);}
        else while(record.pool.length>Math.max(1,record.index))record.pool.pop().destroy({texture:false,baseTexture:false});
        record.index=0;
      }
    },reset(){for(const record of records.values())destroy(record);records.clear();}};
    rp.emojiState=view=>{
      const cell=view?._senpaSource,client=cell?.parentPlayer?.parentClient;
      const now=rp.motion.frameNow-(cell?._rpClockOffset||0);
      return {client,now,active:!!client&&!client.isBot&&client.emojiUntil>now};
    };
    rp.emojiScale=view=>{const {client,now,active}=rp.emojiState(view);return active?h.emojiScale(client,now):1;};
    rp.drawCosmetics=(view,container,alpha,skinScale=1)=>{
      const own=view?._2182?._1059?._9710;
      if(own&&!view._9491&&r.Q.MULTIBOX_RING?._5997()&&view._2182._3090===r.Be._1393){
        const ring=ringPool[ringIndex]||(ringPool[ringIndex]=new r.c.jyi(ringTexture));ringIndex++;
        ring.anchor.set(.5);ring.position.set(view._7847,view._9202);ring.width=ring.height=view._1904*2.08;
        ring.tint=r.Q.ACTIVE_PLAYER_UNIT_ACCENT_COLOR._5997();ring.alpha=1;container.addChild(ring);
      }
      const {client,now,active}=rp.emojiState(view);if(!client||client.isBot)return;
      const primaryNow=rp.motion.frameNow,radius=view._1904*skinScale;
      if(active){const entry=h.emojiCache.get(client.emojiUrl,primaryNow);
        if(entry){const record=recordFor('emoji',client.emojiUrl,entry,primaryNow),frame=h.emojiCache.frameIndexAt(entry,now-client.emojiStartedAt);
          add(record,container,view,frame,radius*2*h.emojiScale(client,now),alpha*Math.min(1,(client.emojiUntil-now)/400));}
      }
      const hat=h.hatCatalog.get(view._senpaSource.hat);
      if(hat){const entry=h.hatCache.get(hat.url,primaryNow);if(entry)add(recordFor('hat',hat.url,entry,primaryNow),container,view,0,radius*2*hat.scale/100,alpha,radius*hat.offset_y/100);}
    };
  };
})();

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
      const token={custom:this._running,native:this._hasNativeMacro(),slot:this._targetSlot};
      if(token.native)this._stopNativeMacros();
      if(!this.feedFollowsTab&&token.custom)this.release('switch', {native:false});
      return token;
    }
    afterSwitch(token,slot) {
      if(!token||!this.feedFollowsTab)return false;
      if(token.custom&&this._running){this._targetSlot=slot;return true;}
      if(token.native&&this.usingNativeCadence)return this._handleMacroFeed(true);
      return false;
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
      const nativeMacro = this._originalMacroFeeds.get(host)
        || (host === this.host ? this._originalMacroFeed : null);
      if (this.usingNativeCadence) {
        if(!state)return this.release('native-input');
        const logical=host===this.host?this._activeSlot():this._slotForHost(host);
        const target=this.manager?.multi?this.manager.host(logical):host;
        if(!target||this._blockedReason(target))return false;
        const nativeSlot=this.manager?.multi?(this.manager.nativeSlot?.(logical)??0):(target.player?.activeTab||0);
        if(!this._isReady(target,nativeSlot))return false;
        if(this._nativeMacroHosts.has(target)&&this._targetSlot===logical)return true;
        this._stopNativeMacros();
        this._targetSlot=logical;this._nativeMacroHosts.add(target);
        // The host's native closure captures macroFeedTab. Do not route this
        // through the primary manager again, or key-up can stop another engine.
        this.host.actions.sendMouse?.();
        return this._callNativeMacroFeed(true,target);
      }

      if (!state) return this.release('input', { native: false });

      if (this._hasNativeMacro()) this._stopNativeMacros();
      return this.start({ slot: Number.isInteger(slot) ? slot : undefined });
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
        this._registerBusEvent(host, events.Socket_Cleanup, () => this.release('disconnect'));
        this._registerBusEvent(host, events.Player_Died, () => {const route=this._resolveRoute();if(!route||route.host===host)this.release('death');});
        this._registerBusEvent(host, events.Show_Menu, open => {if(open)this.release('menu');});
      }

      const menu = host.menu;
      if (menu && isFunction(menu.show)) {
        this._wrapMethod(menu, 'show', (original, target, args) => {
          this.release('menu');
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

/* Optional bounded input macro. Uses unchanged native cursor/split messages;
 * never edits cells, velocities, server limits, verification or account state. */
(() => {
  'use strict';
  const rp=window.RYUTEN_PORT;
  rp.modules.installLineSplit=(h,r)=>{
    const m=rp.parentPort.multibox;let operation=null,timer=null,sequence=0;
    const nativeMouse=h.actions.sendMouse.bind(h.actions);
    const route=()=>{const slot=m?.multi?m.active:h.player.activeTab;return {slot,host:m?.multi?m.host(slot):h,native:m?.multi?m.nativeSlot(slot):slot};};
    const allowed=o=>o&&o.host.network.connected&&!o.host.network.isReplay&&o.host.packets.handshakeDone&&
      o.host.network.ws===o.socket&&m?.generation===o.generation&&route().slot===o.slot&&route().host===o.host&&
      !h.menu.isOpen&&!h.menu.isChatFocused&&!document.hidden&&!r.rs._4020;
    const center=(host,slot)=>{if(!host)return null;let x=0,y=0,n=0;for(const c of host.world.myCells[slot]?.values()||[]){if(c.removed)continue;x+=c.x;y+=c.y;n++;}return n?{x:x/n,y:y/n,count:n}:null;};
    const cancel=(reason='cancelled')=>{if(timer!==null)clearTimeout(timer);timer=null;const had=!!operation;operation=null;if(had)api.lastResult={status:'cancelled',reason};return had;};
    const aim=()=>{const o=operation;if(!allowed(o)){cancel('route-or-focus-changed');return false;}o.host.packets.cursor(o.center.x,o.center.y,o.native);return true;};
    h.actions.sendMouse=()=>operation?aim():nativeMouse();
    const api=rp.lineSplit={
      lastResult:null,
      trigger({settleMs=100,splitCount=6,offset=4}={}){
        if(operation)return false;
        const target=route(),c=center(target.host,target.native);
        if(!c||!Number.isInteger(splitCount)||splitCount<1||splitCount>6)return false;
        // Match the rendered viewport in the XPLUS test; other profiles use native projection.
        const camera=rp.motion?.inputCamera()||h.camera;
        const canvas=h.renderer.canvas,scale=canvas.width/Math.max(1,parent.innerWidth),zoom=camera.zoom*scale;
        if(!Number.isFinite(zoom)||zoom<=0)return false;
        const x=camera.x+(h.input.mouse.x*scale-canvas.width/2)/zoom;
        const y=camera.y+(h.input.mouse.y*scale-canvas.height/2)/zoom;
        const dx=x-c.x,dy=y-c.y,length=Math.hypot(dx,dy);if(!Number.isFinite(length)||length<.01)return false;
        const o={...target,center:c,dx:dx/length,dy:dy/length,offset:Math.max(2,Math.min(64,Number(offset)||4)),
          socket:target.host.network.ws,generation:m?.generation,sequence:++sequence};
        if(!allowed(o))return false;
        rp.feedTiming?.release('line-split');m?.releaseFeed();operation=o;aim();
        timer=setTimeout(()=>{
          timer=null;if(operation!==o||!allowed(o)){cancel('route-or-focus-changed');return;}
          const latest=center(o.host,o.native);if(!latest){cancel('no-live-cells');return;}
          o.host.packets.cursor(latest.x+o.dx*o.offset,latest.y+o.dy*o.offset,o.native);
          o.host.packets.split(o.native,splitCount);
          // Pin the directional cursor for one native input interval; then restore ordinary aim.
          o.center={x:latest.x+o.dx*o.offset,y:latest.y+o.dy*o.offset};
          api.lastResult={status:'sent',slot:o.slot,splitCount,initialCellCount:c.count};
          timer=setTimeout(()=>{if(operation!==o)return;const restore=allowed(o);timer=null;operation=null;if(restore)nativeMouse();},45);
        },Math.max(0,Math.min(300,Number(settleMs)||0)));
        return true;
      },cancel,snapshot:()=>({active:!!operation,slot:operation?.slot??null,lastResult:api.lastResult}),
      dispose(){cancel('dispose');h.actions.sendMouse=nativeMouse;}
    };
    window.addEventListener('blur',()=>cancel('blur'));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel('hidden');});
    return api;
  };
})();

/* Bounded diagnostics, disabled detailed tracing by default. No account, chat,
 * skin URLs, cookies, identifiers from the wire, or packet contents are exported. */
(() => {
  'use strict';const rp=window.RYUTEN_PORT;
  rp.modules.installMetrics=(h,r)=>{
    const samples=new Array(600);let index=0,count=0,last=null,trace=null;
    const metrics=rp.metrics={errors:0,longTasks:0,longTaskMs:0,frames:0};
    try{const Observer=parent.PerformanceObserver||PerformanceObserver;
      metrics.observer=new Observer(list=>{for(const e of list.getEntries()){metrics.longTasks++;metrics.longTaskMs+=e.duration;}});
      metrics.observer.observe({type:'longtask',buffered:false});}catch{}
    const summary=key=>{const a=samples.filter(Boolean).map(s=>s[key]).filter(Number.isFinite).sort((a,b)=>a-b);
      const at=q=>a.length?a[Math.min(a.length-1,Math.floor(q*(a.length-1)))]:0;
      return {count:a.length,median:at(.5),p95:at(.95),p99:at(.99),max:a.at(-1)||0};};
    metrics.frame=(s)=>{
      s.frameMs=last===null?0:s.now-last;last=s.now;samples[index]=s;index=(index+1)%samples.length;count=Math.min(count+1,samples.length);metrics.frames++;
      if(trace){if(s.now>trace.until||trace.frames.length>=6000){trace.running=false;return;}
        if(!trace.running)return;
        const m=rp.parentPort.multibox,cellRows=[];
        if(trace.maxCells)for(const entry of rp.world.cells.values()){
          if(!entry.view._2182?._1059?._9710)continue;
          cellRows.push({slot:entry.view._2182._3090,x:entry.source.x,y:entry.source.y,r:entry.source.radius,
            visibleX:entry.view._7847-rp.world.offset,visibleY:entry.view._9202-rp.world.offset,visibleR:entry.view._1904,
            targetX:entry.source.endX,targetY:entry.source.endY,removed:!!entry.source.removed});if(cellRows.length>=trace.maxCells)break;
        }
        trace.frames.push({...s,profile:rp.motion.style,activeSlot:m?.multi?m.active:h.player.activeTab,
          camera:{x:h.camera.x,y:h.camera.y,zoom:h.camera.zoom,targetZoom:h.camera.targetZoom},
          renderCamera:rp.motion.ultraView?{x:rp.motion.ultraView.x,y:rp.motion.ultraView.y,zoom:rp.motion.ultraView.zoom}:null,cells:cellRows});
      }
    };
    metrics.snapshot=()=>({frames:metrics.frames,windowFrames:count,errors:metrics.errors,longTasks:metrics.longTasks,
      longTaskMs:metrics.longTaskMs,units:'milliseconds',frameInterval:summary('frameMs'),world:summary('worldMs'),render:summary('renderMs'),ui:summary('uiMs'),presentationCPU:summary('cpuMs'),nativeBeforePresentation:summary('nativeMs'),
      nativeReportedFPS:h.metrics.fps,nativeReportedLatencyMs:h.network.latency,views:rp.world.cells.size,
      missingLocalAssets:[...rp.missingAssets].slice(0,100),cosmeticTextureRecords:rp.cosmetics.records.size});
    rp.capture={start({seconds=20,maxCells=16}={}){
      const now=parent.performance.now();trace={version:rp.build.version,startedAt:now,until:now+Math.max(1,Math.min(60,Number(seconds)||20))*1000,
        running:true,maxCells:Math.max(0,Math.min(32,Number(maxCells)||0)),frames:[],limitations:'Wall-clock capture, not packet ground truth. No secret or cosmetic data.'};return {running:true,seconds:(trace.until-now)/1000,maxCells:trace.maxCells};
    },stop(){if(trace)trace.running=false;return trace?.frames.length||0;},download(){this.stop();if(!trace)return false;
      rp.download('senpa-motion-trace-'+rp.build.version+'.json',JSON.stringify({trace,metrics:metrics.snapshot(),motion:rp.motion.snapshot()}));return true;},snapshot:()=>trace?{running:trace.running,frames:trace.frames.length}:null};
    return metrics;
  };
})();

/* Ryuten account, profile, skin, hat, and emoji adapter. */
(() => {
  'use strict';

  const port = window.RYUTEN_PORT;
  if (!port) return;

  port.modules = port.modules || {};

  const MAX_PROFILES = 10;
  const DEFAULT_SKIN_BASE = 'https://api.senpa.io/u';
  const TAB_NAMES = ['account', 'skins', 'hats', 'emojis', 'shop'];
  const SKIN_TABS = ['level', 'free', 'mine', 'favorites'];

  const fallbackRoutes = Object.freeze({
    account: '/account/',
    skinsList: '/skins/list',
    saveProfile: '/account/save-profile',
    hats: '/hats/',
    hatsCatalogue: '/hats/',
    hatsEquip: '/hats/equip',
    emojis: '/emojis/',
    emojiSlots: '/emojis/slots'
  });

  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const isObject = value => value !== null && typeof value === 'object';
  const isAccount = value => isObject(value) && !Array.isArray(value) && value !== -1 && !value.error;
  const finiteId = value => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id >= 0 ? id : null;
  };
  const textValue = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).slice(0, 180);
  };
  const httpsURL = value => {
    if (typeof value !== 'string' || !value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  };
  const hexColor = value => {
    if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) return '';
    return value.toLowerCase();
  };

  function endpointValue(value, id, fallback) {
    if (typeof value === 'function') {
      try {
        const result = value(id);
        return typeof result === 'string' && result ? result : fallback;
      } catch {
        return fallback;
      }
    }
    if (typeof value === 'string' && value) {
      return value.includes('{id}') ? value.replaceAll('{id}', String(id)) : value;
    }
    return fallback;
  }

  function normalizeApiRoute(value, fallback, authRoot) {
    if (typeof value !== 'string' || !value) return fallback;
    if (value.startsWith('/')) return value;
    try {
      const url = new URL(value);
      const root = new URL(authRoot || 'https://api.senpa.io');
      if (url.origin !== root.origin) return fallback;
      return `${url.pathname || '/'}${url.search || ''}`;
    } catch {
      return fallback;
    }
  }

  function nativeRoutes(h) {
    const configured = isObject(h?.config) && isObject(h.config.endPoints) ? h.config.endPoints : {};
    const skins = isObject(configured.skins) ? configured.skins : {};
    const hats = isObject(configured.hats) ? configured.hats : {};
    const emojis = isObject(configured.emojis) ? configured.emojis : {};
    const authRoot = httpsURL(h?.config?.authRoot) || 'https://api.senpa.io';
    const route = (value, fallback) => normalizeApiRoute(value, fallback, authRoot);
    return {
      account: route(configured.authProfile, fallbackRoutes.account),
      skinsList: route(skins.list, fallbackRoutes.skinsList),
      skinsSearch: route(skins.search, '/skins/search'),
      saveProfile: route(configured.saveProfile, fallbackRoutes.saveProfile),
      hats: route(hats.list, fallbackRoutes.hats),
      hatsCatalogue: route(hats.catalogue, fallbackRoutes.hatsCatalogue),
      hatsEquip: route(hats.equip, fallbackRoutes.hatsEquip),
      emojis: route(emojis.list, fallbackRoutes.emojis),
      emojiSlots: route(emojis.slots, fallbackRoutes.emojiSlots),
      skinBase: httpsURL(skins.routeBase) || DEFAULT_SKIN_BASE,
      hatBuy: id => route(endpointValue(hats.buy, id, `/hats/${id}/buy`), `/hats/${id}/buy`),
      emojiBuy: id => route(endpointValue(emojis.buy, id, `/emojis/${id}/buy`), `/emojis/${id}/buy`)
    };
  }

  function normalizeEmoji(value) {
    if (!isObject(value)) return null;
    const id = finiteId(value.id);
    if (id === null) return null;
    return {
      id,
      image_url: httpsURL(value.image_url),
      name: textValue(value.emoji_name || value.name || `Emoji ${id}`, `Emoji ${id}`),
      owned: value.owned === true,
      for_sale: value.for_sale === true,
      price: value.price ?? value.cost ?? value.coins ?? null
    };
  }

  function normalizeEmojiSlots(account) {
    const slots = isAccount(account) && Array.isArray(account.emoji_slots) ? account.emoji_slots : [];
    return Array.from({ length: 4 }, (_, index) => normalizeEmoji(slots[index]));
  }

  function normalizeHat(value, catalog, ownedIds = new Set()) {
    if (!isObject(value)) return null;
    const id = finiteId(value.id);
    if (id === null) return null;
    const fallback = isObject(catalog) ? catalog : {};
    return {
      id,
      image_url: httpsURL(value.image_url || fallback.url),
      name: textValue(value.hat_name || value.name || `Hat ${id}`, `Hat ${id}`),
      owned: value.owned === true || ownedIds.has(id),
      for_sale: value.for_sale === true,
      price: value.price ?? value.cost ?? value.coins ?? null,
      scale: Number.isFinite(Number(value.scale)) ? Number(value.scale) : Number(fallback.scale) || 150,
      offset_y: Number.isFinite(Number(value.offset_y)) ? Number(value.offset_y) : Number(fallback.offset_y) || 0
    };
  }

  function normalizeSkin(value, h) {
    if (!isObject(value)) return null;
    const id = finiteId(value.id);
    const route = typeof value.skin_route === 'string' ? value.skin_route.trim() : '';
    if (id === null && !route) return null;
    const base = nativeRoutes(h).skinBase.replace(/\/$/, '');
    const image = httpsURL(route) || (route ? `${base}/${encodeURIComponent(route).replace(/%2F/g, '/')}` : '');
    return {
      id,
      route,
      image_url: image,
      name: textValue(value.skin_name || value.name || (id === null ? route : `Skin ${id}`), 'Skin'),
      requirement_type: textValue(value.requirement_type),
      requirement_data: textValue(value.requirement_data),
      favorite: value.favorite === true || value.favourite === true,
      owned: value.owned === true
    };
  }

  const accountUtils = {
    routes: fallbackRoutes,
    isAccount,
    normalizeEmoji,
    normalizeEmojiSlots,
    normalizeHat,
    normalizeSkin,
    normalizeApiRoute,
    httpsURL,
    hexColor
  };
  port.accountUtils = accountUtils;

  function createAdapter(h, reference) {
    const previous = port.account;
    if (previous && typeof previous.dispose === 'function') previous.dispose();

    const doc = reference?.document || (typeof document !== 'undefined' ? document : null);
    const state = {
      open: false,
      tab: 'account',
      profileIndex: finiteId(h?.store?.profiles?.selected) ?? 0,
      skinSlot: 0,
      skinTab: 'level',
      skinPage: 1,
      skinQuery: '',
      skins: [],
      hats: [],
      emojis: [],
      selectedEmojiSlot: 0,
      busy: '',
      loading: '',
      error: '',
      message: '',
      account: isAccount(h?.store?.account) ? h.store.account : null
    };
    state.profileIndex = Math.max(0, Math.min(MAX_PROFILES - 1, state.profileIndex));

    const listeners = [];
    let accountRequest = null;
    let panel = null;
    let style = null;
    let renderQueued = false;
    const pp = port.parentPort || null;
    const originalSkinPicker = pp?.openSkinPicker;
    let authGeneration = 0;
    let accountGeneration = 0;
    let accountRequestGeneration = -1;
    let awaitingAccountRefresh = false;
    let focusReturn = null;

    function makeElement(tag, attrs = {}, text) {
      let item = typeof reference?.el === 'function' ? reference.el(tag, attrs, text) : null;
      if (!item && doc?.createElement) item = doc.createElement(tag);
      if (!item) return null;
      if (typeof reference?.el !== 'function') {
        for (const [key, value] of Object.entries(attrs || {})) {
          if (value === undefined || value === null) continue;
          if (key === 'className') item.className = value;
          else if (key === 'textContent') item.textContent = value;
          else if (key in item && key !== 'style') item[key] = value;
          else item.setAttribute?.(key, String(value));
        }
        if (text !== undefined && text !== null) item.textContent = text;
      }
      return item;
    }

    function clear(item) {
      if (!item) return;
      if (typeof item.replaceChildren === 'function') item.replaceChildren();
      else while (item.firstChild) item.removeChild(item.firstChild);
    }

    function append(item, ...children) {
      if (!item) return item;
      for (const child of children) if (child) item.append?.(child);
      return item;
    }

    function addListener(target, type, listener, options) {
      if (!target?.addEventListener) return;
      target.addEventListener(type, listener, options);
      listeners.push(() => target.removeEventListener?.(type, listener, options));
    }

    function scheduleRender() {
      if (renderQueued) return;
      renderQueued = true;
      const flush = () => {
        renderQueued = false;
        render();
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(flush);
      else Promise.resolve().then(flush);
    }

    function currentAccount() {
      if (awaitingAccountRefresh) return isAccount(state.account) && accountGeneration === authGeneration ? state.account : null;
      if (isAccount(h?.store?.account)) {
        state.account = h.store.account;
        accountGeneration = authGeneration;
        return h.store.account;
      }
      return isAccount(state.account) && accountGeneration === authGeneration ? state.account : null;
    }

    function hasToken() {
      const token = h?.auth?.authToken;
      if (typeof token === 'string' && token.length > 0) return true;
      try {
        const nativeToken = h?.account?.getToken?.();
        return typeof nativeToken === 'string' && nativeToken.length > 0;
      } catch {
        return false;
      }
    }

    function signedIn() {
      return hasToken() && Boolean(currentAccount());
    }

    function errorText(error) {
      const message = textValue(error?.message || error, 'Account request failed');
      return message.replace(/bearer|authorization|token/gi, '[redacted]').slice(0, 180);
    }

    function setError(error) {
      state.error = errorText(error);
      state.message = '';
      scheduleRender();
    }

    function request(route, options) {
      if (typeof h?.account?.request !== 'function') throw new Error('native_account_client_unavailable');
      return h.account.request(route, options || {});
    }

    function requestJson(route, body) {
      if (typeof h?.account?.requestJson !== 'function') throw new Error('native_account_client_unavailable');
      return h.account.requestJson(route, body);
    }

    function assertMutationSuccess(result, requireSuccess = false) {
      if (!isObject(result) || result.error || result.success === false || (hasOwn(result, 'success') && result.success !== true) || (requireSuccess && result.success !== true)) {
        throw new Error(textValue(result?.error, 'native_account_mutation_failed'));
      }
      return result;
    }

    function emojiSlots(account = currentAccount()) {
      return normalizeEmojiSlots(account);
    }

    function skinRoute(account, profileIndex, slot) {
      const profile = account?.skin_profiles?.[profileIndex];
      if (!isObject(profile)) return '';
      const id = profile[`skin_id_${slot + 1}`];
      const route = account?.skin_routes?.[id];
      return typeof route === 'string' ? route : '';
    }

    function hatIds(account, profileIndex) {
      const profile = account?.hat_profiles?.[profileIndex];
      return [finiteId(profile?.hat_id_1), finiteId(profile?.hat_id_2)];
    }

    function idsFrom(value) {
      if (!Array.isArray(value)) return [];
      return value.map(item => isObject(item) ? finiteId(item.id) : finiteId(item)).filter(id => id !== null);
    }

    function allEquippedHatIds(account) {
      if (!Array.isArray(account?.hat_profiles)) return [];
      return account.hat_profiles.flatMap((_, index) => hatIds(account, index)).filter(id => id !== null);
    }

    function syncLocalProfileCosmetics(account = currentAccount()) {
      if (!account) return;
      const nickname = h?.store?.profile?.nick;
      const hats = hatIds(account, state.profileIndex);
      if (isObject(h?.player)) {
        h.player.hat1 = hats[0] ?? 0;
        h.player.hat2 = hats[1] ?? 0;
      }
      if (isObject(h?.store?.profile)) {
        h.store.profile.hat1 = hats[0] ?? 0;
        h.store.profile.hat2 = hats[1] ?? 0;
        if (nickname !== undefined) h.store.profile.nick = nickname;
      }
      if (typeof port.syncAccountSkins === 'function') port.syncAccountSkins();
    }

    function syncAccountState(account) {
      state.account = account;
      accountGeneration = authGeneration;
      awaitingAccountRefresh = false;
      if (isObject(h?.store)) h.store.account = account;
      const urls = normalizeEmojiSlots(account).map(item => item?.image_url || null);
      if (typeof h?.auth?.setEmojiSlots === 'function') h.auth.setEmojiSlots(urls);
      syncLocalProfileCosmetics(account);
    }

    async function refreshAccount() {
      if (accountRequest && accountRequestGeneration === authGeneration) return accountRequest;
      if (!hasToken()) {
        awaitingAccountRefresh = false;
        state.account = isAccount(h?.store?.account) ? h.store.account : null;
        accountGeneration = authGeneration;
        scheduleRender();
        return state.account;
      }
      const generation = authGeneration;
      awaitingAccountRefresh = true;
      accountRequestGeneration = generation;
      accountRequest = Promise.resolve().then(() => request(nativeRoutes(h).account)).then(result => {
        if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
        if (!isAccount(result)) throw new Error(textValue(result?.error, 'account_load_failed'));
        syncAccountState(result);
        state.error = '';
        scheduleRender();
        return result;
      }).catch(error => {
        if (generation === authGeneration) {
          awaitingAccountRefresh = false;
          state.account = isAccount(h?.store?.account) ? h.store.account : state.account;
        }
        setError(error);
        throw error;
      }).finally(() => {
        if (accountRequestGeneration === generation) {
          accountRequest = null;
          accountRequestGeneration = -1;
        }
      });
      return accountRequest;
    }

    function requireAccount() {
      if (!hasToken()) throw new Error('not_signed_in');
      const account = currentAccount();
      if (!account) throw new Error('account_not_loaded');
      return account;
    }

    async function openAuth(provider = 'discord') {
      const selected = String(provider).toLowerCase() === 'facebook' ? 'facebook' : 'discord';
      const loginBridge = h?.accountLogin;
      if (typeof loginBridge === 'function') {
        try {
          const result = await loginBridge(selected);
          if (result !== false) {
            state.message = `Opening Senpa ${selected} authentication…`;
            state.error = '';
            scheduleRender();
            return true;
          }
        } catch (error) {
          setError(error);
          return false;
        }
      }
      let nativeDocument = null;
      try {
        nativeDocument = window.parent && window.parent.document ? window.parent.document : null;
      } catch {
        nativeDocument = null;
      }
      const buttonId = selected === 'facebook' ? 'btnLoginFB' : 'btnLoginDisc';
      const button = nativeDocument?.getElementById?.(buttonId);
      if (button && typeof button.click === 'function') {
        button.click();
        state.message = `Opening Senpa ${selected} authentication…`;
        state.error = '';
        scheduleRender();
        return true;
      }
      setError(new Error('native_auth_provider_unavailable'));
      return false;
    }

    async function logout() {
      if (typeof h?.account?.logout !== 'function') throw new Error('native_account_client_unavailable');
      authGeneration += 1;
      awaitingAccountRefresh = true;
      await h.account.logout();
      state.account = null;
      accountGeneration = authGeneration;
      awaitingAccountRefresh = false;
      if (isObject(h?.store)) h.store.account = -1;
      if (typeof h?.auth?.setEmojiSlots === 'function') h.auth.setEmojiSlots(null);
      state.message = 'Signed out of Senpa.';
      state.error = '';
      scheduleRender();
      return true;
    }

    function setProfile(index) {
      const selected = Number(index);
      if (!Number.isInteger(selected) || selected < 0 || selected >= MAX_PROFILES) return false;
      state.profileIndex = selected;
      if (isObject(h?.store?.profiles)) h.store.profiles.selected = selected;
      syncLocalProfileCosmetics();
      state.message = `Profile ${selected + 1} selected.`;
      scheduleRender();
      return true;
    }

    function accountLevel(account) {
      const experience = Number(account?.experience);
      if (Number.isFinite(experience) && typeof h?.accountLevel?.levelFromExp === 'function') {
        try {
          const level = Number(h.accountLevel.levelFromExp(experience));
          if (Number.isFinite(level)) return level;
        } catch {
          /* Fall back to the account payload when the native helper is unavailable. */
        }
      }
      return account?.level ?? account?.account_level ?? null;
    }

    function skinIsBlocked(item, account) {
      if (!item) return true;
      if (textValue(item.name).trim().toLowerCase() === 'pending') return true;
      if (Number(item.requirement_type) !== 1) return false;
      const required = Number(item.requirement_data);
      const level = Number(accountLevel(account));
      return !Number.isFinite(required) || !Number.isFinite(level) || level < required;
    }

    function commitSkin(account, profileIndex, slot, item) {
      const profiles = Array.isArray(account.skin_profiles) ? account.skin_profiles : (account.skin_profiles = []);
      const profile = isObject(profiles[profileIndex]) ? profiles[profileIndex] : (profiles[profileIndex] = {});
      const oldId = profile[`skin_id_${slot + 1}`];
      const route = item?.route || '';
      if (item && item.id !== null) {
        profile[`skin_id_${slot + 1}`] = item.id;
        if (!isObject(account.skin_routes)) account.skin_routes = {};
        account.skin_routes[item.id] = route;
      } else {
        profile[`skin_id_${slot + 1}`] = null;
        if (isObject(account.skin_routes) && oldId !== undefined) delete account.skin_routes[oldId];
      }
      syncAccountState(account);
    }

    function skinSnapshot(account, profileIndex) {
      return {
        profiles: Array.isArray(account.skin_profiles),
        profile: Array.isArray(account.skin_profiles) && isObject(account.skin_profiles[profileIndex])
          ? { ...account.skin_profiles[profileIndex] }
          : undefined,
        routes: isObject(account.skin_routes) ? { ...account.skin_routes } : undefined
      };
    }

    function restoreSkinSnapshot(account, profileIndex, snapshot) {
      if (snapshot.profiles) {
        if (!Array.isArray(account.skin_profiles)) account.skin_profiles = [];
        account.skin_profiles[profileIndex] = snapshot.profile ? { ...snapshot.profile } : undefined;
      } else {
        delete account.skin_profiles;
      }
      if (snapshot.routes) account.skin_routes = { ...snapshot.routes };
      else delete account.skin_routes;
    }

    async function equipSkin(slot, item, profileIndex = state.profileIndex) {
      const account = requireAccount();
      const selectedSkin = item ? (item.route !== undefined ? item : normalizeSkin(item, h)) : null;
      const selectedSlot = Number(slot);
      const selectedProfile = Number(profileIndex);
      if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 1) throw new Error('bad_skin_slot');
      if (!Number.isInteger(selectedProfile) || selectedProfile < 0 || selectedProfile >= MAX_PROFILES) throw new Error('bad_profile');
      if (selectedSkin && (!selectedSkin.route || skinIsBlocked(selectedSkin, account))) throw new Error('skin_unavailable');
      const next = {
        route1: selectedSlot === 0 ? (selectedSkin?.route || '') : skinRoute(account, selectedProfile, 0),
        route2: selectedSlot === 1 ? (selectedSkin?.route || '') : skinRoute(account, selectedProfile, 1)
      };
      const snapshot = skinSnapshot(account, selectedProfile);
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).saveProfile, {
        profile_id: selectedProfile,
        profile: next
      }));
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      try {
        commitSkin(account, selectedProfile, selectedSlot, selectedSkin?.route ? selectedSkin : null);
      } catch (error) {
        restoreSkinSnapshot(account, selectedProfile, snapshot);
        try { syncAccountState(account); } catch { /* preserve the original commit error */ }
        throw error;
      }
      state.message = selectedSkin?.route ? 'Skin equipped.' : 'Skin slot cleared.';
      state.error = '';
      scheduleRender();
      return result;
    }

    async function loadSkins(tab = state.skinTab, page = state.skinPage, query = state.skinQuery) {
      requireAccount();
      const selectedTab = SKIN_TABS.includes(tab) ? tab : 'level';
      const selectedPage = Math.max(1, Number(page) || 1);
      const apiPage = selectedTab === 'free' ? selectedPage - 1 : selectedPage;
      state.loading = 'skins';
      scheduleRender();
      try {
        const searchQuery = textValue(query).trim();
        const result = await request(searchQuery ? nativeRoutes(h).skinsSearch : nativeRoutes(h).skinsList, {
          query: { type: selectedTab, page: apiPage, query: searchQuery }
        });
        if (result?.error) throw new Error(textValue(result.error, 'skins_load_failed'));
        const values = Array.isArray(result?.results) ? result.results : Array.isArray(result?.results?.skins) ? result.results.skins : Array.isArray(result) ? result : null;
        if (!values) throw new Error('skins_response_invalid');
        state.skinTab = selectedTab;
        state.skinPage = selectedPage;
        state.skinQuery = searchQuery;
        state.skins = values.map(value => normalizeSkin(value, h)).filter(Boolean);
        state.error = '';
        return state.skins;
      } finally {
        state.loading = '';
        scheduleRender();
      }
    }

    function commitHat(account, profileIndex, slot, item) {
      const profiles = Array.isArray(account.hat_profiles) ? account.hat_profiles : (account.hat_profiles = []);
      const profile = isObject(profiles[profileIndex]) ? profiles[profileIndex] : (profiles[profileIndex] = {});
      profile.hat_id_1 = profile.hat_id_1 ?? null;
      profile.hat_id_2 = profile.hat_id_2 ?? null;
      profile[`hat_id_${slot + 1}`] = item ? item.id : null;
      if (item?.image_url) {
        if (!isObject(account.hat_images)) account.hat_images = {};
        account.hat_images[item.id] = {
          image_url: item.image_url,
          scale: item.scale,
          offset_y: item.offset_y
        };
      }
      syncAccountState(account);
    }

    function hatSnapshot(account, profileIndex) {
      return {
        profiles: Array.isArray(account.hat_profiles),
        profile: Array.isArray(account.hat_profiles) && isObject(account.hat_profiles[profileIndex])
          ? { ...account.hat_profiles[profileIndex] }
          : undefined,
        images: isObject(account.hat_images) ? { ...account.hat_images } : undefined
      };
    }

    function restoreHatSnapshot(account, profileIndex, snapshot) {
      if (snapshot.profiles) {
        if (!Array.isArray(account.hat_profiles)) account.hat_profiles = [];
        account.hat_profiles[profileIndex] = snapshot.profile ? { ...snapshot.profile } : undefined;
      } else {
        delete account.hat_profiles;
      }
      if (snapshot.images) account.hat_images = { ...snapshot.images };
      else delete account.hat_images;
    }

    async function loadHats() {
      requireAccount();
      state.loading = 'hats';
      scheduleRender();
      try {
        const result = await request(nativeRoutes(h).hats);
        if (result?.error) throw new Error(textValue(result.error, 'hats_load_failed'));
        const source = isObject(result?.results) ? result.results : result;
        const values = Array.isArray(result?.results) ? result.results : Array.isArray(source?.hats) ? source.hats : Array.isArray(source) ? source : null;
        if (!values) throw new Error('hats_response_invalid');
        const ownedIds = new Set([
          ...idsFrom(source?.owned),
          ...idsFrom(result?.owned),
          ...allEquippedHatIds(currentAccount())
        ]);
        state.hats = values.map(value => normalizeHat(value, h?.hatCatalog?.get?.(finiteId(value?.id)), ownedIds)).filter(Boolean);
        state.error = '';
        return state.hats;
      } finally {
        state.loading = '';
        scheduleRender();
      }
    }

    async function equipHat(slot, item, profileIndex = state.profileIndex) {
      const account = requireAccount();
      const selectedSlot = Number(slot);
      const selectedProfile = Number(profileIndex);
      if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 1) throw new Error('bad_hat_slot');
      if (!Number.isInteger(selectedProfile) || selectedProfile < 0 || selectedProfile >= MAX_PROFILES) throw new Error('bad_profile');
      const snapshot = hatSnapshot(account, selectedProfile);
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).hatsEquip, {
        profile_id: selectedProfile,
        tab: selectedSlot + 1,
        hat_id: item ? item.id : null
      }), true);
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      try {
        commitHat(account, selectedProfile, selectedSlot, item || null);
      } catch (error) {
        restoreHatSnapshot(account, selectedProfile, snapshot);
        try { syncAccountState(account); } catch { /* preserve the original commit error */ }
        throw error;
      }
      state.message = item ? 'Hat equipped.' : 'Hat slot cleared.';
      state.error = '';
      scheduleRender();
      return result;
    }

    async function loadEmojis() {
      requireAccount();
      state.loading = 'emojis';
      scheduleRender();
      try {
        const result = await request(nativeRoutes(h).emojis);
        if (result?.error) throw new Error(textValue(result.error, 'emojis_load_failed'));
        const source = isObject(result?.results) ? result.results : result;
        const values = Array.isArray(result?.results) ? result.results : Array.isArray(source?.emojis) ? source.emojis : Array.isArray(source) ? source : null;
        if (!values) throw new Error('emojis_response_invalid');
        const ownedIds = new Set([...idsFrom(source?.owned), ...idsFrom(result?.owned)]);
        state.emojis = values.map(value => {
          const item = normalizeEmoji(value);
          if (item && ownedIds.has(item.id)) item.owned = true;
          return item;
        }).filter(Boolean);
        state.error = '';
        return state.emojis;
      } finally {
        state.loading = '';
        scheduleRender();
      }
    }

    function commitEmojiSlots(account, slots) {
      account.emoji_slots = slots.map(item => item ? {
        id: item.id,
        image_url: item.image_url
      } : null);
      syncAccountState(account);
    }

    async function equipEmoji(slot, item) {
      const account = requireAccount();
      const selectedSlot = Number(slot);
      if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 3) throw new Error('bad_emoji_slot');
      const previous = emojiSlots(account);
      const next = previous.slice();
      next[selectedSlot] = item ? normalizeEmoji(item) : null;
      if (item && !next[selectedSlot]) throw new Error('bad_emoji');
      if (next[selectedSlot]) {
        for (let index = 0; index < next.length; index += 1) {
          if (index !== selectedSlot && next[index]?.id === next[selectedSlot].id) next[index] = null;
        }
      }
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).emojiSlots, {
        slots: next.map(value => value?.id ?? null)
      }), true);
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      try {
        commitEmojiSlots(account, next);
      } catch (error) {
        commitEmojiSlots(account, previous);
        throw error;
      }
      state.message = item ? `Emoji equipped to slot ${selectedSlot + 1}.` : `Emoji slot ${selectedSlot + 1} cleared.`;
      state.error = '';
      scheduleRender();
      return result;
    }

    function sendEmoji(slot) {
      const selectedSlot = Number(slot);
      if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 3) return false;
      if (typeof h?.actions?.sendEmoji !== 'function') {
        setError(new Error('native_send_emoji_unavailable'));
        return false;
      }
      const accepted = Boolean(h.actions.sendEmoji(selectedSlot));
      state.message = accepted ? `Emoji requested from slot ${selectedSlot + 1}; Senpa applies its cooldown.` : 'Emoji is unavailable right now.';
      state.error = '';
      scheduleRender();
      return accepted;
    }

    async function buyHat(id) {
      requireAccount();
      const selectedId = finiteId(id);
      if (selectedId === null) throw new Error('bad_hat');
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).hatBuy(selectedId), {}), true);
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      state.message = 'Hat purchased.';
      await Promise.all([refreshAccount(), loadHats()]);
      return result;
    }

    async function buyEmoji(id) {
      requireAccount();
      const selectedId = finiteId(id);
      if (selectedId === null) throw new Error('bad_emoji');
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).emojiBuy(selectedId), {}), true);
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      state.message = 'Emoji purchased.';
      await Promise.all([refreshAccount(), loadEmojis()]);
      return result;
    }

    function openAdvancedNativeSupport() {
      const showNative = typeof pp?.showNative === 'function' ? pp.showNative.bind(pp) : null;
      if (!showNative) {
        setError(new Error('native_support_unavailable'));
        return false;
      }
      showNative('Advanced native support: replays and native-only graphics');
      return true;
    }

    function profileSelect() {
      const wrapper = makeElement('label', { className: 'ryuten-account-field', 'data-account-control': 'profile' });
      append(wrapper, makeElement('span', {}, 'Profile'));
      const select = makeElement('select', { 'aria-label': 'Profile', 'data-account-profile': 'true' });
      for (let index = 0; index < MAX_PROFILES; index += 1) {
        const option = makeElement('option', { value: String(index) }, `Profile ${index + 1}`);
        if (option && index === state.profileIndex) option.selected = true;
        select?.append?.(option);
      }
      if (select) {
        select.value = String(state.profileIndex);
        select.addEventListener?.('change', event => setProfile(event.target.value));
      }
      append(wrapper, select);
      return wrapper;
    }

    function actionButton(label, callback, options = {}) {
      const button = makeElement('button', { className: options.className || 'ryuten-account-button', type: 'button' }, label);
      if (!button) return button;
      for (const [key, value] of Object.entries(options.attrs || {})) button.setAttribute?.(key, String(value));
      if (options.disabled) button.disabled = true;
      button.addEventListener?.('click', event => {
        event.preventDefault();
        if (button.disabled) return;
        Promise.resolve().then(callback).catch(setError);
      });
      return button;
    }

    function imageNode(url, alt, className = 'ryuten-account-image') {
      const safeURL = httpsURL(url);
      if (!safeURL) return null;
      const image = makeElement('img', { className, alt: textValue(alt, 'Senpa artwork'), loading: 'lazy' });
      if (!image) return null;
      image.src = safeURL;
      image.referrerPolicy = 'no-referrer';
      image.addEventListener?.('error', () => image.remove?.());
      return image;
    }

    function displayName(account) {
      return textValue(account?.display_name || account?.username || account?.real_name || account?.name, 'Senpa account');
    }

    function updateLegacyAccountCard(account) {
      const card = doc?.getElementById?.('senpa-account');
      if (!card) return;
      const name = card.querySelector?.('#senpa-account-name');
      const info = card.querySelector?.('#senpa-account-info');
      if (name) name.textContent = signedIn() ? displayName(account) : 'Sign in to Senpa';
      if (info) info.textContent = signedIn() ? `Level ${textValue(accountLevel(account), '—')} · Account, skins, hats and emojis` : 'Account, skins, hats and emojis';
    }

    function statusNodes() {
      const wrapper = makeElement('div', { className: 'ryuten-account-status', 'aria-live': 'polite' });
      if (state.busy || state.loading) append(wrapper, makeElement('span', { className: 'ryuten-account-busy' }, state.busy || `Loading ${state.loading}…`));
      if (state.error) append(wrapper, makeElement('span', { className: 'ryuten-account-error', role: 'alert' }, state.error));
      if (state.message) append(wrapper, makeElement('span', { className: 'ryuten-account-message' }, state.message));
      return wrapper;
    }

    function accountSummary(account) {
      const wrapper = makeElement('div', { className: 'ryuten-account-summary' });
      const avatar = imageNode(account?.avatar_url || account?.avatar, 'Account avatar', 'ryuten-account-avatar');
      append(wrapper, avatar);
      const details = makeElement('div', { className: 'ryuten-account-summary-details' });
      append(details,
        makeElement('strong', {}, displayName(account)),
        makeElement('span', {}, `Level ${textValue(accountLevel(account), '—')}`),
        makeElement('span', {}, `Coins ${textValue(account?.coins ?? account?.currency?.coins, '—')}`)
      );
      append(wrapper, details);
      return wrapper;
    }

    function loginButtons() {
      const wrapper = makeElement('div', { className: 'ryuten-account-actions' });
      append(wrapper,
        actionButton('Continue with Discord', () => openAuth('discord'), { attrs: { 'data-account-action': 'auth', 'data-provider': 'discord' } }),
        actionButton('Continue with Facebook', () => openAuth('facebook'), { attrs: { 'data-account-action': 'auth', 'data-provider': 'facebook' } })
      );
      append(wrapper, makeElement('p', { className: 'ryuten-account-note' }, 'Senpa authentication opens its existing provider popup; Ryuten stays in control of this menu.'));
      return wrapper;
    }

    function currentEmojiView(account) {
      const wrapper = makeElement('section', { className: 'ryuten-account-section' });
      append(wrapper, makeElement('h3', {}, 'Current game emojis'));
      const grid = makeElement('div', { className: 'ryuten-account-grid' });
      for (let index = 0; index < 4; index += 1) {
        const item = emojiSlots(account)[index];
        const card = makeElement('div', { className: `ryuten-account-card${state.selectedEmojiSlot === index ? ' is-selected' : ''}`, 'data-account-kind': 'emoji-slot', 'data-slot': String(index) });
        append(card, makeElement('strong', {}, `Slot ${index + 1}`), imageNode(item?.image_url, item?.name || `Emoji ${index + 1}`));
        append(card, makeElement('span', {}, item?.name || 'Empty'));
        append(card,
          actionButton(state.selectedEmojiSlot === index ? 'Selected' : 'Select', () => {
            state.selectedEmojiSlot = index;
            scheduleRender();
          }, { disabled: state.selectedEmojiSlot === index, attrs: { 'data-account-action': 'select-emoji-slot', 'data-slot': String(index) } }),
          actionButton('Send', () => sendEmoji(index), { disabled: !item || !signedIn(), attrs: { 'data-account-action': 'send-emoji', 'data-slot': String(index) } })
        );
        append(grid, card);
      }
      append(wrapper, grid);
      return wrapper;
    }

    function renderAccountTab(body, account) {
      if (!signedIn()) {
        append(body,
          makeElement('p', {}, 'Sign in to manage your Ryuten account, profiles, skins, hats, and emojis.'),
          loginButtons()
        );
        return;
      }
      append(body, accountSummary(account), profileSelect());
      append(body, actionButton('Refresh account', () => refreshAccount()));
      append(body, actionButton('Sign out', () => logout(), { className: 'ryuten-account-button danger' }));
      append(body, currentEmojiView(account));
      const quick = makeElement('div', { className: 'ryuten-account-actions' });
      append(quick,
        actionButton('Manage skins', () => activateTab('skins')),
        actionButton('Manage hats', () => activateTab('hats')),
        actionButton('Manage emojis', () => activateTab('emojis'))
      );
      append(body, quick);
      const advanced = makeElement('section', { className: 'ryuten-account-section advanced-support' });
      append(advanced,
        makeElement('h3', {}, 'Advanced native support'),
        makeElement('p', {}, 'Replays and native-only graphics/preferences remain available here explicitly.'),
        actionButton('Open native support', openAdvancedNativeSupport, { attrs: { 'data-account-action': 'advanced' } })
      );
      append(body, advanced);
    }

    function renderSkinTab(body, account) {
      if (!signedIn()) {
        append(body, makeElement('p', {}, 'Sign in to manage skins.'), loginButtons());
        return;
      }
      append(body, profileSelect());
      const slots = makeElement('div', { className: 'ryuten-account-actions' });
      for (let slot = 0; slot < 2; slot += 1) {
        const equipped = skinRoute(account, state.profileIndex, slot);
        append(slots, actionButton(`Skin slot ${slot + 1}${state.skinSlot === slot ? ' (selected)' : ''}`, () => {
          state.skinSlot = slot;
          scheduleRender();
        }, { disabled: state.skinSlot === slot }), makeElement('span', { className: 'ryuten-account-current' }, equipped || 'Empty'));
      }
      append(body, slots, actionButton('Remove current skin', () => equipSkin(state.skinSlot, null), {
        disabled: !skinRoute(account, state.profileIndex, state.skinSlot),
        attrs: { 'data-account-action': 'clear-current-skin', 'data-slot': String(state.skinSlot) }
      }));
      const filters = makeElement('div', { className: 'ryuten-account-actions' });
      for (const tab of SKIN_TABS) append(filters, actionButton(tab, () => {
        state.skinTab = tab;
        state.skinPage = 1;
        void loadSkins(tab, 1, state.skinQuery).catch(setError);
      }, { disabled: state.skinTab === tab, attrs: { 'data-skin-tab': tab } }));
      append(body, filters);
      const search = makeElement('input', { type: 'search', placeholder: 'Search skins', value: state.skinQuery, 'aria-label': 'Search skins' });
      const searchButton = actionButton('Search', () => {
        state.skinPage = 1;
        void loadSkins(state.skinTab, 1, search.value).catch(setError);
      });
      append(body, makeElement('div', { className: 'ryuten-account-search' }), search, searchButton);
      const grid = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.skins) {
        const equipped = item.route && item.route === skinRoute(account, state.profileIndex, state.skinSlot);
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'skin', 'data-item-id': item.id === null ? '' : String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name));
        if (item.requirement_data) append(card, makeElement('small', {}, item.requirement_data));
        append(card, actionButton(equipped ? 'Clear slot' : (skinIsBlocked(item, account) ? 'Locked' : 'Equip'), () => equipSkin(state.skinSlot, equipped ? null : item), { disabled: !item.route || (!equipped && skinIsBlocked(item, account)), attrs: { 'data-account-action': 'equip-skin', 'data-slot': String(state.skinSlot) } }));
        append(grid, card);
      }
      append(body, grid);
      const pages = makeElement('div', { className: 'ryuten-account-actions' });
      append(pages,
        actionButton('Previous page', () => {
          if (state.skinPage > 1) void loadSkins(state.skinTab, state.skinPage - 1, state.skinQuery).catch(setError);
        }, { disabled: state.skinPage <= 1 }),
        makeElement('span', {}, `Page ${state.skinPage}`),
        actionButton('Next page', () => void loadSkins(state.skinTab, state.skinPage + 1, state.skinQuery).catch(setError))
      );
      append(body, pages);
    }

    function renderHatTab(body, account) {
      if (!signedIn()) {
        append(body, makeElement('p', {}, 'Sign in to manage hats.'), loginButtons());
        return;
      }
      append(body, profileSelect());
      const equipped = hatIds(account, state.profileIndex);
      const slots = makeElement('div', { className: 'ryuten-account-actions' });
      for (let slot = 0; slot < 2; slot += 1) {
        append(slots, actionButton(`Hat slot ${slot + 1}${state.skinSlot === slot ? ' (selected)' : ''}`, () => {
          state.skinSlot = slot;
          scheduleRender();
        }, { disabled: state.skinSlot === slot }), makeElement('span', { className: 'ryuten-account-current' }, equipped[slot] === null ? 'Empty' : `Hat ${equipped[slot]}`));
      }
      append(body, slots, actionButton('Open hat shop', () => activateTab('shop')));
      const grid = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.hats.filter(value => value.owned)) {
        const isEquipped = equipped[state.skinSlot] === item.id;
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'hat', 'data-item-id': String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name));
        append(card, actionButton(isEquipped ? 'Clear slot' : 'Equip', () => equipHat(state.skinSlot, isEquipped ? null : item), { attrs: { 'data-account-action': 'equip-hat', 'data-slot': String(state.skinSlot) } }));
        append(grid, card);
      }
      if (!grid.childNodes?.length && !state.loading) append(grid, makeElement('p', {}, 'No owned hats found.')); 
      append(body, grid);
    }

    function renderEmojiTab(body, account) {
      if (!signedIn()) {
        append(body, makeElement('p', {}, 'Sign in to manage emojis.'), loginButtons());
        return;
      }
      append(body, currentEmojiView(account));
      append(body, makeElement('p', { className: 'ryuten-account-note' }, `Selected slot: ${state.selectedEmojiSlot + 1}. Choose an owned emoji below to equip it.`));
      const grid = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.emojis.filter(value => value.owned)) {
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'emoji', 'data-item-id': String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name));
        append(card, actionButton('Equip to selected slot', () => equipEmoji(state.selectedEmojiSlot, item), { attrs: { 'data-account-action': 'equip-emoji', 'data-slot': String(state.selectedEmojiSlot) } }));
        append(grid, card);
      }
      if (!grid.childNodes?.length && !state.loading) append(grid, makeElement('p', {}, 'No owned emojis found.'));
      append(body, grid, actionButton('Open emoji shop', () => activateTab('shop')));
    }

    function confirmPurchase(kind, item) {
      const amount = item.price === null || item.price === undefined ? '' : ` for ${textValue(item.price)} coins`;
      const prompt = `Buy ${textValue(item.name, kind)}${amount}?`;
      return typeof window.confirm !== 'function' || window.confirm(prompt);
    }

    function renderShopTab(body) {
      if (!signedIn()) {
        append(body, makeElement('p', {}, 'Sign in to view the Senpa shop.'), loginButtons());
        return;
      }
      append(body, makeElement('p', { className: 'ryuten-account-note' }, 'Purchases require an explicit confirmation and are sent through the native Senpa account client.'));
      append(body, makeElement('h3', {}, 'Hats'));
      const hats = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.hats.filter(value => value.for_sale && !value.owned)) {
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'shop-hat', 'data-item-id': String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name), makeElement('span', {}, item.price === null ? 'Price unavailable' : `${textValue(item.price)} coins`));
        append(card, actionButton('Buy hat', () => {
          if (confirmPurchase('hat', item)) return buyHat(item.id);
          return undefined;
        }, { disabled: item.price === null || item.price === undefined, attrs: { 'data-account-action': 'buy-hat', 'data-item-id': String(item.id) } }));
        append(hats, card);
      }
      append(body, hats);
      append(body, makeElement('h3', {}, 'Emojis'));
      const emojis = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.emojis.filter(value => value.for_sale && !value.owned)) {
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'shop-emoji', 'data-item-id': String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name), makeElement('span', {}, item.price === null ? 'Price unavailable' : `${textValue(item.price)} coins`));
        append(card, actionButton('Buy emoji', () => {
          if (confirmPurchase('emoji', item)) return buyEmoji(item.id);
          return undefined;
        }, { disabled: item.price === null || item.price === undefined, attrs: { 'data-account-action': 'buy-emoji', 'data-item-id': String(item.id) } }));
        append(emojis, card);
      }
      append(body, emojis);
    }

    function render() {
      const account = currentAccount();
      updateLegacyAccountCard(account);
      if (!panel) return;
      const root = makeElement('div', { className: 'ryuten-account-panel-inner' });
      const header = makeElement('header', { className: 'ryuten-account-header' });
      const heading = makeElement('div');
      append(heading, makeElement('h2', {}, 'Ryuten account'), makeElement('span', {}, account ? displayName(account) : 'Not signed in'));
      append(header, heading);
      append(header, actionButton('Close', close, { className: 'ryuten-account-close' }));
      const nav = makeElement('nav', { className: 'ryuten-account-tabs', 'aria-label': 'Account sections' });
      for (const tab of TAB_NAMES) append(nav, actionButton(tab[0].toUpperCase() + tab.slice(1), () => activateTab(tab), { className: `ryuten-account-tab${state.tab === tab ? ' is-active' : ''}`, disabled: state.tab === tab, attrs: { 'data-account-tab': tab } }));
      const body = makeElement('main', { className: 'ryuten-account-body' });
      if (state.tab === 'account') renderAccountTab(body, account);
      else if (state.tab === 'skins') renderSkinTab(body, account);
      else if (state.tab === 'hats') renderHatTab(body, account);
      else if (state.tab === 'emojis') renderEmojiTab(body, account);
      else renderShopTab(body);
      append(root, header, nav, statusNodes(), body);
      clear(panel);
      panel.append?.(root);
    }

    function activateTab(tab) {
      if (!TAB_NAMES.includes(tab)) return false;
      state.tab = tab;
      state.error = '';
      scheduleRender();
      if (signedIn()) {
        const load = tab === 'skins' ? loadSkins() : tab === 'hats' ? loadHats() : tab === 'emojis' ? loadEmojis() : tab === 'shop' ? Promise.all([loadHats(), loadEmojis()]) : null;
        if (load) Promise.resolve(load).catch(setError);
      }
      return true;
    }

    function prepareRyutenMenu() {
      port.feedTiming?.release?.('account');
      pp?.multibox?.releaseFeed?.();
      pp?.showRyuten?.();
      h?.menu?.show?.();
    }

    function open(target = 'account', slot) {
      const options = typeof target === 'string' ? { tab: target, slot } : (isObject(target) ? target : {});
      if (options.tab === 'advanced') return openAdvancedNativeSupport();
      if (TAB_NAMES.includes(options.tab)) state.tab = options.tab;
      if (Number.isInteger(Number(options.slot))) state.skinSlot = Math.max(0, Math.min(1, Number(options.slot)));
      focusReturn = doc?.activeElement || null;
      prepareRyutenMenu();
      state.open = true;
      state.error = '';
      state.message = '';
      if (panel) {
        panel.hidden = false;
        panel.classList?.add('is-open');
        if (typeof panel.showModal === 'function' && !panel.open) panel.showModal();
      }
      render();
      void refreshAccount().then(() => activateTab(state.tab)).catch(() => {});
      return true;
    }

    function close() {
      state.open = false;
      port.feedTiming?.release?.('account-close');
      pp?.multibox?.releaseFeed?.();
      if (panel) {
        if (typeof panel.close === 'function' && panel.open) panel.close();
        panel.hidden = true;
        panel.classList?.remove('is-open');
      }
      const target = focusReturn;
      focusReturn = null;
      if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
      else pp?.frame?.contentWindow?.focus?.();
      return true;
    }

    function publicState() {
      const account = currentAccount();
      return {
        open: state.open,
        tab: state.tab,
        profileIndex: state.profileIndex,
        skinSlot: state.skinSlot,
        signedIn: signedIn(),
        busy: state.busy || state.loading,
        error: state.error,
        message: state.message,
        account: account ? {
          id: finiteId(account.id),
          name: displayName(account),
          level: accountLevel(account),
          coins: account.coins ?? account.currency?.coins ?? null
        } : null,
        emojiSlots: emojiSlots(account).map(item => item ? { id: item.id, image_url: item.image_url, name: item.name } : null),
        hats: hatIds(account, state.profileIndex)
      };
    }

    Object.defineProperties(publicState, {
      open: { enumerable: true, get: () => state.open },
      tab: { enumerable: true, get: () => state.tab },
      busy: { enumerable: true, get: () => state.busy || state.loading },
      error: { enumerable: true, get: () => state.error },
      message: { enumerable: true, get: () => state.message }
    });

    const css = `
      #ryuten-account-panel { border: 0; border-radius: 14px; padding: 0; width: min(760px, calc(100vw - 28px)); max-height: min(760px, calc(100vh - 28px)); background: #111827; color: #f8fafc; box-shadow: 0 18px 70px #000b; }
      #ryuten-account-panel::backdrop { background: #020617b8; }
      #ryuten-account-panel[hidden] { display: none; }
      .ryuten-account-panel-inner { display: flex; flex-direction: column; min-height: 300px; }
      .ryuten-account-header { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 18px 20px 12px; border-bottom: 1px solid #334155; }
      .ryuten-account-header h2 { margin: 0 0 3px; font-size: 20px; }
      .ryuten-account-header span, .ryuten-account-note, .ryuten-account-current, .ryuten-account-card small { color: #a5b4fc; }
      .ryuten-account-tabs { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 20px; border-bottom: 1px solid #334155; }
      .ryuten-account-body { overflow: auto; padding: 16px 20px 20px; }
      .ryuten-account-actions, .ryuten-account-search { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 10px 0; }
      .ryuten-account-button { border: 1px solid #64748b; border-radius: 8px; padding: 7px 11px; background: #1e293b; color: #f8fafc; cursor: pointer; }
      .ryuten-account-button:hover, .ryuten-account-tab.is-active { background: #3730a3; }
      .ryuten-account-button:disabled { opacity: .55; cursor: default; }
      .ryuten-account-button.danger { border-color: #fb7185; }
      .ryuten-account-close { border: 0; border-radius: 6px; padding: 7px 11px; background: transparent; color: #f8fafc; font-size: 14px; cursor: pointer; }
      .ryuten-account-close:hover, .ryuten-account-close:focus-visible { background: #334155; }
      .ryuten-account-tab { border: 0; border-radius: 6px; padding: 6px 9px; background: #1e293b; color: #e2e8f0; cursor: pointer; }
      .ryuten-account-summary { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
      .ryuten-account-avatar, .ryuten-account-image { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; background: #0f172a; }
      .ryuten-account-summary-details { display: grid; gap: 3px; }
      .ryuten-account-section { margin-top: 18px; padding-top: 14px; border-top: 1px solid #334155; }
      .ryuten-account-section h3 { margin: 0 0 8px; }
      .ryuten-account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
      .ryuten-account-card { display: grid; gap: 7px; align-content: start; padding: 10px; border: 1px solid #334155; border-radius: 9px; background: #0f172a; }
      .ryuten-account-card .ryuten-account-image { width: 84px; height: 84px; justify-self: center; }
      .ryuten-account-card.is-selected { border-color: #818cf8; }
      .ryuten-account-field { display: grid; gap: 5px; margin: 8px 0; max-width: 240px; }
      .ryuten-account-field select, .ryuten-account-search input { min-height: 32px; border-radius: 6px; border: 1px solid #64748b; padding: 5px 8px; background: #0f172a; color: #f8fafc; }
      .ryuten-account-status { min-height: 20px; padding: 0 20px; }
      .ryuten-account-error { color: #fda4af; }
      .ryuten-account-message { color: #86efac; }
      .advanced-support { color: #cbd5e1; }
      #senpa-account .senpa-account-label, #senpa-account #senpa-account-name, #senpa-account #senpa-account-info { display: block; margin: 2px 0; }
      #senpa-account, #senpa-account .senpa-account-copy { display: block !important; }
      #senpa-account .senpa-account-label { color: #a5b4fc; font-size: 11px; letter-spacing: .08em; }
      #senpa-account #senpa-account-info { color: #cbd5e1; font-size: 11px; }
    `;

    if (doc?.createElement) {
      style = makeElement('style', { 'data-ryuten-account-style': 'true' });
      if (style) {
        style.textContent = css;
        (doc.head || doc.documentElement || doc.body)?.append?.(style);
      }
      panel = makeElement('dialog', { id: 'ryuten-account-panel', 'aria-label': 'Ryuten account', 'data-ryuten-account': 'panel' });
      if (panel) {
        panel.hidden = true;
        panel.addEventListener?.('cancel', event => {
          event.preventDefault();
          close();
        });
        panel.addEventListener?.('click', event => {
          if (event.target === panel) close();
        });
        doc.body?.append?.(panel);
      }
      addListener(doc, 'keydown', event => {
        if (state.open && event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation?.();
          close();
        }
      }, true);
    }

    const accountCard = doc?.getElementById?.('senpa-account');
    if (accountCard) {
      clear(accountCard);
      const copy = makeElement('div', { className: 'senpa-account-copy' });
      append(copy,
        makeElement('div', { className: 'senpa-account-label' }, 'RYUTEN ACCOUNT'),
        makeElement('strong', { id: 'senpa-account-name' }, 'Sign in to Senpa'),
        makeElement('span', { id: 'senpa-account-info' }, 'Account, skins, hats and emojis')
      );
      append(accountCard, copy, actionButton('Open account', open, { attrs: { 'data-account-action': 'open' } }));
    }

    const loginLink = doc?.getElementById?.('login-button');
    if (loginLink) {
      loginLink.removeAttribute?.('href');
      loginLink.textContent = 'ACCOUNT';
      loginLink.onclick = event => {
        event?.preventDefault?.();
        open();
      };
    }

    function intercept(id, callback) {
      const target = doc?.getElementById?.(id);
      if (!target?.addEventListener) return;
      const listener = event => {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        callback();
      };
      target.addEventListener('click', listener, true);
      listeners.push(() => target.removeEventListener?.('click', listener, true));
    }

    intercept('mame-trb-shop-btn', () => open('shop'));

    if (pp) pp.openSkinPicker = (slot = 0) => open('skins', slot);

    let tokenUnsubscribe = null;
    if (typeof h?.account?.onTokenChange === 'function') {
      try {
        tokenUnsubscribe = h.account.onTokenChange(token => {
          authGeneration += 1;
          awaitingAccountRefresh = Boolean(token);
          state.account = null;
          if (!token) {
            if (typeof h?.auth?.setEmojiSlots === 'function') h.auth.setEmojiSlots(null);
            state.message = 'Sign in to manage your Senpa account.';
            state.error = '';
            scheduleRender();
          } else {
            void refreshAccount().catch(() => {});
          }
        });
      } catch (error) {
        setError(error);
      }
    }

    const adapter = {
      open,
      close,
      refresh: refreshAccount,
      get state() { return publicState(); },
      snapshot: publicState,
      setProfile,
      openAuth,
      logout,
      equipSkin,
      loadSkins,
      equipHat,
      loadHats,
      equipEmoji,
      loadEmojis,
      sendEmoji,
      buyHat,
      buyEmoji,
      openAdvancedNativeSupport,
      panel,
      dispose() {
        for (const remove of listeners.splice(0)) remove();
        if (typeof tokenUnsubscribe === 'function') tokenUnsubscribe();
        if (pp?.openSkinPicker === adapter.openSkinPicker) pp.openSkinPicker = originalSkinPicker;
        panel?.remove?.();
        style?.remove?.();
      }
    };
    adapter.openSkinPicker = pp?.openSkinPicker;
    return adapter;
  }

  port.modules.installAccount = (h, reference) => {
    const adapter = createAdapter(h || {}, reference || {});
    port.account = adapter;
    return adapter;
  };
})();

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

(() => {
    'use strict';
    const rp = window.RYUTEN_PORT, pp = rp.parentPort, el = rp.el;
    const catalog = !rp.shieldsEnabled ? [] : [['SHIELD_BASIC_RING', 'Basic ring'], ['SHIELD_BASIC_RING_THIN', 'Basic ring (thin)'], ['SHIELD_BASIC_RING_THICK', 'Basic ring (thick)'], ['SHIELD_MESH_RING', 'Mesh ring'], ['SHIELD_GREMORY_G3_R1', 'Gremory Shield Gen III Rev 1'], ['SHIELD_GREMORY_G3_R2', 'Gremory Shield Gen III Rev 2'], ['SHIELD_VALI', 'Vali Shield'], ['SHIELD_HSLO', 'HSLO Shield'], ['SHIELD_TRINITY_R1', 'Trinity Shield Rev 1'], ['SHIELD_TRINITY_R2', 'Trinity Shield Rev 2'], ['SHIELD_CERAMIC_SNOW', 'Ceramic Snow Shield'], ['SHIELD_CRYSTAL_S', 'Crystal S']];
    async function loadAssets(r) { r.Pt._9854.clear(); await Promise.all(r.Rt.map(async (item) => { const key = item._9782; if (key === 'titillium-web-font-xml') {
        r.Pt._9854.set(key, '');
        return;
    } if (key === 'titillium-web-font-atlas') {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = '600 92px system-ui';
        const rects = [[0, 65, 95, 105], [346, 290, 72, 105], [176, 290, 86, 105], [89, 290, 87, 105], [190, 65, 93, 105], [0, 290, 89, 105], [283, 65, 93, 105], [262, 290, 84, 105], [95, 65, 95, 105], [376, 65, 93, 105]];
        rects.forEach(([x, y, w, h], n) => ctx.fillText(String(n), x + w / 2, y + h / 2, w - 6));
        r.Pt._9854.set(key, canvas);
        return;
    } const url = rp.asset(item._5195); const data = item._7926 === 'img' ? await rp.timeout(rp.loadImage(url), 12000, key) : await rp.request(url, item._7926 === 'json' ? 'json' : 'text'); r.Pt._9854.set(key, data); })); }
    function prepare(h, r) {
        rp.notice = (title, message) => { try {
            r.u._1162(String(title), String(message));
        }
        catch {
            pp.log('notice', { title, message });
        } };
        r.pe._1763 = Object.fromEntries(catalog.filter(([id]) => r.He[id]).map(([id, name]) => [id, { name, desc: 'Local cosmetic appearance. This is not a Senpa account purchase.' }]));
        // Ignore, but do not erase, preferences saved by the full-shields edition.
        r.pe._2874.shield = rp.shieldsEnabled ? rp.setting('shield', 'SHIELD_BASIC_RING') : '';
        if(!rp.shieldsEnabled){r.Be._8313='';r.Q.SHOW_SHIELDS._portHidden=true;}
        if (!r.He[r.pe._2874.shield])
            r.pe._2874.shield = '';
        r.pe._7186 = false;
        r.pe._1408 = async () => { };
        r.pe._4975 = async () => ({ error: 'native_senpa_account_required' });
        r.pe._2349 = async () => ({ error: 'ryuten_network_not_used' });
        Object.defineProperty(r.Re, '_1685', { get: () => !!h.network.connected, configurable: true });
        r.Re._7401 = () => { };
        r.Re._4761 = () => h.network.cleanUp();
        // No Ryuten network frame is ever sent to a Senpa socket.
        r.Me._3807 = index => pp.request('play', index);
        r.Me._6441 = (index, count) => pp.multibox.packetAction('split',index,count);
        r.Me._4727 = index => pp.multibox.packetAction('feed',index,true,1);
        r.Me._3605 = (index, state) => {if(!state)return rp.feedTiming?.release('ryuten-input');return h.actions.macroFeed(true);};
        r.Me._9701 = () => { };
        r.Me._8184 = () => { };
        r.Me._2705 = () => { };
        r.Me._9381 = () => { };
        r.Me._9067 = tag => { if (rp.identityReady) {
            h.player.teamTag = String(tag);
            h.packets.tag();
        } };
        rp.resolveSkinURL = raw => {
            const text=String(raw||'').trim();
            if(!text||text==='no-skin'||text==='null')return '';
            try { const u=new URL(text,'https://api.senpa.io/u/');
                return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';
            }catch{return '';}
        };
        rp.syncAccountSkins = () => {
            const a=h.store.account,index=h.store.profiles?.selected||0;
            const selected=a&&typeof a==='object'&&!a.error?h.accountSkins(a,index):[h.player.skin1||'',h.player.skin2||''];
            selected.slice(0,2).forEach((raw,slot)=>{
                const url=rp.resolveSkinURL(raw);
                if(r.Be._4564[slot]===url)return;
                r.Be._4564[slot]=url;r.is._2736[slot+2]=url;
                r.Ue._3901[slot===0?'_9315':'_8053']=url;
            });
        };
        // Native Senpa's original authenticated picker owns skin equip, permissions and persistence.
        // Ryuten's URL-gallery callback may be called during its bootstrap; it must not send a skin packet.
        r.Me._3661 = () => { }; // Account picker opens only from explicit UI clicks, never from preview synchronization.
        r.Me._2232 = id => {
            if(!rp.shieldsEnabled){r.pe._2874.shield='';r.Be._8313='';return;}
            if (id && !r.pe._1763[id])
            return; r.pe._2874.shield = id; r.Be._8313 = id; rp.saveSetting('shield', id); for (const c of rp.world?.clients.values() || [])
            if (c._9710)
                c._8313 = id; };
        r.Me._5518 = () => rp.notice('Titles', 'Account titles remain managed by Senpa.');
        r.is._9537 = () => pp.request('play');
        r.is._7577 = () => pp.request('spectate');
        r.is._6282 = () => pp.showNative('Senpa replay gallery');
        r.xe.clear();
        r.xe.set('senpa', 'SENPA');
        r.ke.clear();
        r.ke.set('tracker', 'Live servers');
        r.is._2736[4] = 'senpa';
        r.is._2736[5] = 'tracker';
        const restore = r.is._8296.bind(r.is);
        r.is._8296 = () => { restore(); r.is._2736[4]='senpa';r.is._2736[5]='tracker';
            const a=h.store.account;
            const skins=a&&typeof a==='object'&&!a.error?h.accountSkins(a,h.store.profiles?.selected||0):[h.player.skin1||'',h.player.skin2||''];
            r.is._2736[2]=rp.resolveSkinURL(skins[0]);r.is._2736[3]=rp.resolveSkinURL(skins[1]);
        };
        r._s._2794 = () => { r._s._1162.clear(); r._s._1162.set('senpa', new Map([['tracker', [0, 0]]])); };
        r._s._4659 = () => { };
        // Native Senpa records/replays its own packets; unrelated Ryuten replay serialisation is never used.
        r.y_._7069 = () => { };
        r.ce._4659=()=>{};
        r.ls._4659=()=>{};r.ls._4186=()=>{};
    }
    function setupUI(h, r) {
        const $ = id => document.getElementById(id), put = (id, text) => { if ($(id))
            $(id).textContent = text; };
        document.documentElement.classList.add('sp-menu');
        document.documentElement.classList.toggle('sp-no-shields',!rp.shieldsEnabled);
        put('client-version', 'Senpa port ' + rp.build.version + (rp.shieldsEnabled?'':' · No Shields') + ' · XPLUS 500 Test');
        const main = $('main-menu'), hero = el('section', { id: 'senpa-hero' }), orb = el('div', { id: 'senpa-orb-wrap' });
        main.append(hero);
        orb.append($('orb-display'), $('change-skin-0'), $('change-skin-1'));
        hero.append(orb);
        const identity = el('div', { id: 'senpa-identity' });
        const makeInput = (label, value, maxLength = 30) => { const box = el('label', {}, label), input = el('input', { value, maxLength, autocomplete: 'off' }); box.append(input); identity.append(box); return input; };
        const saved = rp.setting('identity', {});
        const tag = makeInput('TEAM / TAG', h.player.teamTag || saved.tag || '', 20), nick = makeInput('SENPA NICKNAME', h.player.nick || saved.nick || '', 30);
        hero.append(identity);
        rp.commitIdentity = () => { const n = nick.value.trim(), t = tag.value.trim(); h.player.nick = n; h.player.teamTag = t; if (h.store.profile)
            h.store.profile.nick = n; if (h.store.profiles)
            h.store.profiles.tag = t; r.Be._8709 = n; r.Be._6448 = t; rp.saveSetting('identity', { nick: n, tag: t }); h.packets.nick(); h.packets.tag(); };
        nick.onchange = tag.onchange = rp.commitIdentity;
        rp.identityReady = true;
        for(let slot=0;slot<2;slot++)$('change-skin-'+slot).addEventListener('click',event=>{
            event.preventDefault();event.stopImmediatePropagation();pp.openSkinPicker(slot);
        },true);
        const motion=el('div',{className:'senpa-motion'}),style=el('select',{'aria-label':'Animation / gameplay style'});
        for(const name of ['Senpa','Ryuten','XPLUS'])style.append(el('option',{value:name},name));
        const range=el('input',{type:'range','data-senpa-animation':'1','aria-label':'Animation response milliseconds'}),out=el('output');
        rp.refreshMotionUI=()=>{
            const mode=r.Q.PRESENTATION_STYLE._5997(),native=mode==='Senpa';
            style.value=mode;range.min=native?'0':mode==='XPLUS'?'120':'80';range.max=native?'500':mode==='XPLUS'?'500':'300';range.step=mode==='Senpa'?'5':'10';
            range.value=String(native?h.settings.cellAnimation:mode==='XPLUS'?r.Q.XPLUS_SETTLE_MS._5997():r.Q.ELEMENT_ANIMATION_SOFTENING._5997());
            range.setAttribute('aria-label',mode+' animation milliseconds');
            out.textContent=mode==='Ryuten'?((Number(range.value)-80)/2)+'% · '+range.value+' ms':range.value+' ms'+(mode==='XPLUS'?' (ULTRA · visual lag)':'');
        };
        style.onchange=()=>{r.Q.PRESENTATION_STYLE._7531(style.value);rp.refreshMotionUI();};
        range.oninput=()=>{if(style.value==='Senpa')pp.setSetting('cellAnimation',Number(range.value));else (style.value==='XPLUS'?r.Q.XPLUS_SETTLE_MS:r.Q.ELEMENT_ANIMATION_SOFTENING)._7531(Number(range.value));rp.refreshMotionUI();};
        motion.append(el('span',{},'Style'),style,range,out);hero.append(motion);rp.refreshMotionUI();
        const feedRow=el('div',{className:'senpa-motion'}),feedRange=el('input',{type:'range',min:'0',max:'5000',step:'1','data-senpa-feed':'1','aria-label':'Macro feed interval milliseconds'}),feedOut=el('output');
        rp.refreshFeedUI=()=>{const value=r.Q.FEED_INTERVAL_MS._5997(),fast=r.Q.FAST_FEED_TEST._5997();
          feedRange.value=String(value);feedRange.disabled=fast;feedOut.textContent=fast?'TEST · 10 ms requests':value===0?'Native':value+' ms';
          feedRange.setAttribute('aria-valuetext',fast?'Fast test active: 10 millisecond eject requests':value===0?'Native Senpa automatic feed':value+' milliseconds');
          const toggle=document.getElementById('senpa-fast-feed-test');if(toggle)toggle.checked=fast;};
        feedRange.oninput=()=>r.Q.FEED_INTERVAL_MS._7531(Number(feedRange.value));
        feedRow.append(el('span',{},'Macro feed'),feedRange,feedOut);hero.append(feedRow);
        const fastFeed=el('input',{id:'senpa-fast-feed-test',type:'checkbox'}),fastLabel=el('label',{className:'senpa-motion'},'Fast feed test · 10 ms requests (server-limited)');
        fastLabel.prepend(fastFeed);hero.append(fastLabel);fastFeed.onchange=()=>r.Q.FAST_FEED_TEST._7531(fastFeed.checked);rp.refreshFeedUI();
        const description=el('small',{className:'senpa-motion-note'},'XPLUS ULTRA adds visual lag to cells, camera and zoom. Senpa / Ryuten keep native camera. Server physics unchanged.');hero.append(description);
        const status = el('div', { id: 'senpa-status' }, 'Select a live Senpa server.');
        hero.append(status);
        const account = el('section', { id: 'senpa-account' });
        account.append(el('div', {}, 'SENPA ACCOUNT'));
        const accountName = el('strong', {}, 'Senpa account'), accountInfo = el('div', {}, 'Skins, hats and game emojis');
        account.append(accountName, accountInfo);
        const login = el('button', {}, 'Account / Sign in');
        login.onclick = () => rp.account.open('account');
        account.append(login);
        document.querySelector('.mame-bottom-left-bar').prepend(account);
        const select = el('select', { id: 'senpa-server-select', 'aria-label': 'Senpa server' }), trackerState = el('div', { id: 'senpa-tracker-state' }), refresh = el('button', { id: 'senpa-refresh' }, 'Refresh live tracker');
        refresh.onclick = () => pp.tracker.refresh();
        $('mame-server-info-box').append(select, refresh, trackerState);
        select.onchange = () => { pp.selected = select.value; pp.selectedServerId = pp.tracker.servers.find(s => s.host === select.value)?.id; try {
            localStorage.setItem('ryuten.senpa.v1.selected', select.value);
        }
        catch { } if (h.network.connected && h.network.url !== select.value) {
            pp.spawnPending.clear();
            pp.pending = null;
            pp.connect(select.value);
        } rp.renderServers(false); };
        rp.renderServers = (rebuild = true) => { const tracker = pp.tracker; if (!tracker)
            return; let selected = h.network.connected&&h.network.url?h.network.url:pp.selected; const list = tracker.servers; const previous = pp.selectedServerId; const selectedEntry = list.find(s => s.host === selected) || (!h.network.connected&&list.find(s => s.id === previous)); if (selectedEntry) {
            pp.selected = selected = selectedEntry.host;
            pp.selectedServerId = selectedEntry.id;
        }
        else if (list.length && !h.network.connected) {
            pp.selected = selected = list[0].host;
            pp.selectedServerId = list[0].id;
        } if (rebuild) {
            select.replaceChildren();
            if (!list.length)
                select.append(el('option', { value: '' }, 'Tracker unavailable — refresh'));
            const groups = new Map();
            for (const s of list) {
                let group = groups.get(s.region);
                if (!group) {
                    group = el('optgroup', { label: s.region });
                    groups.set(s.region, group);
                    select.append(group);
                }
                group.append(el('option', { value: s.host }, `${s.name} · ${s.modeName} (${s.players}/${s.capacity})`));
            }
            if (list.some(s => s.host === selected))
                select.value = selected;
            else if (!selected && list.length) {
                pp.selected = list[0].host;
                select.value = pp.selected;
            }
        }
        // The endpoint is the source of truth once connected, even when tracker
        // refresh omits it. Never silently label a different server as connected.
        if(h.network.connected&&selected&&!list.some(s=>s.host===selected)){
            if(![...select.options].some(o=>o.value===selected))select.append(el('option',{value:selected},'Connected endpoint (not in current tracker)'));
        }
        if([...select.options].some(o=>o.value===selected))select.value=selected;
        const s = list.find(s => s.host === select.value); put('mame-sib-selected-region', s ? 'SENPA · ' + s.region : 'SENPA'); put('mame-sib-selected-mode', s?.name || 'SELECT SERVER'); put('mame-sib-players-info', s ? `${s.players} PLAY | ${s.spectators} SPEC` : ''); trackerState.textContent = (h.network.connected?'Connected: '+h.network.url+' · ':'Selected, not connected · ')+(tracker.stale ? `Tracker stale / unavailable. ${tracker.error}` : `Live tracker · refreshed ${new Date(tracker.updatedAt).toLocaleTimeString()}`); };
        $('mame-sib-settings-btn').addEventListener('click', event => { event.stopImmediatePropagation(); select.focus(); try {
            select.showPicker?.();
        }
        catch { } }, true);
        $('mame-trb-shop-btn').addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); rp.account.open('shop'); }, true);
        $('mame-trb-shop-btn').textContent = 'ACCOUNT / SHOP';
        const loginLink = $('login-button');
        loginLink.removeAttribute('href');
        loginLink.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();rp.account.open('account');},true);
        const extras=el('div',{id:'senpa-extra-settings'});
        const nativeBtn=el('button',{className:'sp-button'},'Advanced native support');
        nativeBtn.onclick=()=>rp.account.open('advanced');
        const restoreMap=el('button',{className:'sp-button',id:'senpa-restore-map'},'Restore Ryuten map');restoreMap.onclick=()=>rp.restoreRyutenMap();
        const retryMap=el('button',{className:'sp-button'},'Retry map image');retryMap.onclick=()=>rp.reloadMap();
        const mapStatus=el('span',{id:'senpa-map-status'});
        const importMap=el('button',{className:'sp-button',id:'senpa-import-map'},'Import local map image');
        const mapFile=el('input',{id:'senpa-map-file',type:'file',accept:'image/png,image/jpeg,image/webp',hidden:true});
        importMap.onclick=()=>mapFile.click();
        mapFile.onchange=async()=>{const file=mapFile.files?.[0];mapFile.value='';if(!file)return;
          try{await rp.importWorldMap(file);rp.notice('Local map','Image saved locally; no upload or runtime image-host request.');}
          catch(e){rp.notice('Local map',e.message);}};
        extras.append(nativeBtn,restoreMap,retryMap,importMap,mapFile,mapStatus);$('settings-menu').append(extras);
        const importInput=$('import-settings-file-input');importInput.accept='.json,.ryuset';
        importInput.addEventListener('change',event=>{
            event.stopImmediatePropagation();const file=importInput.files?.[0];
            if(file)rp.importSettings(file).then(()=>{rp.notice('Settings','Merged settings imported');r.yt._2059();}).catch(e=>rp.notice('Import',e.message));
            importInput.value='';
        },true);
        $('export-settings-button').addEventListener('click',event=>{event.stopImmediatePropagation();rp.exportSettings();},true);
        const categories=$('imex-menu-categories');categories.replaceChildren(el('div',{},'Exports shared Senpa / Ryuten settings'+(rp.shieldsEnabled?' and local shield':'')+'. Account credentials and account skin ownership are not exported.'));
        const tabs = el('div', { id: 'senpa-tabs' });
        document.body.append(tabs);
        rp.updateTabs = () => { const count = pp.multibox?.tabCount?.() || Math.max(2, h.world.myPlayerIDs.length); if (tabs.childElementCount !== count) {
            tabs.replaceChildren();
            for (let i = 0; i < count; i++) {
                const button = el('button', { title: `Activate / spawn Senpa player ${i + 1}` }, 'P' + (i + 1));
                button.onclick = () => pp.request('switch', i);
                tabs.append(button);
            }
        } [...tabs.children].forEach((button, i) => { button.classList.toggle('active', h.player.activeTab === i); button.classList.toggle('pending', pp.spawnPending.has(i)); }); };
        rp.updateTabs();
        const team = el('section', { id: 'senpa-team' });
        document.body.append(team);
        const metrics = el('div', { id: 'senpa-runtime-metrics' });
        document.body.append(metrics);
        const chat = $('chbx-body-content');
        let chatScrollQueued=false;
        rp.addChat = data => {
            const line=el('div',{className:'senpa-chat-line'});
            const name=el('span',{className:'senpa-chat-name'},`${data.nick || 'Senpa'}: `);
            name.style.color=rp.chatNameColor(data.color);
            const message=el('span',{className:'senpa-chat-message'},String(data.message||''));
            // No HTML interpretation of names/messages and no changes to game colours.
            line.append(name,message);chat.append(line);
            while(chat.childElementCount>120)chat.firstElementChild.remove();
            // The inner container owns overflow, not its parent. One scroll per frame.
            if(!chatScrollQueued){chatScrollQueued=true;requestAnimationFrame(()=>{
                chatScrollQueued=false;chat.scrollTop=chat.scrollHeight;
            });}
        };
        const chatInput = el('input', { id: 'senpa-chat-input', placeholder: 'Enter a message…', maxLength: 200 });
        document.body.append(chatInput);
        const chatToggle = () => { chatInput.classList.toggle('open'); h.menu.isChatFocused = chatInput.classList.contains('open'); if (h.menu.isChatFocused) {
            rp.feedTiming?.release('chat');rp.lineSplit?.cancel('chat');pp.multibox?.releaseFeed();chatInput.focus();}
        else
            chatInput.blur(); };
        rp.toggleChat = chatToggle;
        chatInput.onkeydown = event => { event.stopImmediatePropagation(); if(event.isComposing)return; if (event.key === 'Enter') {
            event.preventDefault();
            if (chatInput.value.trim()){
                const host=pp.multibox?.multi?pp.multibox.host():h;
                if(!host?.network.connected||!host.packets.handshakeDone){rp.notice('Chat','Wait for the active connection to be ready. Your message was kept.');return;}
                try{h.packets.chat(1, chatInput.value.trim());}catch(error){rp.notice('Chat',String(error.message||error));return;}
            }
            chatInput.value = '';
            chatToggle();
        }
        else if (event.key === 'Escape')
            chatToggle(); };
        let teamSignature='',leaderSignature='';
        rp.updateHUD = () => { const ts=JSON.stringify(pp.teamlist||[]);if(ts!==teamSignature){teamSignature=ts;team.replaceChildren(el('strong', {}, 'TEAM')); for (const p of pp.teamlist || []) {
            const row = el('div');
            row.append(el('span', {}, p.nick || 'Unnamed'), el('span', {}, `${p.mass} ${p.location || ''}`));row.firstElementChild.style.color=rp.nameColor(p.color);
            team.append(row);
        }} team.hidden = h.settings.hideHUD || r.Q.SHOW_TEAM_LIST._5997() === 'hide'; const lb = $('leaderboard');const ls=JSON.stringify(pp.leaderboard||[]);if(ls!==leaderSignature){leaderSignature=ls;lb.replaceChildren(); for (const [p, data] of (pp.leaderboard || []).entries()) {
            const row = el('div', { className: 'leaderboard-entry' });
            row.append(el('span', {}, `${p + 1}. ${data.nick || 'Unnamed'}`), el('span', {}, ` ${data.mass}`));row.style.color=rp.nameColor(data.color);
            lb.append(row);
        }} metrics.textContent = `FPS ${h.metrics.fps || 0} · PING ${h.network.latency || 0} ms · ${rp.motion.style} ${rp.motion.style==='Senpa'?h.settings.cellAnimation:rp.motion.delay} ms`; metrics.hidden = h.settings.hideHUD || r.Q.SHOW_METRICS._5997() === 'hide'; lb.style.visibility = h.settings.hideHUD||r.Q.SHOW_LEADERBOARD._5997()==='hide' ? 'hidden' : ''; chat.parentElement.style.visibility = h.settings.hideHUD ? 'hidden' : ''; };
        const updateMenuState=()=>{
            const stack=r.rs._9222;
            document.documentElement.classList.toggle('sp-menu',stack.length>0);
            document.documentElement.classList.toggle('sp-submenu',stack.length>0&&stack.at(-1)!==r.is);
            h.menu.isOpen=stack.length>0;h.menu.isSettingsMenuOpen=stack.length>0&&stack.at(-1)!==r.is;
            rp.feedTiming?.onMenu(h.menu.isOpen);if(h.menu.isOpen)rp.lineSplit?.cancel('menu');
        };
        rp.showMenu=()=>{
            const stack=r.rs._9222;
            if(stack.includes(r.is)){while(stack.at(-1)!==r.is)r.rs._5705();}
            else {r.rs._6230();r.rs._6422(r.is);}
            updateMenuState();
        };
        rp.hideMenu=()=>{r.yt._2059();r.rs._6230();updateMenuState();};
        rp.back=()=>{
            const modal=$('import-export-menu');
            if(modal&&getComputedStyle(modal).display!=='none'){r.yt._2059();return;}
            const stack=r.rs._9222;
            if(stack.length>1)r.rs._5705();
            else if(stack.length)r.rs._5705();
            else r.rs._6422(r.is);
            updateMenuState();
        };
        const editable=target=>target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable="true"]');
        document.addEventListener('keydown',event=>{
            if(rp.account?.state?.open){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();rp.account.close();}return;}
            if(rp.multiboxDialog?.open){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();rp.multiboxDialog.close();}return;}
            if(event.repeat)return;
            const key=h.input.keyboard?.getKeyName(event);
            if(event.key==='Escape'){
                // Dialog/back works even when its text field owns focus. Chat handles its own Escape.
                if(event.target===chatInput)return;
                event.preventDefault();event.stopImmediatePropagation();
                if(editable(event.target))event.target.blur();rp.back();return;
            }
            if(editable(event.target))return;
            if(key===h.settings.hkToggleMenu){event.preventDefault();event.stopImmediatePropagation();rp.back();return;}
            if(key===h.settings.hkTogglePlayer){event.preventDefault();event.stopImmediatePropagation();pp.request('switch');return;}
            if(key===h.settings.hkToggleChat){event.preventDefault();event.stopImmediatePropagation();chatToggle();return;}
            if(r.rs._4020)return;
            const lineKey=r.Q.HK_LINE_SPLIT?._5997()?.[0];
            if(lineKey&&lineKey!=='NONE'&&lineKey!=='NO KEY'&&key===lineKey){event.preventDefault();event.stopImmediatePropagation();rp.lineSplit?.trigger();return;}
            h.menu.isOpen=false;pp.multibox.dispatchInput('keyboard','keydown',event);
        },true);
        document.addEventListener('keyup', event => { if (!editable(event.target))
            pp.multibox.dispatchInput('keyboard','keyup',event);
            else if(h.input.keyboard?.getKeyName(event)===h.settings.hkMacroFeed){rp.feedTiming?.release('editable-keyup');pp.multibox?.releaseFeed();}
        });
        document.addEventListener('mousemove', event => { h.input.mouse?.setMouse(event); r.W_._9701._7847 = event.clientX; r.W_._9701._9202 = event.clientY; });
        for (const type of ['mousedown', 'mouseup'])
            document.addEventListener(type, event => { if (r.rs._4020 || editable(event.target) || event.target.closest('#senpa-tabs'))
                return; h.menu.isOpen = false; pp.multibox.dispatchInput('mouse',type,event); });
        document.addEventListener('contextmenu', event => event.preventDefault());
        document.addEventListener('wheel', event => { if (!r.rs._4020) {
            event.preventDefault();
            rp.motion.wheel(event);
        } }, { passive: false });
        window.addEventListener('blur', () => {pp.multibox?.releaseFeed();h.actions.macroFeed(false);});
        let lastUI = 0;
        rp.afterFrame = now => { if (now - lastUI < 250)
            return; lastUI = now; h.menu.isOpen = !!r.rs._4020; h.menu.isSettingsMenuOpen = !!r.rs._4020 && !r.is._3689; document.documentElement.classList.toggle('sp-menu', !!r.rs._4020); document.documentElement.classList.toggle('sp-submenu', !!r.rs._4020 && !r.is._3689); rp.updateTabs(); rp.updateHUD(); rp.renderServers(false);rp.syncAccountSkins();mapStatus.textContent=rp.mapState.status==='ready'?'Map image ready':rp.mapState.status==='error'?'Map unavailable — Retry or change URL':rp.mapState.status==='loading'?'Loading map image…':rp.mapState.status==='missing-original'?'Original Ryuten map missing — import local image':''; status.textContent = pp.error ? 'Client error' : pp.pending && !pp.readyToAct() ? 'Waiting for Senpa connection / verification' : pp.spawnPending.size ? 'Spawn requested — waiting for server' : h.network.connected ? `${h.world.myPlayerIDs.length} native player tabs · ${h.player.isAlive ? 'Playing' : h.player.isSpectating ? 'Spectating' : 'Ready'}` : 'Select a server and click Play or Spectate'; const a = h.store.account; accountName.textContent = a?.real_name || 'Senpa account'; accountInfo.textContent = a&&typeof a==='object' ? [a.experience != null ? 'Level ' + h.accountLevel.levelFromExp(a.experience) : '', a.experience != null ? Number(a.experience).toLocaleString() + ' XP' : '', a.coins != null ? Number(a.coins).toLocaleString() + ' coins' : ''].filter(Boolean).join(' · ') : h.auth.authToken ? 'Loading Senpa account…' : 'Sign in using Senpa’s original account flow'; };
        rp.renderServers();
        rp.syncAccountSkins();rp.showMenu();
    }
    rp.start = async () => {
        await rp.timeout(rp.referencePromise, 15000, 'Ryuten source');
        const r = rp.reference, h = pp.host;
        rp.host = h;
        for (const image of document.images) {
            const src = image.getAttribute('src');
            if (src)
                image.src = rp.asset(src);
        }
         void rp.modules.installFonts();
        rp.modules.installLoadingLifecycle(r.Nt);
         await rp.timeout(rp.wasmPromise, 15000, 'Albion renderer helpers');
         // Generate bitmap numerals with installed system typography; no font CDN.
         await rp.timeout(rp.fontsReady || Promise.resolve(), 4500, 'Senpa font resources').catch(e => rp.log('warn', 'font-load', { message: e.message }));
        r.n._4659();
        r.q._2794();
        void r.Nt._2794().catch(e => rp.log('warn', 'loading-background', { message: e.message }));
        rp.world = new rp.modules.WorldBridge(h, r);
        prepare(h, r);
        rp.modules.prepareReadableChat();
        rp.modules.mergeSettings(h, r);
        rp.modules.multiboxSettings(h,r);rp.modules.installThemes(h,r);
        rp.motion=new rp.modules.MotionProfiles(h,r);
        rp.modules.installFeedTiming(h,r,{intervalMs:rp.effectiveFeedInterval()});
        rp.modules.installCosmetics(h,r);
        rp.modules.installLineSplit(h,r);
        rp.modules.installMetrics(h,r);
        rp.modules.installWorldMap(r);
        await loadAssets(r);
        if (pp.test?.beforeGraphics)
            pp.test.beforeGraphics(r, window);
        r.c.P6Y.skipHello();
        r._s._2794();
        r.fs._2794();
        rp.modules.installReadableChat(r);
        r.X_._2794();
        r.is._3225 = true;
        r.Ue._3225 = true;
        r.Ge._3225 = true;
        setupUI(h, r);
        rp.modules.installAccount(h,r);
        rp.modules.installMultiboxUI(h,r);
        rp.resetWorld = () => rp.world.reset();
        r.Nt._6947(100);
        r.Nt._5075();
        rp.status.ready = true;
        rp.status.renderer = pp.test ? 'GPU submission substituted' : 'PixiJS 6.5.10 WebGL';
        rp.frame = now => { const start=parent.performance.now();let worldEnd=start,renderEnd=start;r.o._5027(); try {
            r.n._4659();
            r.X_._6762();
            rp.motion.frameNow=Number.isFinite(now)?now:parent.performance.now();
            rp.cosmetics.begin(rp.motion.frameNow);
            rp.world.sync();
            r.ne._4659();
            r.Be._4659();
            rp.world.camera();pp.multibox?.copyCamera();worldEnd=parent.performance.now();
            r.X_._4659();
            r.fs._4659();renderEnd=parent.performance.now();
            rp.afterFrame(now);
        }
        finally {
            r.o._4067();const end=parent.performance.now();rp.metrics.frame({now:start,worldMs:worldEnd-start,renderMs:renderEnd-worldEnd,uiMs:end-renderEnd,cpuMs:end-start,nativeMs:Math.max(0,start-h.loop.time)});
        } };
        rp.log('info', 'presentation-ready', { nativeSettings: rp.nativeSettingCount, ryutenSettings: Object.keys(r.Q).filter(k => !k.startsWith('SENPA_')).length, shields: Object.keys(r.pe._1763).length });
        return rp;
    };
})();
