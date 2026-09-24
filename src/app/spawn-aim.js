/* Fixed world target projected through the visible Ryuten camera, including XPLUS. */
(() => {
  'use strict';
  const rp=window.RYUTEN_PORT;
  rp.modules.spawnProjection=(r,offset,point,inverse=false)=>{
    const canvas=r.X_._4894,rect=canvas.getBoundingClientRect(),zoom=r.z_._4336;
    if(!(rect.width>0&&rect.height>0&&r.X_._3473>0&&r.X_._3195>0&&zoom>0))return null;
    const cx=r.z_._3852._7847,cy=r.z_._3852._9202;
    const result=inverse?{
      x:cx+((point.x-rect.left)*r.X_._3473/rect.width-r.X_._3473/2)/zoom-offset,
      y:cy+((point.y-rect.top)*r.X_._3195/rect.height-r.X_._3195/2)/zoom-offset
    }:{
      x:rect.left+(r.X_._3473/2+(point.x+offset-cx)*zoom)*rect.width/r.X_._3473,
      y:rect.top+(r.X_._3195/2+(point.y+offset-cy)*zoom)*rect.height/r.X_._3195
    };
    return Number.isFinite(result.x)&&Number.isFinite(result.y)?result:null;
  };
  rp.modules.installSpawnAim=(h,r)=>{
    const m=rp.parentPort.multibox;
    const marker=rp.el('div',{id:'senpa-spawn-target','aria-hidden':'true',hidden:true});
    marker.style.cssText='position:fixed;width:18px;height:18px;box-sizing:border-box;border:2px solid #315cff;background:#315cff20;box-shadow:0 0 0 1px #0008;pointer-events:none;z-index:80;transform:translate(-50%,-50%);';
    const center=rp.el('div');center.style.cssText='position:absolute;left:50%;top:50%;width:4px;height:4px;background:#8faaff;transform:translate(-50%,-50%);';marker.append(center);document.body.append(marker);
    let consumed=false,held=false;
    const aim=rp.spawnAim={
      marker,
      mouseWorld(event){return rp.modules.spawnProjection(r,rp.world.offset,{x:event?.clientX??h.input.mouse.x,y:event?.clientY??h.input.mouse.y},true);},
      handleMouse(event,type){
        if(event.button!==2)return false;
        if(type==='mouseup'&&consumed){consumed=false;held=false;marker.hidden=true;return true;}
        if(type!=='mousedown'||r.rs._4020||!m.multi||!m.mouseSpawn||event.target?.closest?.('input,textarea,select,button,dialog,[contenteditable="true"],#senpa-tabs'))return false;
        consumed=m.setSpawnTarget(aim.mouseWorld(event));held=consumed;aim.frame();return consumed;
      },
      frame(){
        const point=m.intent?.requestedAnchor||m.spawnTarget;
        const visible=!!(held&&m.multi&&m.mouseSpawn&&point&&!m.intent?.sent&&m.slots().some(slot=>!m.alive(slot))&&!r.rs._4020&&(!point.endpoint||point.endpoint===h.network.url));
        const screen=visible?rp.modules.spawnProjection(r,rp.world.offset,point):null;
        marker.hidden=!screen;
        if(screen){
          marker.style.left=screen.x+'px';marker.style.top=screen.y+'px';
          const rect=r.X_._4894.getBoundingClientRect();
          marker.style.width=Math.max(10,500*r.z_._4336*rect.width/r.X_._3473)+'px';
          marker.style.height=Math.max(10,500*r.z_._4336*rect.height/r.X_._3195)+'px';
        }
      }
    };
    // Hold-to-preview: the selected world point remains usable after release.
    rp.on(document,'mousemove',event=>{
      if(!held)return;
      if((event.buttons&2)===0){held=false;marker.hidden=true;return;}
      if(r.rs._4020||!m.multi||!m.mouseSpawn){held=false;marker.hidden=true;return;}
      if(!m.intent)m.setSpawnTarget(aim.mouseWorld(event));
      aim.frame();
    });
    rp.on(window,'blur',()=>{held=false;consumed=false;marker.hidden=true;});
    const after=rp.afterFrame;rp.afterFrame=now=>{after?.(now);aim.frame();};
  };
})();
