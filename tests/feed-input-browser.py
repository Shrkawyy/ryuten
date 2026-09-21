"""Distributed userscript/native packet writers + real input handlers; no live server/GPU."""
import asyncio, importlib.util, json, os, pathlib
from playwright.async_api import async_playwright
from browser_path import chromium_path
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('smoke',ROOT/'tests/browser-smoke.py');smoke=importlib.util.module_from_spec(spec);spec.loader.exec_module(smoke)
PREP=r'''()=>{
 const {h,rp,r,port,world,advance}=FIXTURE;FIXTURE.connect();port.onFrame=null;h.renderer.run=()=>{};
 port.multibox.ffaAutoConnect=false;port.multibox.setEnabled(false);
 world([{id:500,x:6000,y:7000,radius:600,parent:100},{id:501,x:8000,y:9000,radius:400,parent:101}]);advance();rp.hideMenu();
 const f=rp.feedTiming,w=port.frame.contentWindow,doc=w.document;
 let time=0,next=0;const timers=new Map();
 f._now=()=>time;f._setTimeout=(fn,delay)=>{timers.set(++next,{fn,at:time+delay});return next;};f._clearTimeout=id=>timers.delete(id);
 const tick=ms=>{const end=time+ms;let n=0;for(;;){const q=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!q)break;if(++n>10000)throw Error('timer leak');time=q[1].at;timers.delete(q[0]);q[1].fn();}time=end;};
 const key=(type,code,key,extra={},target=doc)=>target.dispatchEvent(new w.KeyboardEvent(type,{bubbles:true,cancelable:true,code,key,...extra}));
 const press=()=>key('keydown','KeyW','w'),release=()=>key('keyup','KeyW','w');
 const tab=()=>{key('keydown','Tab','Tab');key('keyup','Tab','Tab');};
 const packets=log=>(log||FIXTURE.sent).filter(p=>p[0]===23);
 const reset=(interval=0)=>{f.release('test-reset');rp.lineSplit.cancel('test-reset');port.pending=null;port.spawnPending.clear();
   port.multibox.intent=null;rp.hideMenu();doc.activeElement?.blur();h.menu.isChatFocused=false;h.settings.feedFollowsTab=true;
   h.player.activeTab=0;f.setIntervalMs(interval);FIXTURE.sent.length=0;};
 const init=(host,width,first,client,log)=>{
   host.network.ws={readyState:1,bufferedAmount:0,send:data=>log.push(Array.from(new Uint8Array(data))),close(){this.readyState=3;}};host.network.url=h.network.url;host.network.isReplay=false;
   const realm=host===h?window:port.multibox.aux.frame.contentWindow;
   const send=x=>host.parser.parse(realm.Uint8Array.from(x.b).buffer),W=FIXTURE.Writer;
   const hello=new W(0).u32(16000).u16(client).u8(width);for(let i=0;i<width;i++)hello.u16(first+i);send(hello);send(new W(8));
   send(new W(10).u8(1).u16(client).u8(0).s16('Fixture').s16('Team').u8(255).u8(50).u8(20).u8(0).s16('').u8(0).u8(0));
   const players=new W(11).u8(width);for(let i=0;i<width;i++)players.u16(first+i).u16(client).u8(255).u8(50).u8(20).s8('').u32(0);send(players.u8(0).u8(0));
   const cells=new W(20).u16(0).u16(width);for(let i=0;i<width;i++)cells.u32(first*10+i).i32(6500+i*1000).i32(7000+i*1000).u16(600).u8(0).u16(first+i).u8(255).u8(50).u8(20);send(cells.u16(0).u16(0));host.player.update();
 };
 port.test.prepareAux=win=>{win.WebSocket=window.WebSocket;Object.defineProperty(win,'sessionStorage',{configurable:true,value:{getItem:()=>null,setItem(){},removeItem(){}}});Object.defineProperty(win.document,'cookie',{configurable:true,get:()=>'',set(){}});};
 window.FEEDTEST={f,w,doc,tick,timers,key,press,release,tab,packets,reset,init};
 return {keys:{single:h.settings.hkFeed,held:h.settings.hkMacroFeed},version:port.version};
}'''
async def main():
 results=[];errors=[];baseline=os.getenv('FEED_BASELINE')=='1'
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=chromium_path(),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)))
  async def route(q):
   if q.request.url.startswith('https://api.senpa.io/tracker'):await q.fulfill(body=(ROOT/'references/tracker.json').read_text(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
   else:await q.abort()
  await page.route('**/*',route);await page.set_content('<!doctype html><html><body></body></html>');await page.evaluate('('+smoke.HOOK+')()')
  artifact=pathlib.Path(os.getenv('SCRIPT_UNDER_TEST',str(ROOT/'dist/RYUTEN-Senpa.user.js')))
  await page.evaluate(artifact.read_text());await page.wait_for_function('SENPA_PORT.ready||SENPA_PORT.error',timeout=30000)
  if not await page.evaluate('SENPA_PORT.ready'):raise RuntimeError(await page.evaluate('SENPA_PORT.error'))
  await page.evaluate((ROOT/'tests/browser-fixtures.js').read_text());print(await page.evaluate(PREP),flush=True)
  async def check(name,code,old_repro=False):
   if baseline and not old_repro:return
   try:
    detail=await page.evaluate('async()=>{const {h,port,rp,r,world,advance,assert,Writer}=FIXTURE;const {f,w,doc,tick,timers,key,press,release,tab,packets,reset,init}=FEEDTEST;'+code+'}')
    results.append({'case':name,'pass':True,'detail':detail});print('PASS',name,detail,flush=True)
   except Exception as e:results.append({'case':name,'pass':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
  await check('default W initiates real native held feed, not a single eject',r'''
    reset();press();const p=packets();assert(JSON.stringify(p)==='[[23,0,1,1]]','W does not start held feed: '+JSON.stringify(p));release();
    assert(JSON.stringify(packets().at(-1))==='[23,0,1,0]','Missing W-up stop');return {keys:[h.settings.hkFeed,h.settings.hkMacroFeed],bytes:packets()};
  ''',True)
  await check('native held feed resumes after switch-to-spawn without a second input',r'''
    reset();world([],[],[501]);h.actions.macroFeed(true);port.request('switch',1);
    assert(!h.actions.isMacroFeeding,'Old emitter remains on during spawn');tick(200);
    world([{id:501,x:8000,y:9000,radius:400,parent:101}]);port.flushActions();tick(80);
    assert(h.actions.isMacroFeeding&&h.actions.macroFeedTab===1,'Feed did not resume on the spawned player');
    const bytes=packets();h.actions.macroFeed(false);return {bytes,stopped:!h.actions.isMacroFeeding};
  ''',True)
  await check('W stays held through 30 native tab switches; Tab-up never stops it',r'''
    reset();press();for(let n=0;n<30;n++){tab();assert(h.actions.isMacroFeeding,'Stopped at switch '+n);assert(h.actions.macroFeedTab===h.player.activeTab,'Wrong feeding slot');assert(f.snapshot().held,'Lost intent');}
    const n=packets().length;release();assert(packets().length===n+1&&!h.actions.isMacroFeeding,'Wrong key-up');return {switches:30,startsAndStops:packets().length};
  ''')
  for interval in (10,100):
   await check(f'custom {interval} ms cadence preserves deadline and transfers to the active tab',f'''
    reset({interval});press();tick({interval//2});tab();assert(packets().length===1,'Extra switch pellet');tick({interval-interval//2});
    assert(JSON.stringify(packets())==='[[23,0,0],[23,1,0]]','Wrong timer route: '+JSON.stringify(packets()));release();tick(1000);assert(packets().length===2&&timers.size===0,'Release leak');return {{bytes:packets()}};
   ''')
  await check('W-up during native spawn wait cannot rearm after ownership arrives',r'''
    reset();world([],[],[501]);press();port.request('switch',1);assert(f.snapshot().waitingForPlayer,'Not waiting');release();
    world([{id:501,x:8000,y:9000,radius:400,parent:101}]);port.flushActions();tick(20000);
    assert(!h.actions.isMacroFeeding&&!f.snapshot().held&&timers.size===0,'Stale start');return {bytes:packets()};
  ''')
  await check('custom held feed also resumes when the newly selected player spawns',r'''
    reset(100);world([],[],[501]);press();port.request('switch',1);tick(300);assert(packets().length===1,'Fed unowned player');
    world([{id:501,x:8000,y:9000,radius:400,parent:101}]);port.flushActions();tick(80);
    assert(packets().some(p=>p[1]===1&&p[2]===0),'No new-player feed');release();assert(timers.size===0,'timer leak');return {bytes:packets()};
  ''')
  await check('physical key-up remains effective after modifiers change or the event target is an input',r'''
    reset();press();const input=doc.createElement('input');doc.body.append(input);
    input.addEventListener('keyup',e=>e.stopImmediatePropagation());key('keyup','KeyW','w',{ctrlKey:true},input);
    assert(!h.actions.isMacroFeeding&&!f.snapshot().held,'Key-up lost');input.remove();return {stopped:true};
  ''')
  await check('opening chat/menu and browser blur stop feed, without repeat-key restart',r'''
    const checks=[];for(const mode of ['menu','blur','chat']){reset();press();
      if(mode==='menu')rp.showMenu();else if(mode==='blur')w.dispatchEvent(new w.Event('blur'));else key('keydown','Enter','Enter');
      assert(!h.actions.isMacroFeeding&&!f.snapshot().held,'Safety stop failed '+mode);
      if(mode==='chat')key('keydown','Escape','Escape',{},doc.getElementById('senpa-chat-input')||doc);
      rp.hideMenu();h.menu.isChatFocused=false;key('keydown','KeyW','w',{repeat:true});assert(!h.actions.isMacroFeeding,'Repeat restarted feed');release();checks.push(mode);}
    return checks;
  ''')
  await check('mirrored Ryuten visual-tab stop does not release a physical W hold',r'''
    reset();press();r.Me._3605(0,false);assert(f.snapshot().held&&h.actions.isMacroFeeding,'Visual stop stole physical hold');
    tab();release();assert(!h.actions.isMacroFeeding,'Physical release failed');return {bytes:packets()};
  ''')
  await check('replay cannot emit a held-feed request',r'''
    reset();h.network.isReplay=true;try{press();assert(packets().length===0&&!f.snapshot().held,'Feed during replay');release();}finally{h.network.isReplay=false;}return {noReplayFeed:true};
  ''')
  await check('single eject E stays single; recording binding is untouched',r'''
    reset();key('keydown','KeyE','e');key('keyup','KeyE','e');assert(JSON.stringify(packets())==='[[23,0,0]]','Single eject changed');
    assert(!f.snapshot().held,'E became hold');return {single:h.settings.hkFeed,held:h.settings.hkMacroFeed,record:h.settings.hkReplay};
  ''')
  await check('FFA P1/P2: one physical W hold transfers between real native engines',r'''
    reset();const m=port.multibox;m.ffaEnabled=true;m.ffaAutoConnect=false;h.network.url='eu1.senpa.io:7101';port.selected=h.network.url;
    init(h,1,100,41,FIXTURE.sent);await m.ensureAux();assert(m.aux?.host,'No actual auxiliary host: '+m.error);
    const a=m.aux.host,log=[];init(a,1,200,141,log);FEEDTEST.auxLog=log;rp.hideMenu();m.select(0);FIXTURE.sent.length=0;log.length=0;
    press();tab();assert(m.active===1,'Did not select FFA P2');assert(!h.actions.isMacroFeeding&&a.actions.isMacroFeeding,'Did not transfer engines');
    assert(JSON.stringify(packets(log))==='[[23,0,1,1]]','Wrong auxiliary native slot');tab();assert(m.active===0&&h.actions.isMacroFeeding&&!a.actions.isMacroFeeding,'Return failed');
    release();assert(!h.actions.isMacroFeeding&&!a.actions.isMacroFeeding,'W-up incomplete');return {primary:packets(),auxiliary:packets(log)};
  ''')
  await check('FFA auxiliary pending-spawn keeps physical W alive through native startup',r'''
    reset();const m=port.multibox,a=m.aux.host,log=FEEDTEST.auxLog;m.select(0);a.world.myCells[0].clear();
    press();port.request('switch',1);tick(200);assert(f.snapshot().held&&f.snapshot().waitingForPlayer,'Lost W during FFA pending');
    const cell=new a.Cell(2100,7000,7000,600,0);cell.parentPlayerID=a.world.myPlayerIDs[0];a.world.cells.set(2100,cell);a.world.myCells[0].set(2100,cell);a.player.update();m.flush();tick(80);
    assert(a.actions.isMacroFeeding&&!h.actions.isMacroFeeding,'FFA spawn failed to transfer');release();return {auxiliary:packets(log)};
  ''')
  await check('WindBine: held W crosses Q pair switches and Tab native-slot switches',r'''
    reset();const m=port.multibox;m.destroyAux();m.windbineEnabled=true;h.network.url='eu1.senpa.io:7112';port.selected=h.network.url;
    init(h,2,100,41,FIXTURE.sent);await m.ensureAux();assert(m.aux?.host,'No WindBine aux');const a=m.aux.host,log=[];init(a,2,200,141,log);
    rp.hideMenu();m.select(0);FIXTURE.sent.length=0;log.length=0;press();
    tab();assert(m.active===1&&h.actions.macroFeedTab===1,'P2 failed');key('keydown','KeyQ','q');key('keyup','KeyQ','q');
    assert(m.active===3&&a.actions.isMacroFeeding&&!h.actions.isMacroFeeding&&a.actions.macroFeedTab===1,'P4 pair transfer failed');
    tab();assert(m.active===2&&a.actions.macroFeedTab===0,'P3 failed');key('keydown','KeyQ','q');key('keyup','KeyQ','q');
    assert(m.active===0&&h.actions.isMacroFeeding&&!a.actions.isMacroFeeding,'P1 return failed');release();
    return {primary:packets(),auxiliary:packets(log)};
  ''')
  await check('WindBine custom cadence survives Q and Tab without additional pulses',r'''
    reset(100);const m=port.multibox,a=m.aux.host,log=[];a.network.ws.send=data=>log.push(Array.from(new Uint8Array(data)));m.select(0);FIXTURE.sent.length=0;
    press();tick(30);key('keydown','KeyQ','q');key('keyup','KeyQ','q');tick(30);tab();tick(39);
    assert(packets().length===1&&packets(log).length===0,'Early pulse');tick(1);
    assert(JSON.stringify(packets(log))==='[[23,1,0]]','Wrong P4 timer route');release();tick(1000);assert(packets(log).length===1&&timers.size===0,'Custom release failed');return {primary:packets(),auxiliary:packets(log)};
  ''')
  await check('all profiles, shields, mass contrast and 500 ms cap retained',r'''
    reset();const report=[];for(const style of ['Senpa','Ryuten','XPLUS']){r.Q.PRESENTATION_STYLE._7531(style);press();assert(f.snapshot().held,'No hold for '+style);release();report.push(style);}
    rp.motion.useUltraPreset(2000);assert(rp.motion.delay===500,'XPLUS cap regression');assert(rp.shieldsEnabled,'Shield regression');assert(rp.modules.massLabels.createAtlas(),'Missing mass atlas');
    return {profiles:report,shields:rp.shieldsEnabled,xplusMax:rp.motion.delay};
  ''')
  result={'version':await page.evaluate('SENPA_PORT.version'),'kind':'OFFLINE_NATIVE_INPUT_AND_PACKET_WRITERS','network':'FIXTURES','gpu':'SUBSTITUTED_SUBMISSION','tests':results,'pageErrors':errors,'pass':bool(results) and all(x['pass']for x in results) and not errors,'liveServerTested':False}
  out=ROOT/'verification'/('feed-input-baseline.json' if baseline else 'feed-input-browser.json');out.write_text(json.dumps(result,indent=2)+'\n');await b.close()
 return result['pass']
if __name__=='__main__':raise SystemExit(0 if asyncio.run(main())else 1)
