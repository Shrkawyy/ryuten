

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