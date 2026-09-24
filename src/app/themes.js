

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