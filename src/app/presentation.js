

(() => {
    'use strict';
    const rp = window.RYUTEN_PORT, pp = rp.parentPort, el = rp.el;
    const catalog = !rp.shieldsEnabled ? [] : [['SHIELD_BASIC_RING', 'Basic ring'], ['SHIELD_BASIC_RING_THIN', 'Basic ring (thin)'], ['SHIELD_BASIC_RING_THICK', 'Basic ring (thick)'], ['SHIELD_MESH_RING', 'Mesh ring'], ['SHIELD_GREMORY_G3_R1', 'Gremory Shield Gen III Rev 1'], ['SHIELD_GREMORY_G3_R2', 'Gremory Shield Gen III Rev 2'], ['SHIELD_VALI', 'Vali Shield'], ['SHIELD_HSLO', 'HSLO Shield'], ['SHIELD_TRINITY_R1', 'Trinity Shield Rev 1'], ['SHIELD_TRINITY_R2', 'Trinity Shield Rev 2'], ['SHIELD_CERAMIC_SNOW', 'Ceramic Snow Shield'], ['SHIELD_CRYSTAL_S', 'Crystal S']];
    async function loadAssets(r) { r.Pt._9854.clear(); await Promise.all(r.Rt.map(async (item) => { const key = item._9782; if (key === 'titillium-web-font-xml') {
        r.Pt._9854.set(key, '');
        return;
    } if (key === 'titillium-web-font-atlas') {
        r.Pt._9854.set(key, rp.modules.massLabels.createAtlas());
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
        r.Me._3605 = (index, state) => h.actions.macroFeed(!!state); // Physical hold owns release, not a mirrored visual-tab event.
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
            if(rp.lineSplit?.handleKeyboard(event)){event.preventDefault();event.stopImmediatePropagation();return;}
            h.menu.isOpen=false;
            if(rp.feedTiming?.handleKeyboard(event,key)){event.preventDefault();event.stopImmediatePropagation();return;}
            pp.multibox.dispatchInput('keyboard','keydown',event);
        },true);
        document.addEventListener('keyup', event => {
            if(rp.feedTiming?.handleKeyboard(event,h.input.keyboard?.getKeyName(event))){event.preventDefault();event.stopImmediatePropagation();return;}
            if (!editable(event.target))
            pp.multibox.dispatchInput('keyboard','keyup',event);
            else if(h.input.keyboard?.getKeyName(event)===h.settings.hkMacroFeed){rp.feedTiming?.release('editable-keyup');pp.multibox?.releaseFeed();}
        },true);
        document.addEventListener('mousemove', event => { h.input.mouse?.setMouse(event); r.W_._9701._7847 = event.clientX; r.W_._9701._9202 = event.clientY; });
        for (const type of ['mousedown', 'mouseup'])
            document.addEventListener(type, event => {
                if(type==='mouseup'&&rp.feedTiming?.handleMouse(event)){event.preventDefault();event.stopImmediatePropagation();return;}
                if (r.rs._4020 || editable(event.target) || event.target.closest('#senpa-tabs'))
                return; if(type==='mousedown'&&rp.lineSplit?.handleMouse(event)){event.preventDefault();event.stopImmediatePropagation();return;} h.menu.isOpen = false; if(rp.feedTiming?.handleMouse(event)){event.preventDefault();event.stopImmediatePropagation();return;} pp.multibox.dispatchInput('mouse',type,event); },true);
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
        rp.modules.installWorldBorder(h,r);
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