"""Actual captured native engine + Ryuten scene; external network and GPU submission substituted."""
import asyncio,json,pathlib,shutil,os
from playwright.async_api import async_playwright
from browser_path import chromium_path
ROOT=pathlib.Path(__file__).resolve().parents[1]
HOOK=r'''() => {
 const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),key:i=>[...m.keys()][i],get length(){return m.size;}}};
 const prepare=win=>{Object.defineProperty(win,'localStorage',{configurable:true,value:memory()});Object.defineProperty(win,'sessionStorage',{configurable:true,value:memory()});Object.defineProperty(win.document,'cookie',{configurable:true,get:()=>'',set:()=>{}});};prepare(window);
 let value;
 Object.defineProperty(window,'SENPA_PORT',{configurable:true,get:()=>value,set:v=>{
  value=v;v.test={prepareChild:prepare,beforeGraphics:(r,win)=>{
    class GPUBackendSubstitute {constructor(o){this.view=o.view;this.width=o.width||1;this.height=o.height||1;this.backgroundColor=0;this.calls=0;}resize(w,h){this.width=w;this.height=h;if(this.view){this.view.width=w;this.view.height=h;}}render(stage){if(!stage||!stage.children)throw Error('Invalid Pixi stage');this.calls++;}destroy(){}}
    const original=r.Ue._2794.toString().replace('new c.Thl(', 'new GPUBackendSubstitute(');
    r.Ue._2794=win.Function('c','GPUBackendSubstitute','return function '+original)(r.c,GPUBackendSubstitute);
    r.X_._2794=()=>{r.X_._4894=win.document.getElementById('main-canvas');r.X_._1855=new GPUBackendSubstitute({view:r.X_._4894,width:win.innerWidth,height:win.innerHeight});r.X_._9313=new r.c.W20();r.c.vB5.shared.stop();r.xt._2794();r.V_._2794();r.St._2794();r.X_._9313.addChild(r.V_._7588,r.St._7588);r.X_._4103=1;r.X_._2902=1;r.X_._1855.resize(win.innerWidth,win.innerHeight);};
    r.y_._7069=()=>{};
  }};
 }});
 class MockWebSocket extends EventTarget {
  static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
  constructor(url){super();this.url=url;this.readyState=0;this.OPEN=1;this.sent=[];window.mockSockets??=[];window.mockSockets.push(this);}
  send(data){this.sent.push(data);}close(){this.readyState=3;}
 }
 window.WebSocket=MockWebSocket;
}'''
async def main():
 events=[];result={'kind':'OFFLINE_INTEGRATION','gpu':'SUBSTITUTED_SUBMISSION','network':'FIXTURES','pass':False}
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=chromium_path(),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page(viewport={'width':1440,'height':900})
  page.on('pageerror',lambda e:events.append({'type':'pageerror','message':str(e)}))
  page.on('console',lambda m:events.append({'type':m.type,'message':m.text[:1800]}) if m.type in ['error','warning'] else None)
  async def route(r):
   u=r.request.url
   if u in ['https://senpa.io/web/','https://senpa.io/web']:
    await r.fulfill(status=200,body='<!doctype html><html><head><title>Fixture</title></head><body></body></html>',content_type='text/html')
   elif u.startswith('https://api.senpa.io/tracker'):
    await r.fulfill(status=200,body=(ROOT/'references/tracker.json').read_text(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
   else: await r.abort()
  await page.route('**/*',route)
  await page.set_content('<!doctype html><html><head></head><body></body></html>')
  await page.evaluate('('+HOOK+')()')
  try:
   await page.evaluate((ROOT/'dist/RYUTEN-Senpa.user.js').read_text())
   await page.wait_for_function('window.SENPA_PORT?.ready || window.SENPA_PORT?.error',timeout=30000)
   result['state']=await page.evaluate('()=>({ready:SENPA_PORT.ready,error:SENPA_PORT.error,hostStarted:SENPA_PORT.hostStarted,logs:SENPA_PORT.logs})')
   result['pass']=result['state']['ready']
   if result['pass']:
    result['native']=await page.evaluate('()=>({cellMs:SENPA_HOST.settings.cellAnimation,settings:Object.keys(SENPA_HOST.settingsStore.definitions).length,wasm:typeof SENPA_HOST.wasm.create,shields:Object.keys(SENPA_PORT.child.reference.pe._1763).length,merged:Object.keys(SENPA_PORT.child.reference.Q).length,frames:SENPA_PORT.child.world.frameCount})')
    await page.wait_for_timeout(1000)
   await page.screenshot(path=str(ROOT/'verification/menu.png'))
  except Exception as e:
   result['error']=str(e)
   result['state']=await page.evaluate('()=>({error:window.SENPA_PORT?.error,hostStarted:window.SENPA_PORT?.hostStarted,logs:window.SENPA_PORT?.logs})')
  result['events']=events[-60:]
  (ROOT/'verification/browser-smoke.json').write_text(json.dumps(result,indent=2))
  print(json.dumps(result,indent=2)[:16000])
  await b.close()
 return result['pass']
if __name__=='__main__':raise SystemExit(0 if asyncio.run(main()) else 1)
