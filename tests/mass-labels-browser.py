"""Actual native compositor and real Canvas digit pixels; network/GPU submission are mocked.
No physical-GPU/FPS or live server parity is claimed by this fixture.
"""
import asyncio, importlib.util, json, pathlib
from playwright.async_api import async_playwright
from browser_path import chromium_path
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('smoke',ROOT/'tests/browser-smoke.py');smoke=importlib.util.module_from_spec(spec);spec.loader.exec_module(smoke)
async def main():
 results=[];errors=[];requests=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=chromium_path(),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1440,'height':1000})
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def route(q):
   requests.append(q.request.url)
   if q.request.url.startswith('https://api.senpa.io/tracker'):await q.fulfill(body=(ROOT/'references/tracker.json').read_text(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
   else:await q.abort()
  await page.route('**/*',route);await page.set_content('<!doctype html><html><body></body></html>');await page.evaluate('('+smoke.HOOK+')()')
  await page.evaluate((ROOT/'dist/RYUTEN-Senpa.user.js').read_text());await page.wait_for_function('SENPA_PORT.ready||SENPA_PORT.error',timeout=30000)
  if not await page.evaluate('SENPA_PORT.ready'):raise RuntimeError(await page.evaluate('SENPA_PORT.error'))
  await page.evaluate((ROOT/'tests/browser-fixtures.js').read_text())
  await page.evaluate('''()=>{const {h,port,rp,world,advance}=FIXTURE;FIXTURE.connect();world([{id:500,x:7500,y:8000,radius:500,parent:100,r:255,g:255,b:0}]);advance();port.onFrame=null;rp.hideMenu();}''')
  async def check(name,code):
   try:
    detail=await page.evaluate('async()=>{const {h,port,rp,r,world,advance,assert}=FIXTURE;'+code+'}');results.append({'case':name,'pass':True,'detail':detail});print('PASS',name,detail,flush=True)
   except Exception as e:results.append({'case':name,'pass':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
  await check('Full shields remain available and initialized',r'''
    assert(rp.shieldsEnabled,'Accidentally built stripped edition');assert(Object.keys(r.pe._1763).length>=11,'Shield catalogue missing');assert(r.zt._8662.length>0,'Shield atlas missing');return {catalogue:Object.keys(r.pe._1763).length,atlas:r.zt._8662.length,version:port.version};
  ''')
  await check('XPLUS and all derived visual times stay at or below 500 ms',r'''
    rp.motion.useUltraPreset(2000);assert(r.Q.XPLUS_SETTLE_MS._5997()===500,'XPLUS cap lost');assert(rp.motion.delay===500,'Runtime cap lost');rp.refreshMotionUI();const slider=port.frame.contentDocument.querySelector('[data-senpa-animation]');assert(slider.max==='500','Slider cap lost');rp.motion.useUltraPreset(420);return rp.motion.snapshot();
  ''')
  await check('Every generated glyph has real opaque white and black pixels without edge bleed',r'''
    const atlas=r.Pt._1516('titillium-web-font-atlas'),ctx=atlas.getContext('2d'),counts=[];
    for(const [i,[x,y,w,h]] of rp.modules.massLabels.rects.entries()){
      const data=ctx.getImageData(x,y,w,h).data;let white=0,black=0,edge=0;
      for(let k=0;k<w*h;k++){const a=data[k*4+3],c=data[k*4];if(a===255&&c>245)white++;if(a===255&&c<10)black++;const px=k%w,py=Math.floor(k/w);if((px===0||py===0||px===w-1||py===h-1)&&a>0)edge++;}
      assert(white>100&&black>100,'Invisible or unstroked digit '+i);assert(edge===0,'Glyph leaks to neighboring crop '+i);counts.push({digit:i,white,black,edge});
    }
    assert(atlas===rp.modules.massLabels.createAtlas(),'Rebuilt atlas');return {counts,font:rp.modules.massLabels.snapshot()};
  ''')
  await check('Native compositor mass is white on every tested name color and profile',r'''
    h.settings.cellMass=h.settings.ownCellMass=h.settings.cellNick=h.settings.ownCellNick=true;
    const v=rp.world.cells.get(500).view,client=v._2182._1059;v._4788=r.n._4541-10000;r.z_._4336=.6;
    const originals={rgb:[v._6728._9568,v._6728._5294,v._6728._1754],radius:v._1904};
    const textures=new Set([...r.xt._2571._1960.values()]);const report=[];
    for(const style of ['Senpa','Ryuten','XPLUS'])for(const color of ['#ffff00','#000000','#ffffff','#00ff00','#ff00ff','#060622']){
      r.Q.PRESENTATION_STYLE._7531(style);client._senpaNameColor=color;
      const stage=new r.c.W20();r.n_._6212();r.n_._7703(v,stage);
      const glyphs=stage.children.flatMap(x=>x.children||[]).filter(x=>textures.has(x.texture));
      assert(glyphs.length>=4,'No actual native mass glyphs: '+stage.children.length);
      assert(glyphs.every(x=>x.tint===0xffffff),'Name color stained mass '+color+' '+style);
      assert(rp.nameTint(v)===parseInt(color.slice(1),16),'Changed player name color');
      report.push({style,color,glyphs:glyphs.length});
      // Deliberately contaminate pooled instances; the next draw must reset tint.
      glyphs.forEach(x=>x.tint=0xffff00);
    }
    const stage=new r.c.W20();r.n_._6212();r.n_._7703(v,stage);
    assert(v._1904===originals.radius,'Changed collision/visual radius');return {draws:report.length,profiles:3,colors:6};
  ''')
  await check('Mass visibility preferences remain obeyed',r'''
    const v=rp.world.cells.get(500).view,tex=new Set([...r.xt._2571._1960.values()]);h.settings.ownCellMass=false;const stage=new r.c.W20();r.n_._6212();r.n_._7703(v,stage);assert(!stage.children.flatMap(x=>x.children||[]).some(x=>tex.has(x.texture)),'Forced mass on');h.settings.ownCellMass=true;return {visibilityRespected:true};
  ''')
  await check('Chat stays opaque without hover; dark chat names keep contrast',r'''
    r.k_._1319.AUTO_DIM_CHATROOM=true;r.B_._1406=false;r.B_._9335=r.n._4541-20000;r.B_._4659();
    const el=port.frame.contentDocument.getElementById('chbx-body-content'),style=port.frame.contentWindow.getComputedStyle(el);
    assert(style.filter==='none','Chat blur returned');assert(rp.modules.chatAppearance.contrastAgainstPanel(rp.chatNameColor('#000000'))>=4.5,'Black chat name unreadable');
    r.k_._1319.AUTO_DIM_CHATROOM=false;return {filter:style.filter,opacity:style.opacity,blackName:rp.chatNameColor('#000000')};
  ''')
  # A reproducible visual fixture rendered from the actual generated game numeral atlas.
  await page.evaluate(r'''()=>{
    const {rp,r,port}=FIXTURE,atlas=r.Pt._1516('titillium-web-font-atlas'),rects=rp.modules.massLabels.rects;
    port.onFrame=null;const canvas=document.createElement('canvas');canvas.id='mass-contrast-fixture';canvas.width=1100;canvas.height=580;
    Object.assign(canvas.style,{position:'fixed',top:'0',left:'0',zIndex:2147483647,width:'1100px',height:'580px'});document.body.append(canvas);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#111827';ctx.fillRect(0,0,1100,580);ctx.fillStyle='#f8fafc';ctx.font='bold 24px Arial';ctx.fillText('Mass label contrast — current generated game digits',26,38);
    ctx.font='15px Arial';ctx.fillStyle='#cbd5e1';ctx.fillText('Canvas rendering fixture, not a live gameplay screenshot. Cell and name colors are unchanged.',26,64);
    const colors=['#ffff00','#ffffff','#15e8c8','#ef50bd','#0b1022'];
    const digits=(text,cx,cy,scale)=>{const width=72*(text.length-1)+95,x0=cx-width*scale/2;[...text].forEach((s,i)=>{const[x,y,w,h]=rects[+s];ctx.drawImage(atlas,x,y,w,h,x0+i*72*scale,cy-105*scale/2,w*scale,h*scale);});};
    colors.forEach((color,i)=>{const cx=110+i*220;ctx.beginPath();ctx.arc(cx,196,81,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();digits('25012',cx,210,.32);ctx.fillStyle='#cbd5e1';ctx.font='15px Arial';ctx.textAlign='center';ctx.fillText(color,cx,307);});
    ctx.textAlign='left';ctx.font='18px Arial';ctx.fillStyle='#e2e8f0';ctx.fillText('Bright patterned skin / smaller projected mass',26,352);
    for(let j=0;j<3;j++){const x=26+j*355,y=374;ctx.save();ctx.beginPath();ctx.rect(x,y,330,150);ctx.clip();for(let k=0;k<28;k++){ctx.fillStyle=k%2?'#fbfbfb':'#ebbe26';ctx.fillRect(x+k*14,y,14,150);}digits('97893',x+165,y+75,[.2,.26,.34][j]);ctx.restore();}
    ctx.fillStyle='#cbd5e1';ctx.font='14px Arial';ctx.fillText('White fill + opaque black outline. Ubuntu Bold when local; Arial/sans-serif fallback. No runtime font fetch.',26,555);
  }''')
  await page.locator('#mass-contrast-fixture').screenshot(path=str(ROOT/'verification/mass-contrast-preview.png'))
  fonts=[u for u in requests if any(k in u.lower()for k in ['fonts.googleapis','fonts.gstatic','.woff','.ttf','ubuntubold','bitmapfonts'])]
  results.append({'case':'No runtime font requests','pass':not fonts,'detail':fonts})
  result={'version':json.loads((ROOT/'package.json').read_text())['version'],'kind':'OFFLINE_NATIVE_COMPOSITOR_AND_REAL_2D_PIXELS','network':'FIXTURE','gpu':'SUBSTITUTED_SUBMISSION','tests':results,'pageErrors':errors,'pass':all(t['pass']for t in results)and not errors}
  (ROOT/'verification/mass-labels-browser.json').write_text(json.dumps(result,indent=2));await browser.close()
 return result['pass']
if __name__=='__main__':raise SystemExit(0 if asyncio.run(main())else 1)
