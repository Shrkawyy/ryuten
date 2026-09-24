import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/app/map.js',import.meta.url),'utf8');
function fixture(){
 const images=[],textures=[];
 class Image {constructor(){this.naturalWidth=1200;this.naturalHeight=800;images.push(this);}set src(v){this.url=v;}get src(){return this.url;}}
 class Texture {constructor(canvas){this.canvas=canvas;textures.push(this);}destroy(){this.destroyed=true;}}
 const setting=v=>({_5997:()=>v,_7531:value=>{v=value;}});
 const rp={modules:{},assets:{},saveSetting(){},log(){},parentPort:{}};
 const r={It:{_1848:{_4641:1,_5195:''},_5683:{},_4659(){},_4435:{removeChildren(){}}},Q:{BACKGROUND_IMAGE_URL:setting(''),BACKGROUND_IMAGE_QUALITY:setting('medium'),WORLD_BACKGROUND_IMAGE:setting(false),BACKGROUND_IMAGE_COLOR:setting(0xc0c0c0)},c:{VL4:Texture,WBB:{OFF:0},xEZ:{WHITE:{baseTexture:{}}}}};
 r.It._5683.uTexture=r.c.xEZ.WHITE.baseTexture;
 const document={createElement:()=>({getContext:()=>({drawImage(){}})})};
 vm.runInNewContext(source,{window:{RYUTEN_PORT:rp},Image,URL,document,setTimeout,clearTimeout,Uint8Array});rp.modules.installWorldMap(r);
 return {rp,r,images,textures,success:i=>images[i].onload(),fail:i=>images[i].onerror()};
}
test('HTTPS URL decodes with anonymous CORS and persists only after successful load',async()=>{
 const {rp,r,images,success}=fixture();const p=rp.applyWorldMapURL(' https://example.com/map.png ');
 assert.equal(images[0].crossOrigin,'anonymous');assert.equal(images[0].url,'https://example.com/map.png');assert.equal(r.Q.WORLD_BACKGROUND_IMAGE._5997(),false);
 success(0);assert.equal(await p,true);assert.equal(r.Q.BACKGROUND_IMAGE_URL._5997(),'https://example.com/map.png');assert.equal(r.Q.WORLD_BACKGROUND_IMAGE._5997(),true);assert.equal(rp.mapState.status,'ready');
});
test('failed URL keeps the last usable texture and persisted URL',async()=>{
 const {rp,r,success,fail}=fixture();let p=rp.applyWorldMapURL('https://example.com/good.png');success(0);await p;const texture=r.It._5683.uTexture;
 p=rp.applyWorldMapURL('https://example.com/fail.png');fail(1);assert.equal(await p,false);assert.equal(r.It._5683.uTexture,texture);assert.equal(texture.destroyed,undefined);assert.equal(r.Q.BACKGROUND_IMAGE_URL._5997(),'https://example.com/good.png');assert.match(rp.mapState.error,/cross-origin/);
});
test('rapid URL changes cannot allow a late image to replace the latest background',async()=>{
 const {rp,r,success}=fixture();const a=rp.applyWorldMapURL('https://example.com/a.png'),b=rp.applyWorldMapURL('https://example.com/b.png');success(1);await b;const texture=r.It._5683.uTexture;success(0);assert.equal(await a,false);assert.equal(r.It._5683.uTexture,texture);assert.equal(r.Q.BACKGROUND_IMAGE_URL._5997(),'https://example.com/b.png');
});
test('non-HTTPS and credential-bearing URLs fail before any image request',async()=>{
 const {rp,images}=fixture();for(const url of ['javascript:alert(1)','http://example.com/a.png','https://user:password@example.com/a.png','not a URL'])assert.equal(await rp.applyWorldMapURL(url),false);assert.equal(images.length,0);
});
test('saved external URL survives map migration',()=>{
 const {rp}=fixture();const h={settings:{backgroundImageURL:'https://i.imgur.com/aKvo1jQ.png',backgroundImage:true}};const calls=[];rp.parentPort.setSetting=(...v)=>calls.push(v);rp.modules.migrateWorldMap(h,{});assert.equal(calls.length,0);
});
