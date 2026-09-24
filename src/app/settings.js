

/* One canonical setting per shared concept. Hidden aliases exist only for native render internals. */
(() => {
  'use strict';
  const rp=window.RYUTEN_PORT;
  rp.modules.mergeSettings=(h,r)=>{
    const bindings=[],covered=new Set(),nativeRows=new Map();let syncing=false;
    const definitions=h.settingsStore.definitions;
    // Requested held-W behavior for this port. Only swap the exact old W/E
    // defaults; never commandeer a customized recording/split/chat binding.
    if (!rp.setting('held-feed-migration-v1', false)) {
      const before={hkFeed:h.settings.hkFeed,hkMacroFeed:h.settings.hkMacroFeed,feedFollowsTab:h.settings.feedFollowsTab};
      rp.saveSetting('held-feed-before-v1', before);
      if (before.hkFeed==='W' && before.hkMacroFeed==='E') {
        rp.parentPort.setSetting('hkFeed','E');rp.parentPort.setSetting('hkMacroFeed','W');
      }
      rp.parentPort.setSetting('feedFollowsTab',true);
      rp.saveSetting('held-feed-migration-v1',true);
    }
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
    rp.modules.installLineSettings(r,add);
    wire('SHOW_ENEMY_USERNAME','cellNick');r.Q.SHOW_ENEMY_USERNAME._8192='Show names';
    wire('SHOW_ENEMY_ENERGY','cellMass');r.Q.SHOW_ENEMY_ENERGY._8192='Show mass';
    wire('SHOW_CUSTOM_SKINS','cellSkin');r.Q.SHOW_CUSTOM_SKINS._8192='Show skins';
    wire('SHOW_TEAM_NAME','cellClanTag');r.Q.SHOW_TEAM_NAME._8192='Show Teamtag / clan tags';
    r.Q.SHOW_TEAM_NAME._5901='Displays the team tag supplied by Senpa, with clanTag as fallback when the team tag is empty.';
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
    r.F.HK_EJECT=['E','NONE'];r.F.HK_MACRO_EJECT=['W','NONE'];
    r.Q.HK_EJECT._8192='Single eject';r.Q.HK_MACRO_EJECT._8192='Hold to feed (follows selected player)';
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