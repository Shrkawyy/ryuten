

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