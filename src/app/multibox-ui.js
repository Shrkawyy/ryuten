

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