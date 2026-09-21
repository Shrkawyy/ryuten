

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