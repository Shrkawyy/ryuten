

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