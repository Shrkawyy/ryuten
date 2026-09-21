"""Actual distributed loader + native Senpa parser/writers. No real game server or GPU submission.
The fixture checks the bytes produced by unchanged native packet writers, not line-shaped physics.
"""
import asyncio, importlib.util, json, pathlib
from playwright.async_api import async_playwright
from browser_path import chromium_path
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('smoke',ROOT/'tests/browser-smoke.py');smoke=importlib.util.module_from_spec(spec);spec.loader.exec_module(smoke)
PREP=r'''()=>{
 const {h,rp,r,port,world,advance}=FIXTURE;FIXTURE.connect();port.onFrame=null;
 port.multibox.ffaAutoConnect=false;port.multibox.setEnabled(false);
 world([{id:500,x:6000,y:7000,radius:600,parent:100},{id:501,x:8000,y:9000,radius:400,parent:101}]);advance();rp.hideMenu();
 let time=0,id=0;const timers=new Map();
 rp.lineSplit.dispose();
 const api=rp.modules.installLineSplit(h,r,{now:()=>time,setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:time+delay});return id;},clearTimeout:id=>timers.delete(id)});
 const clock={tick(ms){const end=time+ms;let limit=0;for(;;){const q=[...timers].filter(([,x])=>x.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!q)break;if(++limit>10000)throw Error('timer leak');time=q[1].at;timers.delete(q[0]);q[1].fn();}time=end;},timers};
 const decode=bytes=>{
   if(bytes[0]===22)return {op:22,slot:bytes[1],count:bytes[2],bytes};
   if(bytes[0]===20&&bytes.length===11){const dv=new DataView(Uint8Array.from(bytes).buffer);return {op:20,slot:bytes[2],x:dv.getInt32(3,true),y:dv.getInt32(7,true),bytes};}
   return {op:bytes[0],bytes};
 };
 const mouse=(dx=1,dy=1)=>{const m=port.multibox,slot=m.multi?m.active:h.player.activeTab,host=m.multi?m.host(slot):h,native=m.multi?m.nativeSlot(slot):slot;
   const cells=[...host.world.myCells[native].values()].filter(c=>!c.removed),v=rp.motion.inputCamera(),scale=h.renderer.canvas.width/innerWidth;
   const p=cells.map(c=>rp.motion.sample(c,rp.motion.frameNow));const x=p.reduce((s,p)=>s+p.x,0)/p.length,y=p.reduce((s,p)=>s+p.y,0)/p.length;
   h.input.mouse.x=h.renderer.canvas.width/(2*scale)+(x-v.x+dx*200)*v.zoom;
   h.input.mouse.y=h.renderer.canvas.height/(2*scale)+(y-v.y+dy*200)*v.zoom;
 };
 const reset=(style='Senpa')=>{api.cancel('test-reset');rp.hideMenu();port.frame.contentDocument.activeElement?.blur();
   h.menu.isChatFocused=false;h.player.isStopped=false;h.player.activeTab=0;h.network.isReplay=false;
   r.Q.PRESENTATION_STYLE._7531(style);h.camera.x=6000;h.camera.y=7000;h.camera.zoom=.5;rp.motion.ultraView=null;
   mouse();FIXTURE.sent.length=0;
 };
 window.LINE={api,clock,decode,mouse,reset,freshTick(ms){for(let step=0;step<ms;step+=40){clock.tick(Math.min(40,ms-step));world();}},packets:()=>FIXTURE.sent.map(decode).filter(p=>p.op===20||p.op===22)};
 reset();return {nativeCell:typeof h.Cell,defaults:api.options(),nativeSplit: h.actions.split16.toString()};
}'''
async def main():
 results=[];errors=[]
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=chromium_path(),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page(viewport={'width':1440,'height':1000})
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def route(q):
   if q.request.url.startswith('https://api.senpa.io/tracker'):await q.fulfill(body=(ROOT/'references/tracker.json').read_text(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
   else:await q.abort()
  await page.route('**/*',route);await page.set_content('<!doctype html><html><body></body></html>');await page.evaluate('('+smoke.HOOK+')()')
  await page.evaluate((ROOT/'dist/RYUTEN-Senpa.user.js').read_text());await page.wait_for_function('SENPA_PORT.ready||SENPA_PORT.error',timeout=30000)
  if not await page.evaluate('SENPA_PORT.ready'):raise RuntimeError(await page.evaluate('SENPA_PORT.error'))
  await page.evaluate((ROOT/'tests/browser-fixtures.js').read_text());print(await page.evaluate(PREP),flush=True)
  async def check(name,code):
   try:
    detail=await page.evaluate('async()=>{const {h,port,rp,r,world,advance,assert,Writer}=FIXTURE;const {api,clock,decode,mouse,reset,packets}=LINE;'+code+'}');results.append({'case':name,'pass':True,'detail':detail});print('PASS',name,detail,flush=True)
   except Exception as e:results.append({'case':name,'pass':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
  await check('default quad emits four real native [22,slot,1] packets, each preceded by integer aim',r'''
    reset();assert(api.trigger(),'did not arm');LINE.freshTick(700);const p=packets(),splits=p.filter(x=>x.op===22);
    assert(splits.length===4,'Wrong packet count: '+JSON.stringify(p));assert(splits.every(s=>s.count===1&&s.slot===0),'Wrong native split count');
    for(let i=0;i<p.length;i++)if(p[i].op===22){assert(p[i-1].op===20,'Missing preceding aim');assert(p[i-1].x===6006&&p[i-1].y===7006,'Wrong diagonal/int conversion');}
    assert(api.lastResult.status==='sent','did not finish');return {splits:splits.map(s=>s.bytes),aim:p.find(x=>x.op===20),result:api.lastResult};
  ''')
  await check('native world silence never passes default centering',r'''
    reset();api.trigger();clock.tick(2400);assert(!packets().some(p=>p.op===22),'Split on stale data');
    assert(api.lastResult.freshSnapshots===0,'Invented server updates');return api.lastResult;
  ''')
  await check('native received position moves while the sent stopping target remains fixed',r'''
    reset();api.trigger();world([], [{id:500,x:6030,y:7040,radius:600}]);LINE.freshTick(240);
    assert(!packets().some(p=>p.op===22),'Split while not at center');h.input.mouse.x=-9999;h.camera.x=4000;h.actions.sendMouse();
    assert(packets().at(-1).x===6000&&packets().at(-1).y===7000,'Stop point followed cell/camera');
    world([], [{id:500,x:6000,y:7000,radius:600}]);LINE.freshTick(600);
    assert(packets().filter(p=>p.op===22).length===4,'No quad after actual fresh quiet window');return api.lastResult;
  ''')
  await check('different own fragments are rejected instead of treating their mean as one cell core',r'''
    reset();world([{id:502,x:6020,y:7000,radius:600,parent:100}]);assert(!api.trigger(),'Armed over multiple fragments');
    assert(!packets().some(p=>p.op===22),'Unexpected split');const reason=api.lastResult.reason;world([],[],[502]);return {reason};
  ''')
  await check('clickable attempt badge exports own-position report without gameplay clicks',r'''
    reset();api.trigger();LINE.freshTick(700);const doc=port.frame.contentDocument,badge=doc.getElementById('senpa-line-input-status');
    assert(!badge.hidden,'No report affordance');let exported=null;const old=rp.download;
    rp.download=(filename,data)=>{exported={filename,data:JSON.parse(data)};};
    try{badge.dispatchEvent(new port.frame.contentWindow.MouseEvent('click',{bubbles:true}));}finally{rp.download=old;}
    assert(exported?.data.lastResult.lineShapeVerified===false,'Missing truthful report');
    assert(exported.data.lastResult.centerConfirmed,'Fresh native delta frames not recorded');
    assert(exported.data.lastResult.observationWindow.length>0,'No samples');return {file:exported.filename,frames:exported.data.lastResult.observationWindow.length};
  ''')
  await check('Native burst emits [22,0,4] once; Exact center stays at the actual cell core',r'''
    reset();api.trigger({mode:'Native burst',settleMs:0});clock.tick(500);assert(JSON.stringify(packets().filter(x=>x.op===22).map(x=>x.bytes))==='[[22,0,4]]','Burst wrong');
    reset();api.trigger({mode:'Exact center rapid',settleMs:0});clock.tick(500);const p=packets();for(let i=0;i<p.length;i++)if(p[i].op===22)assert(p[i-1].x===6000&&p[i-1].y===7000,'Not centered');return {nativeBurst:[22,0,4],exactCenter:[6000,7000]};
  ''')
  await check('received target vs native animated pose uses endX/endY; no physics rewrite',r'''
    reset();world([], [{id:500,x:6400,y:7350,radius:600}]);const cell=h.world.myCells[0].get(500);assert(cell.endX===6400&&cell.x!==cell.endX,'Fixture not interpolating');mouse();const before={endX:cell.endX,endY:cell.endY,r:cell.endRadius};FIXTURE.sent.length=0;
    api.trigger({settleMs:0});assert(packets()[0].x===6400&&packets()[0].y===7350,'Wrong center');clock.tick(500);assert(cell.endX===before.endX&&cell.endY===before.endY&&cell.endRadius===before.r,'Rewrote physics');
    world([], [{id:500,x:6000,y:7000,radius:600}]);cell.animate(performance.now()+2000);return before;
  ''')
  await check('all 3 profiles support arbitrary pointer diagonals with native wire coordinates',r'''
    const report=[];
    for(const style of ['Senpa','Ryuten','XPLUS'])for(const[x,y]of [[1,2],[1,-2],[-1,2],[-1,-2]]){
      reset(style);mouse(x,y);api.trigger({settleMs:0});clock.tick(500);const p=packets(),i=p.findIndex(p=>p.op===22),a=p[i-1];
      assert(Math.sign(a.x-6000)===Math.sign(x)&&Math.sign(a.y-7000)===Math.sign(y),'Direction lost '+style+' '+x+','+y+' '+JSON.stringify(a));
      report.push({style,direction:[x,y],aim:[a.x,a.y]});
    }return report;
  ''')
  await check('eight Endy directional locks do not split and hold through ordinary native mouse sends',r'''
    reset();const out=[];
    for(const[d,v]of Object.entries(rp.modules.lineInput.DIRECTIONS)){
      FIXTURE.sent.length=0;api.toggleLock(d);const target=api.snapshot().locks[0].point;h.input.mouse.x=-100000;h.actions.sendMouse();clock.tick(5000);
      assert(!packets().some(p=>p.op===22),'Lock caused a split');const a=packets().at(-1);assert(a.x===target.x&&a.y===target.y,'Mouse overwrote lock');
      assert(Math.sign(a.x-6000)===Math.sign(v[0])&&Math.sign(a.y-7000)===Math.sign(v[1]),'Wrong Endy direction');out.push({direction:d,target});api.toggleLock(d);
    }assert(clock.timers.size===0,'Lock creates timer loop');return out;
  ''')
  await check('Endy rapid emits distant fixed aims and four native single splits',r'''
    reset();api.trigger({mode:'Endy rapid'});clock.tick(500);const p=packets(),s=p.filter(p=>p.op===22);assert(s.length===4&&s.every(x=>x.count===1),'Bad Endy rapid');
    for(let i=0;i<p.length;i++)if(p[i].op===22)assert(p[i-1].x>1e6&&p[i-1].y>1e6,'Target not distant');return {splitPackets:s.map(x=>x.bytes)};
  ''')
  await check('actual child keyboard dispatch triggers exactly one quad and ignores repeats',r'''
    reset();r.Q.HK_LINE_SPLIT._7531(['L','NONE']);const w=port.frame.contentWindow,doc=w.document;
    doc.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyL',key:'l',bubbles:true}));
    doc.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyL',key:'l',bubbles:true,repeat:true}));
    LINE.freshTick(700);doc.dispatchEvent(new w.KeyboardEvent('keyup',{code:'KeyL',key:'l',bubbles:true}));
    assert(packets().filter(p=>p.op===22).length===4,'Keyboard missed or duplicated split');r.Q.HK_LINE_SPLIT._7531(['NONE','NONE']);return {key:'L',splitPackets:4};
  ''')
  await check('Stored DELETE binding works although native Senpa key parser excludes it',r'''
    reset();r.Q.HK_LINE_LOCK_TOPRIGHT._7531(['DELETE','NONE']);const w=port.frame.contentWindow;
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Delete',key:'Delete',bubbles:true}));assert(api.locks.get(0)?.directionName==='TopRight','DELETE not routed');
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Delete',key:'Delete',bubbles:true}));assert(!api.locks.size,'DELETE toggle failed');return {supported:true};
  ''')
  await check('mouse binding is honored and ordinary split keys remain usable under a lock',r'''
    reset();r.Q.HK_LINE_LOCK_LEFT._7531(['NONE','MIDDLE BTN']);const w=port.frame.contentWindow;
    w.document.getElementById('main-canvas').dispatchEvent(new w.MouseEvent('mousedown',{button:1,bubbles:true}));assert(api.locks.get(0)?.directionName==='Left','Mouse lock binding not handled');
    h.actions.split16();assert(packets().filter(p=>p.op===22).at(-1).count===4,'Manual split broken');assert(api.locks.size===1,'Manual split lost lock');api.cancel('test');return {mouse:'MIDDLE BTN',manualNativeCount:4};
  ''')
  await check('typing into chat cannot start a bound macro; existing locks release on focus',r'''
    reset();r.Q.HK_LINE_SPLIT._7531(['L','NONE']);api.toggleLock('Up');const w=port.frame.contentWindow,input=w.document.createElement('input');w.document.body.append(input);input.focus();
    assert(api.locks.size===0,'Focus failed to release');FIXTURE.sent.length=0;input.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyL',key:'l',bubbles:true}));clock.tick(700);
    assert(!packets().some(p=>p.op===22),'Typing split');input.remove();rp.hideMenu();return {typingSafe:true};
  ''')
  await check('native Stop does not suppress the macro and is not rewritten',r'''
    reset();h.player.isStopped=true;api.trigger({settleMs:0});h.actions.sendMouse();clock.tick(500);assert(packets().filter(p=>p.op===22).length===4,'Stopped player failed');assert(h.player.isStopped===true,'Changed Stop setting');h.player.isStopped=false;return {stoppedPreserved:true};
  ''')
  await check('native P2 uses slot 1; switching aborts all queued remaining split requests',r'''
    reset();h.player.activeTab=1;mouse();api.trigger({settleMs:0});clock.tick(500);assert(packets().filter(p=>p.op===22).every(p=>p.slot===1),'P2 wrong slot');
    reset();api.trigger();port.selectNative(1);clock.tick(700);assert(!packets().some(p=>p.op===22),'Switch left queued splits');return {slot:1,switchCancelled:true};
  ''')
  await check('all requested prior features remain in the same artifact',r'''
    reset();assert(rp.shieldsEnabled&&Object.keys(r.pe._1763).length>=11,'Missing shields');rp.motion.useUltraPreset(2000);assert(rp.motion.delay===500,'XPLUS cap');
    assert(rp.modules.massLabels.createAtlas(),'Missing mass texture');assert(r.Q.FAST_FEED_TEST&&r.Q.FFA_AUTO_CONNECT,'Missing feed / FFA settings');
    assert(rp.modules.chatAppearance.contrastAgainstPanel(rp.chatNameColor('#000000'))>=4.5,'Chat dark names regressed');return {shields:Object.keys(r.pe._1763).length,xplusMax:500,version:port.version};
  ''')
  # Keep a real DOM screenshot of the new settings, not a synthetic game result.
  await check('Lines controls are registered in native Ryuten settings',r'''
    reset();rp.showMenu();const doc=port.frame.contentDocument;
    const b=[...doc.querySelectorAll('button,div,a')].find(x=>x.id==='main-menu-btn-settings'||x.id==='settings-button');
    const names=[...Object.entries(r.Q)].filter(([k])=>k.startsWith('LINE_SPLIT_')||k.startsWith('HK_LINE_')).map(([k,v])=>({key:k,label:v._8192,group:v._8592}));
    assert(names.length===17,'Missing settings: '+names.length);return names;
  ''')
  await check('real secondary native engine: WindBine P4 encodes auxiliary slot 1 only',r'''
    reset();port.test.prepareAux=(win)=>{win.WebSocket=window.WebSocket;Object.defineProperty(win,'sessionStorage',{configurable:true,value:{getItem:()=>null,setItem(){},removeItem(){}}});Object.defineProperty(win.document,'cookie',{configurable:true,get:()=>'',set(){}});};
    const m=port.multibox;m.windbineEnabled=true;h.network.url='eu1.senpa.io:7112';port.selected=h.network.url;
    assert(m.multi,'WindBine fixture not active');await m.ensureAux();assert(m.aux?.host,'No actual auxiliary native host: '+m.error);
    const init=(host,width,first,client,log)=>{
      host.network.ws={readyState:1,send:data=>log.push(Array.from(new Uint8Array(data))),close(){this.readyState=3;}};host.network.url=h.network.url;host.network.isReplay=false;
      // Native parser intentionally requires an ArrayBuffer from its own realm.
      const realm=host===h?window:m.aux.frame.contentWindow;const send=w=>host.parser.parse(realm.Uint8Array.from(w.b).buffer);
      const hello=new Writer(0).u32(16000).u16(client).u8(width);for(let i=0;i<width;i++)hello.u16(first+i);send(hello);send(new Writer(8));
      send(new Writer(10).u8(1).u16(client).u8(0).s16('Fixture').s16('Team').u8(255).u8(50).u8(20).u8(0).s16('').u8(0).u8(0));
      const players=new Writer(11).u8(width);for(let i=0;i<width;i++)players.u16(first+i).u16(client).u8(255).u8(50).u8(20).s8('').u32(0);send(players.u8(0).u8(0));
      const w=new Writer(20).u16(0).u16(width);for(let i=0;i<width;i++)w.u32(first*10+i).i32(6500+i*1000).i32(7000+i*1000).u16(600).u8(0).u16(first+i).u8(255).u8(50).u8(20);send(w.u16(0).u16(0));host.player.update();
    };
    LINE.initNative=init;const aux=m.aux.host,log=[];init(aux,2,200,141,log);assert(aux.packets.handshakeDone&&aux.world.myCells[1].size===1,'Auxiliary fixture parse failed');assert(m.select(3),'P4 selection failed');rp.hideMenu();mouse();log.length=0;FIXTURE.sent.length=0;
    assert(api.trigger(),'P4 did not arm');
    for(let ms=0;ms<700;ms+=40){clock.tick(40);const w=new Writer(20).u16(0).u16(0).u16(0).u16(0);aux.parser.parse(m.aux.frame.contentWindow.Uint8Array.from(w.b).buffer);}
    assert(api.lastResult.centerConfirmed,'P4 bypassed center confirmation');
    const encoded=log.map(decode).filter(p=>p.op===22);assert(encoded.length===4&&encoded.every(p=>p.slot===1&&p.count===1),'Wrong P4 route: '+JSON.stringify({encoded,all:log,primary:packets().filter(p=>p.op===22),state:api.snapshot(),active:m.active,route:api.route().slot,connected:aux.network.connected,alive:aux.player.isAlive,handshake:aux.packets.handshakeDone,menu:h.menu.isOpen,focus:h.menu.isChatFocused}));
    assert(!packets().some(p=>p.op===22),'Split leaked to primary');return {auxiliaryNativeCellConstructor:typeof aux.Cell,packets:encoded.map(x=>x.bytes),primarySplitCount:0};
  ''')
  await check('real secondary native engine: FFA P2 encodes auxiliary slot 0 only',r'''
    const m=port.multibox;api.cancel('test');m.destroyAux();m.ffaAutoConnect=false;m.ffaEnabled=true;h.network.url='eu1.senpa.io:7101';port.selected=h.network.url;
    LINE.initNative(h,1,100,41,FIXTURE.sent);assert(m.multi&&m.sourceSlotCount===1,'FFA fixture not active');await m.ensureAux();assert(m.aux?.host,'No FFA aux host: '+m.error);
    const aux=m.aux.host,log=[];LINE.initNative(aux,1,200,141,log);assert(aux.packets.handshakeDone&&aux.world.myCells[0].size===1,'FFA auxiliary fixture parse failed');assert(m.select(1),'FFA P2 selection failed');rp.hideMenu();h.menu.isChatFocused=false;mouse();log.length=0;FIXTURE.sent.length=0;
    assert(api.trigger(),'FFA P2 did not arm');
    for(let ms=0;ms<700;ms+=40){clock.tick(40);const w=new Writer(20).u16(0).u16(0).u16(0).u16(0);aux.parser.parse(m.aux.frame.contentWindow.Uint8Array.from(w.b).buffer);}
    assert(api.lastResult.centerConfirmed,'FFA bypassed center confirmation');const encoded=log.map(decode).filter(p=>p.op===22);
    assert(encoded.length===4&&encoded.every(p=>p.slot===0&&p.count===1),'Wrong FFA route: '+JSON.stringify({encoded,all:log,state:api.snapshot(),active:m.active,route:api.route().slot}));assert(!packets().some(p=>p.op===22),'Leaked primary split');
    api.cancel('test');m.destroyAux();return {packets:encoded.map(x=>x.bytes),primarySplitCount:0};
  ''')
  await check('actual Settings → Controls → Lines UI exposes all presets and edits a keyboard binding',r'''
    api.cancel('test');rp.showMenu();r.rs._6422(r.bt);rp.afterFrame(performance.now()+3000);
    const doc=port.frame.contentDocument,w=port.frame.contentWindow;
    for(let i=0;i<40;i++){r.o._5027();r.n._4541+=16;r.rs._4659();r.o._4067();}rp.afterFrame(performance.now()+4000);
    assert(w.getComputedStyle(doc.getElementById('settings-menu')).display!=='none','Settings panel is not shown');
    const selector=[...doc.querySelectorAll('#sm-category-selectors .sm-category-selector')].find(x=>x.textContent.trim()==='CONTROLS');assert(selector,'No Controls tab');selector.click();r.o._4067();
    const group=r.bt._4993.get('Controls')._1722.get('Lines');assert(group,'No Lines group');
    const row=group._2430.get('LINE_SPLIT_MODE')._3264();const choices=[...row.querySelectorAll('.sm-multi-choice__item')];
    assert(choices.length===5,'Wrong UI preset count');choices.find(x=>x.textContent==='NATIVE BURST').dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true}));
    assert(r.Q.LINE_SPLIT_MODE._5997()==='Native burst','Preset UI does not set setting');choices[0].dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true}));
    const bindRow=group._2430.get('HK_LINE_SPLIT')._3264(),keyBox=bindRow.querySelector('.sm-control-input-box');keyBox.focus();
    keyBox.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyL',key:'l',bubbles:true}));assert(r.Q.HK_LINE_SPLIT._5997()[0]==='L','Native hotkey editor failed');keyBox.blur();r.o._4067();
    group._8314._3264().scrollIntoView({block:'start'});assert(row.getBoundingClientRect().height>0,'Preset row not displayed');return {presets:choices.map(x=>x.textContent),boundKey:r.Q.HK_LINE_SPLIT._5997()[0],groupRows:group._2430.size};
  ''')
  await page.wait_for_timeout(500)
  await page.screenshot(path=str(ROOT/'verification/lines-controls-browser.png'))
  result={'version':json.loads((ROOT/'package.json').read_text())['version'],'kind':'OFFLINE_NATIVE_PACKET_WRITER_AND_INPUT_INTEGRATION','network':'FIXTURES','gpu':'SUBSTITUTED_SUBMISSION','tests':results,'pageErrors':errors,'pass':all(x['pass']for x in results)and not errors,'liveLineShapeVerified':False}
  (ROOT/'verification/line-input-browser.json').write_text(json.dumps(result,indent=2));await b.close()
 return result['pass']
if __name__=='__main__':raise SystemExit(0 if asyncio.run(main())else 1)
