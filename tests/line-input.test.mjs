import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/app/line-split.js',import.meta.url),'utf8');
function setup({multi=false, width=2, active=0}={}) {
 let now=0,id=0;const timers=new Map(),events=[],listeners=new Map(),store=new Map(),notifications=[];
 const on=(kind,fn)=>{const list=listeners.get(kind)||[];list.push(fn);listeners.set(kind,list);};
 const off=(kind,fn)=>listeners.set(kind,(listeners.get(kind)||[]).filter(x=>x!==fn));
 const setTimeout=(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},clearTimeout=id=>timers.delete(id);
 const tick=(ms)=>{const end=now+ms;let safety=0;for(;;){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++safety>10000)throw Error('timer loop');now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
 const hosts=[];
 function host(name){
  const c={id:1,x:1000,y:2000,radius:500,endX:3000,endY:4000,endRadius:500,updateTime:0,removed:false};
  const h={name,world:{myCells:[new Map([[1,c]]),new Map([[2,{...c,id:2,endX:6000,endY:7000}]])],myPlayerIDs:[100,101]},
   network:{connected:true,ws:{name},latency:40,isReplay:false},player:{activeTab:0,isStopped:false},
   renderer:{canvas:{width:1440,height:900}},camera:{x:1000,y:2000,zoom:.5},input:{mouse:{x:820,y:550}},
   menu:{isOpen:false,isChatFocused:false},packets:{handshakeDone:true},actions:{},parser:{handlers:{20:()=>{}}}};
  h.packets.cursor=(x,y,native=h.player.activeTab)=>events.push({type:'aim',host:name,x:Math.trunc(x),y:Math.trunc(y),native,at:now});
  h.packets.split=(native,count)=>events.push({type:'split',host:name,native,count,at:now});
  h.actions.split=()=>h.packets.split(h.player.activeTab,1);
  hosts.push(h);return h;
 }
 const h=host('primary'),aux=host('aux');
 const m={multi,active,generation:1,lastCursor:[],host(slot=this.active){return slot>=width?aux:h;},
  nativeSlot:s=>s%width,slots:()=>Array.from({length:width*2},(_,i)=>i),releaseFeed(){events.push({type:'release-feed'});}};
 h.actions.sendMouse=()=>{
  events.push({type:'normal-scheduler'});
  if(m.multi){for(const s of m.slots()){const host=m.host(s);if(!host.player.isStopped)host.packets.cursor(9000+s,8000+s,m.nativeSlot(s));}}
  else if(!h.player.isStopped)h.packets.cursor(9000,8000,h.player.activeTab);
 };
 const r={Q:{},rs:{_4020:false}};
 const rp={modules:{},parentPort:{mode:'ryuten',multibox:m,notify:s=>notifications.push(s)},
  setting:(k,v)=>store.has(k)?store.get(k):v,saveSetting:(k,v)=>store.set(k,v),
  motion:{frameNow:0,inputCamera:()=>h.camera,sample:c=>({x:c.x,y:c.y})},feedTiming:{release:()=>events.push({type:'feed-stop'})}};
 const document={hidden:false,activeElement:null,addEventListener:on,removeEventListener:off};
 const window={RYUTEN_PORT:rp,parent:{innerWidth:1440,performance:{now:()=>now}},innerWidth:1440,
  setTimeout,clearTimeout,performance:{now:()=>now},addEventListener:on,removeEventListener:off};
 vm.runInNewContext(source,{window,document,performance:window.performance,console});
 const api=rp.modules.installLineSplit(h,r,{now:()=>now,setTimeout,clearTimeout});
 return {api,h,aux,m,r,rp,document,events,store,notifications,timers,tick,hosts,
  cell:h.world.myCells[0].get(1),emit:k=>(listeners.get(k)||[]).slice().forEach(f=>f({target:document.activeElement})),
  stall(ms){now+=ms;const callbacks=[...timers.values()];timers.clear();callbacks.forEach(v=>v.fn());},
  splits:()=>events.filter(e=>e.type==='split'),aims:()=>events.filter(e=>e.type==='aim'),
  worldFrame(host=h){host.parser.handlers[20]();},
  freshTick(ms,host=h){for(let step=0;step<ms;step+=20){tick(Math.min(20,ms-step));host.parser.handlers[20]();}}};
}
const j=v=>JSON.parse(JSON.stringify(v));
test('defaults are four stages and separate requests, never inherited six',()=>{const f=setup();assert.equal(f.api.options().splitCount,4);assert.equal(f.api.trigger(),true);f.freshTick(700);assert.deepEqual(f.splits().map(x=>x.count),[1,1,1,1]);assert.equal(f.api.lastResult.status,'sent');assert.equal(f.api.lastResult.lineShapeVerified,false);});
test('centering uses endX/endY, not native animated x/y',()=>{const f=setup();f.api.trigger();assert.equal(f.aims()[0].x,3000);assert.equal(f.aims()[0].y,4000);});
test('default waits then each split has an immediately preceding pinned aim',()=>{const f=setup();f.api.trigger();f.freshTick(160);f.tick(19);assert.equal(f.splits().length,0);f.freshTick(400);for(let i=0;i<f.events.length;i++){const e=f.events[i];if(e.type==='split'){const a=f.events[i-1];assert.equal(a.type,'aim');assert.equal(a.native,e.native);assert.equal(a.x,3006);assert.equal(a.y,4006);}}assert.deepEqual(f.splits().map(x=>x.at),[180,205,230,255]);});
test('arbitrary mouse diagonals retain every quadrant',()=>{for(const[x,y]of[[50,120],[50,-120],[-50,120],[-50,-120]]){const f=setup();f.h.input.mouse={x:720+x,y:450+y};f.api.trigger({settleMs:0});const a=f.aims().at(-1);assert.equal(Math.sign(a.x-3000),Math.sign(x));assert.equal(Math.sign(a.y-4000),Math.sign(y));assert(Math.abs((a.x-3000)/(a.y-4000)-x/y)<.15);}});
test('Exact center preset sends four singles at zero offset',()=>{const f=setup();f.api.trigger({mode:'Exact center rapid',settleMs:0});f.tick(500);assert.equal(f.splits().length,4);assert(f.aims().slice(0,-1).every(a=>a.x===3000&&a.y===4000));});
test('Native burst sends one count=4, not four burst packets',()=>{const f=setup();f.api.trigger({mode:'Native burst',settleMs:0});f.tick(500);assert.deepEqual(f.splits().map(x=>x.count),[4]);});
test('Endy rapid pins a far target and sends four singles',()=>{const f=setup();f.api.trigger({mode:'Endy rapid'});f.tick(500);const before=f.events.findIndex(e=>e.type==='split');assert(f.events[before-1].x>1_000_000);assert.equal(f.splits().length,4);});
test('all eight Endy locks send aim only and toggle off with the same direction',()=>{const f=setup();for(const[d,[dx,dy]]of Object.entries(f.rp.modules.lineInput.DIRECTIONS)){assert(f.api.toggleLock(d));const lock=f.api.snapshot().locks[0];assert.equal(Math.sign(lock.point.x-3000),Math.sign(dx));assert.equal(Math.sign(lock.point.y-4000),Math.sign(dy));f.tick(2000);assert.equal(f.splits().length,0);assert(f.api.toggleLock(d));assert.equal(f.api.locks.size,0);}assert.equal(f.timers.size,0);});
test('selected Endy lock preset is a toggle, not an automatic split',()=>{const f=setup();f.api.trigger({mode:'Endy lock'});assert.equal(f.api.locks.size,1);assert.equal(f.splits().length,0);f.api.trigger({mode:'Endy lock'});assert.equal(f.api.locks.size,0);});
test('aim is latched through splits and hold despite changing mouse/camera',()=>{const f=setup();f.api.trigger({settleMs:0});const point={...f.api.operation.point};f.h.input.mouse.x=-90000;f.h.camera.x=90000;f.h.actions.sendMouse();assert.equal(f.aims().at(-1).x,point.x);f.tick(80);f.h.actions.sendMouse();assert.equal(f.aims().at(-1).x,point.x);f.tick(250);assert.equal(f.api.operation,null);assert.equal(f.aims().at(-1).x,9000);});
test('center target is fixed while received cell moves, then splits only after returning and settling',()=>{
 const f=setup();f.api.trigger();f.cell.endX=3333;f.cell.updateTime=20;f.freshTick(100);
 assert.equal(f.aims().at(-1).x,3000);assert.equal(f.splits().length,0);
 f.cell.endX=3000;f.cell.updateTime=120;f.freshTick(700);
 assert.equal(f.splits().length,4);assert(f.api.lastResult.freshSnapshots>0);assert(f.api.lastResult.centerConfirmed);
});
test('a continuously moving center times out without splitting',()=>{const f=setup();f.api.trigger();for(let i=0;i<110;i++){f.cell.endX+=10;f.cell.updateTime+=20;f.freshTick(20);}assert.equal(f.splits().length,0);assert.equal(f.api.lastResult.status,'cancelled');assert.match(f.api.lastResult.reason,/did not settle/);assert.equal(f.timers.size,0);});
test('timer stall cancels remaining pulses instead of catch-up burst',()=>{const f=setup();f.api.trigger({settleMs:0});assert.equal(f.splits().length,1);f.stall(1000);assert.equal(f.splits().length,1);assert.equal(f.api.operation,null);assert.match(f.api.lastResult.reason,/stalled/);});
test('switch during preparation cancels; it never splits newly selected player',()=>{const f=setup({multi:true});f.api.trigger();f.m.active=1;f.tick(500);assert.equal(f.splits().length,0);assert.equal(f.api.lastResult.status,'cancelled');});
test('explicit switch cancellation stops pending train after first pulse',()=>{const f=setup({multi:true});f.api.trigger({settleMs:0});f.api.cancel('switch');f.m.active=1;f.tick(500);assert.equal(f.splits().length,1);});
test('WindBine logical P4 routes to auxiliary native slot 1',()=>{const f=setup({multi:true,active:3});f.api.trigger({settleMs:0});f.tick(500);assert(f.splits().every(e=>e.host==='aux'&&e.native===1));assert.equal(f.splits().length,4);});
test('FFA logical P2 routes to auxiliary native slot 0',()=>{const f=setup({multi:true,width:1,active:1});f.api.trigger({settleMs:0});f.tick(500);assert(f.splits().every(e=>e.host==='aux'&&e.native===0));});
test('independent direction locks survive switch but not blur',()=>{const f=setup({multi:true});f.api.toggleLock('Up');f.api.cancel('switch');f.m.active=2;f.api.toggleLock('BottomRight');assert.equal(f.api.locks.size,2);f.h.actions.sendMouse();const recent=f.aims().slice(-4);assert(recent.some(e=>e.host==='primary'&&e.native===0&&e.y<0));assert(recent.some(e=>e.host==='aux'&&e.native===0&&e.y>1e6));f.emit('blur');assert.equal(f.api.locks.size,0);});
test('non-locked native slots retain original scheduler targets',()=>{const f=setup({multi:true});f.api.toggleLock('Up');f.events.length=0;f.h.actions.sendMouse();assert.deepEqual(f.aims().filter(e=>!(e.host==='primary'&&e.native===0)).map(e=>[e.x,e.y]),[[9001,8001],[9002,8002],[9003,8003]]);});
test('locked direction does not prevent manual native splitting',()=>{const f=setup();f.api.toggleLock('TopLeft');f.h.actions.sendMouse();f.h.actions.split();assert.equal(f.splits().length,1);assert.equal(f.api.locks.size,1);});
test('manual split aborts the pending automatic train',()=>{const f=setup();f.api.trigger({settleMs:0});f.h.actions.split();f.tick(500);assert.equal(f.splits().length,2);assert.equal(f.api.operation,null);assert.equal(f.aims().at(-1).x,9000);});
test('chat/menu/replay/hidden focus each blocks the macro',()=>{for(const name of ['chat','menu','replay','hidden','editable']){const f=setup();if(name==='chat')f.h.menu.isChatFocused=true;if(name==='menu')f.r.rs._4020=true;if(name==='replay')f.h.network.isReplay=true;if(name==='hidden')f.document.hidden=true;if(name==='editable')f.document.activeElement={isContentEditable:true};assert.equal(f.api.trigger(),false,name);assert.equal(f.splits().length,0,name);}});
test('opening chat mid-train cancels remaining pulses',()=>{const f=setup();f.api.trigger({settleMs:0});f.h.menu.isChatFocused=true;f.tick(500);assert.equal(f.splits().length,1);assert.equal(f.api.operation,null);});
test('socket replacement or connection generation change invalidates work',()=>{for(const change of[f=>{f.h.network.ws={};},f=>{f.m.generation++;},f=>{f.h.world.myPlayerIDs[0]=999;}]){const f=setup();f.api.trigger();change(f);f.tick(700);assert.equal(f.splits().length,0);assert.equal(f.api.operation,null);}});
test('death / removed cells release the lock',()=>{const f=setup();f.api.toggleLock('Up');f.cell.removed=true;f.h.actions.sendMouse();assert.equal(f.api.locks.size,0);});
test('native Stop remains unchanged but pinned aim is still sent',()=>{const f=setup();f.h.player.isStopped=true;f.api.toggleLock('Up');f.events.length=0;f.h.actions.sendMouse();assert.equal(f.aims().length,1);assert(f.aims()[0].y<0);assert.equal(f.h.player.isStopped,true);});
test('blank cells, NaN received positions and invalid viewport reject cleanly',()=>{for(const edit of[f=>f.h.world.myCells[0].clear(),f=>f.cell.endX=NaN,f=>f.h.camera.zoom=0]){const f=setup();edit(f);assert.equal(f.api.trigger(),false);assert.equal(f.timers.size,0);}});
test('centered mouse defaults to a right nudge; Exact center remains zero',()=>{const f=setup();f.h.input.mouse={x:720,y:450};f.api.trigger({settleMs:0});assert.equal(f.api.operation.vector.fallback,true);assert.equal(f.api.operation.point.x,3008);f.api.cancel();f.api.trigger({mode:'Exact center rapid',settleMs:0});assert.equal(f.api.operation.point.x,3000);});
test('direction uses visible pose but transplant aims at received pose in XPLUS',()=>{const f=setup();f.rp.motion.sample=()=>({x:-1000,y:-2000});f.h.camera={x:-1000,y:-2000,zoom:.5};f.api.trigger({settleMs:0});assert.equal(f.api.operation.point.x,3006);assert.equal(f.api.operation.point.y,4006);});
test('high DPI projection keeps same intended direction',()=>{const f=setup();f.h.renderer.canvas.width=2880;f.h.renderer.canvas.height=1800;f.api.trigger({settleMs:0});assert.equal(f.api.operation.point.x,3006);assert.equal(f.api.operation.point.y,4006);});
test('negative positions and near representable limits stay finite Int32 without wrap',()=>{const f=setup();const point=f.rp.modules.lineInput.aimPoint({x:999_999_995,y:-999_999_998},{x:Math.SQRT1_2,y:-Math.SQRT1_2},10_000_000);assert(point.x<=1e9&&point.y>=-1e9);assert.equal(point.x|0,point.x);assert.equal(point.y|0,point.y);});
test('maximum six stages and all timing values are bounded',()=>{const f=setup();const c=f.rp.modules.lineInput.config({splitCount:999,gapMs:999,settleMs:-1,holdMs:999,offset:999});assert.deepEqual(j(c),{mode:'Centered rapid',direction:'Mouse',splitCount:6,gapMs:120,settleMs:0,holdMs:800,offset:64});});
test('held repeat / overlapping trigger cannot queue additional trains',()=>{const f=setup();f.api.trigger({settleMs:0});assert.equal(f.api.trigger(),false);f.tick(500);assert.equal(f.splits().length,4);});
test('the second configurable hotkey slot works too',()=>{const f=setup();f.r.Q.HK_LINE_LOCK_TOPRIGHT={_5997:()=>['NONE','F9']};assert.equal(f.api.handleKey('F9'),true);assert.equal(f.api.locks.get(0).directionName,'TopRight');assert.equal(f.api.handleKey('F8'),false);});
test('settings keep existing line key and default four stages; directional keys start unbound',()=>{const f=setup();class S{constructor(o){this.options=o;this.v=o._8328;this.events={};} _5997(){return this.v;} _4935(k,fn){(this.events[k]??=[]).push(fn);} _7531(v){this.v=v;for(const fn of this.events.change||[])fn(v);}}
 f.store.set('line-split-key',['F6','NONE']);Object.assign(f.r,{M:S,L:S,T:S});f.rp.modules.installLineSettings(f.r,(k,s)=>f.r.Q[k]=s);
 assert.deepEqual(j(f.r.Q.HK_LINE_SPLIT._5997()),['F6','NONE']);assert.equal(f.r.Q.LINE_SPLIT_COUNT._5997(),4);assert.deepEqual(j(f.r.Q.HK_LINE_LOCK_TOPLEFT._5997()),['NONE','NONE']);assert.equal(f.r.Q.LINE_SPLIT_MODE.options._5331.length,5);
 f.r.Q.LINE_SPLIT_COUNT._7531(3);assert.equal(f.store.get('line-split-count'),3);
});
test('no native pose, camera, player slot or mass is rewritten',()=>{const f=setup();const before=JSON.stringify({cell:f.cell,camera:f.h.camera,player:f.h.player});f.api.trigger({settleMs:0});f.tick(500);assert.equal(JSON.stringify({cell:f.cell,camera:f.h.camera,player:f.h.player}),before);});
test('dispose restores packet and scheduler functions and removes timers',()=>{const f=setup();f.api.trigger({settleMs:0});f.api.dispose();f.tick(500);assert.equal(f.timers.size,0);assert.equal(f.splits().length,1);assert.equal(f.h.actions.sendMouse,f.api.originalSend);assert.equal(f.api.hooks.size,0);assert.equal(f.api.trigger(),false);});
test('line hotkeys use Ryuten spellings and combined modifiers, not narrower Senpa keys',()=>{const f=setup();f.r.Q.HK_LINE_LOCK_UP={_5997:()=>['CTRL+ALT+DELETE','NONE']};assert(f.api.handleKeyboard({code:'Delete',ctrlKey:true,altKey:true}));assert.equal(f.api.locks.get(0).directionName,'Up');assert(!f.api.handleKeyboard({code:'Delete',ctrlKey:true,altKey:true,repeat:true}));});
test('mouse binding uses the editor second slot without moving the real mouse',()=>{const f=setup();f.r.Q.HK_LINE_LOCK_LEFT={_5997:()=>['NONE','MIDDLE BTN']};assert(f.api.handleMouse({button:1}));assert.equal(f.api.locks.get(0).directionName,'Left');});
test('unused auxiliary wrappers are restored on release instead of retaining old realms',()=>{const f=setup({multi:true,active:2});const original=f.aux.packets.cursor;f.api.toggleLock('Up');assert.notEqual(f.aux.packets.cursor,original);f.api.toggleLock('Up');assert.equal(f.aux.packets.cursor,original);assert.equal(f.api.hooks.size,1);});

test('native aim exception cancels immediately without a stuck operation or timer',()=>{const f=setup();f.h.packets.cursor=()=>{throw Error('fixture aim failure');};assert.equal(f.api.trigger(),false);assert.equal(f.api.operation,null);assert.equal(f.timers.size,0);assert.match(f.api.lastResult.reason,/aim failure/);});
test('native split exception is reported and leaves no queued split requests',()=>{const f=setup();f.h.packets.split=()=>{throw Error('fixture split failure');};assert.equal(f.api.trigger({settleMs:0}),false);f.tick(700);assert.equal(f.splits().length,0);assert.equal(f.timers.size,0);assert.match(f.api.lastResult.reason,/split failure/);});
test('auxiliary lock send failure restores the original native writer',()=>{const f=setup({multi:true,active:2});const broken=()=>{throw Error('fixture lock failure');};f.aux.packets.cursor=broken;assert.equal(f.api.toggleLock('Right'),false);assert.equal(f.api.locks.size,0);assert.equal(f.aux.packets.cursor,broken);assert.equal(f.api.hooks.size,1);});
test('cursor failure during centering cannot schedule another settle callback',()=>{const f=setup();f.api.trigger();f.h.packets.cursor=()=>{throw Error('fixture delayed aim failure');};f.tick(700);assert.equal(f.api.operation,null);assert.equal(f.timers.size,0);assert.equal(f.splits().length,0);});


test('old static snapshots cannot certify that the server stopped the cell',()=>{
 const f=setup();f.api.trigger();f.tick(2400);
 assert.equal(f.splits().length,0);assert.equal(f.api.operation,null);
 assert.equal(f.api.lastResult.freshSnapshots,0);assert.match(f.api.lastResult.reason,/No fresh/);
});
test('render calls and updateTime changes alone do not count as world frames',()=>{
 const f=setup();f.api.trigger();for(let i=0;i<110;i++){f.cell.updateTime++;f.h.actions.sendMouse();f.tick(20);}
 assert.equal(f.splits().length,0);assert.equal(f.api.lastResult.freshSnapshots,0);
});
test('one world frame then silence cannot pass the fresh quiet-window gate',()=>{
 const f=setup();f.api.trigger();f.worldFrame();f.tick(2400);assert.equal(f.splits().length,0);
});
test('three batched frames in one instant cannot pretend to span an 80 ms quiet window',()=>{
 const f=setup();f.api.trigger();f.worldFrame();f.worldFrame();f.worldFrame();f.tick(2400);
 assert.equal(f.splits().length,0);assert.equal(f.api.lastResult.freshSnapshots,3);
});
test('slow one-unit packet drift cannot pass by comparing adjacent tiny steps',()=>{
 const f=setup();f.api.trigger();for(let i=0;i<110;i++){f.cell.endX+=1;f.freshTick(20);}
 assert.equal(f.splits().length,0);assert.equal(f.api.lastResult.status,'cancelled');
});
test('quiet mean of opposite-moving fragments is not an eligible center',()=>{
 const f=setup();f.h.world.myCells[0].set(2,{...f.cell,id:2,endX:3400});
 assert.equal(f.api.trigger(),false);assert.equal(f.splits().length,0);assert.match(f.api.lastResult.reason,/one merged cell/);
});
test('a malformed native world handler cannot mark a sample as fresh',()=>{
 const f=setup();f.api.dispose();f.h.parser.handlers[20]=()=>{throw RangeError('truncated world');};
 const api=f.rp.modules.installLineSplit(f.h,f.r,{now:()=>0});api.trigger();
 assert.throws(()=>f.h.parser.handlers[20](),/truncated/);assert.equal(api.operation.freshSnapshots,0);api.dispose();
});
test('fresh world evidence must come from the active auxiliary route in FFA',()=>{
 const f=setup({multi:true,width:1,active:1});f.api.trigger();f.freshTick(300,f.h);assert.equal(f.splits().length,0);
 f.freshTick(650,f.aux);assert.equal(f.splits().length,4);assert(f.splits().every(x=>x.host==='aux'&&x.native===0));
});
test('world observer is removed on disposal and restores the original handler',()=>{
 const f=setup();const original=f.api.hooks.get(f.h).world;f.api.dispose();assert.equal(f.h.parser.handlers[20],original);
});
test('lock remains fixed across incoming movement, native scheduler sends, and camera changes',()=>{
 const f=setup();f.api.trigger({settleMs:0});const point={...f.api.operation.point};
 for(let i=0;i<4;i++){f.cell.endX+=15;f.cell.endY-=20;f.worldFrame();f.h.camera.x+=100;f.h.input.mouse.y=-99999;f.h.actions.sendMouse();f.tick(25);}
 const beforeSplits=f.events.filter((e,i)=>f.events[i+1]?.type==='split');assert.equal(beforeSplits.length,4);
 assert(beforeSplits.every(e=>e.x===point.x&&e.y===point.y));f.tick(400);
});
test('socket backpressure cancels unsent requests rather than queuing a burst',()=>{
 const f=setup();f.api.trigger({settleMs:0});f.h.network.ws.bufferedAmount=70000;f.tick(500);
 assert.equal(f.splits().length,1);assert.match(f.api.lastResult.reason,/congested/);
});
test('diagnostic spread distinguishes collinear, off-axis, and scattered received positions',()=>{
 const f=setup(),g=f.rp.modules.lineInput.geometry;
 const c=points=>({x:0,y:0,count:points.length,samples:points.map(([x,y])=>({x,y}))});
 const line=c([[-30,0],[-10,0],[10,0],[30,0]]),square=c([[-10,-10],[10,-10],[-10,10],[10,10]]);
 assert.equal(g(line,{x:1,y:0}).crossAxisRatio,0);assert.equal(g(line,{x:1,y:0}).principalWidthRatio,0);
 assert(g(square,{x:1,y:0}).crossAxisRatio>0);assert.equal(g(square,{x:1,y:0}).principalWidthRatio,1);
 assert.equal(g(c([[0,0],[0,0]]),{x:1,y:0}).enoughPoints,false);
});
test('report records received own positions, not names or credentials, and does not claim success',()=>{
 const f=setup();let saved;f.rp.download=(name,data)=>{saved={name,data:JSON.parse(data)};};
 f.api.trigger({settleMs:0});f.freshTick(500);assert(f.api.downloadLastAttempt());
 assert.equal(saved.data.lastResult.lineShapeVerified,false);assert.equal(saved.data.lastResult.serverAcceptedCountKnown,false);
 assert(saved.data.lastResult.observationWindow.length>0);assert(saved.data.lastResult.observationWindow.length<=48);
 assert(!JSON.stringify(saved.data).includes('password'));assert(!JSON.stringify(saved.data).includes('skinURL'));
});
