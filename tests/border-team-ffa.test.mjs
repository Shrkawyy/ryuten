import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function modules(){const rp={modules:{},assets:{},parentPort:{}};vm.runInNewContext(read('src/app/map.js')+read('src/app/world.js'),{window:{RYUTEN_PORT:rp}});return rp;}
test('border forms a closed finite ring on all four actual edges, including rectangular maps',()=>{
 const rp=modules(),b={left:10,top:-20,right:1010,bottom:480};
 const {vertices:v,indices:i}=rp.modules.borderGeometry(b,20,0xff0000,0,0);
 assert.equal(v.length,48);assert.equal(i.length,24);assert.ok([...v].every(Number.isFinite));
 assert.deepEqual([...v.slice(0,6)],[0,-30,1,0,0,1]);
 let area=0;for(let j=0;j<i.length;j+=3){const a=i[j]*6,b=i[j+1]*6,c=i[j+2]*6;area+=Math.abs((v[b]-v[a])*(v[c+1]-v[a+1])-(v[c]-v[a])*(v[b+1]-v[a+1]))/2;}
 assert.equal(area,1020*520-980*480);
});
test('border glow is finite; disabled/invalid borders have no triangles',()=>{
 const rp=modules(),b={left:0,top:0,right:100,bottom:200};
 const mesh=rp.modules.borderGeometry(b,8,0x123456,10,0xffffff);
 assert.equal(mesh.indices.length,72);assert.ok([...mesh.vertices].every(Number.isFinite));
 assert.equal(rp.modules.borderGeometry(b,0,0,20,0).indices.length,0);
 assert.equal(rp.modules.borderGeometry({...b,left:NaN},8,0,0,0).indices.length,0);
});
test('border uploads once per change and follows server bounds, color and visibility',()=>{
 const rp=modules();rp.world={offset:30000};let vertex,index,calls=0;
 const h={border:{left:-100,top:-200,right:100,bottom:200},settings:{mapBorders:true,borderWidth:10}};
 const r={Lt:{_3213:{_5138:{update:v=>{vertex=v;calls++;}},_8555:{update:v=>index=v}}},Q:{BORDER_COLOR:{_5997:()=>0xffffff},BORDER_GLOW_SIZE:{_5997:()=>0},BORDER_GLOW_COLOR:{_5997:()=>0}}};
 rp.modules.installWorldBorder(h,r);r.Lt._8013();assert.equal(vertex[0],29895);assert.equal(vertex[1],29795);assert.equal(index.length,24);
 r.Lt._8013();assert.equal(calls,1);h.border.right=500;r.Lt._8013();assert.equal(calls,2);
 h.settings.mapBorders=false;r.Lt._8013();assert.equal(index.length,0);
});
test('Teamtag is visible, clan fallback retained, and cleared metadata cannot leave stale labels',()=>{
 const rp=modules(),r={p:class{constructor(){this._4221=new Map();}},ne:{_2708:new Map()},Be:{}};
 const world=new rp.modules.WorldBridge({world:{myClientID:7},player:{nick:'Me'}},r);rp.nameColor=()=>0xffffff;
 let c=world.client(8,{nick:'Other',tag:'CREW',clanTag:'CLAN'});assert.equal(c._9067,'CREW');assert.equal(c._senpaClanTag,'CLAN');
 c=world.client(8,{nick:'Other',tag:'',clanTag:'CLAN'});assert.equal(c._9067,'CLAN');
 c=world.client(8,{nick:'Other',tag:'',clanTag:''});assert.equal(c._9067,'');
});
function multi(ffa=true){
 let now=1000;const log=[],ctx={performance:{now:()=>now},console};vm.createContext(ctx);vm.runInContext(read('src/app/multibox.js')+';globalThis.M=SenpaMultibox;',ctx);
 const make=(id,alive)=>{const h={network:{url:'same-server',ws:{},connected:true,latency:100},player:{activeTab:0,isAlive:alive,isSpectating:false},world:{myClientID:id,myPlayerIDs:ffa?[id]:[id,id+10],myCells:ffa?[new Map()]:[new Map(),new Map()]},packets:{handshakeDone:true,spawn:i=>log.push(['spawn',id,i]),cursor:(x,y,i)=>log.push(['cursor',id,x,y,i])},menu:{onPlay:()=>{}},actions:{specMode:2},events:{Request_Spectate:'spectate'}};h.bus={dispatch:()=>{log.push(['spectate',id]);h.player.isSpectating=true;}};return h;};
 const primary=make(1,true),secondary=make(2,false);primary.world.myCells[0].set(100,{x:120,y:-340,radius:80});
 const m=Object.create(ctx.M.prototype);Object.assign(m,{primary,aux:{host:secondary},ffaEnabled:true,windbineEnabled:true,nearSpawn:true,active:0,port:{tracker:{servers:[{host:'same-server',mode:ffa?'ffa':'dual',name:ffa?'FFA':'WindBine'}]},log:()=>{},child:{}},intent:{slot:ffa?1:2,sent:false,positionedAt:null,anchor:null,socket:null}});m.setProfileIdentity=()=>{};
 return {m,primary,secondary,log,advance:()=>now+=200};
}
for(const ffa of [true,false])test(`${ffa?'FFA':'WindBine'} positions empty connection before one native spawn`,()=>{
 const {m,secondary,log,advance}=multi(ffa);m.flush();assert.equal(log[0][0],'spectate');assert.deepEqual(log[1],['cursor',2,120,-340,0]);assert.equal(log.some(x=>x[0]==='spawn'),false);assert.equal(secondary.actions.specMode,2);
 advance();m.flush();assert.equal(log.filter(x=>x[0]==='spawn').length,1);m.flush();assert.equal(log.filter(x=>x[0]==='spawn').length,1);
});
test('FFA nearby disabled sends no spectator/cursor positioning',()=>{const {m,log}=multi();m.nearSpawn=false;m.flush();assert.deepEqual(log,[['spawn',2,0]]);});
test('FFA missing anchor spawns normally and foreign server is not used as anchor',()=>{const {m,primary,log}=multi();primary.world.myCells[0].clear();m.flush();assert.deepEqual(log,[['spawn',2,0]]);primary.network.url='elsewhere';assert.equal(m.spawnAnchor(1),null);});
test('FFA reconnect repeats positioning wait rather than reusing old socket timing',()=>{const {m,secondary,log,advance}=multi();m.flush();advance();secondary.network.ws={};m.flush();assert.equal(log.some(x=>x[0]==='spawn'),false);advance();m.flush();assert.equal(log.filter(x=>x[0]==='spawn').length,1);});

test('visible-camera projection round-trips across zoom, pixel ratio and map offset',()=>{
 const rp={modules:{}};vm.runInNewContext(read('src/app/spawn-aim.js'),{window:{RYUTEN_PORT:rp}});
 const r={X_:{_4894:{getBoundingClientRect:()=>({left:10,top:20,width:1000,height:500})},_3473:2000,_3195:1000},z_:{_3852:{_7847:32000,_9202:31000},_4336:.5}};
 const world=rp.modules.spawnProjection(r,30000,{x:760,y:170},true);
 assert.deepEqual({...world},{x:3000,y:600});
 const screen=rp.modules.spawnProjection(r,30000,world);assert.deepEqual({...screen},{x:760,y:170});
 r.z_._3852._7847+=50;r.z_._4336=.25;const moved=rp.modules.spawnProjection(r,30000,world);assert.notEqual(moved.x,screen.x);
 assert.deepEqual({...rp.modules.spawnProjection(r,30000,moved,true)},{...world});
});
test('mouse intent captures locked target and clamps inside server bounds',()=>{
 const {m,primary}=multi();primary.border={left:0,top:0,right:1000,bottom:2000};m.mouseSpawn=true;
 m.spawnTarget={x:5000,y:-10,endpoint:primary.network.url};const intent=m.createSpawnIntent(1);
 assert.deepEqual({...intent.requestedAnchor},{x:1000,y:0,kind:'mouse'});
 m.spawnTarget.x=90;assert.equal(intent.requestedAnchor.x,1000);
 m.spawnTarget.endpoint='other';m.port.child.spawnAim={mouseWorld:()=>({x:12,y:34})};assert.equal(m.createSpawnIntent(1).requestedAnchor.x,12);
});
test('mouse spawn waits for a fresh matching server position and sends only once',()=>{
 const {m,secondary,log,advance}=multi();m.spectatorAcks=new WeakMap();m.intent.requestedAnchor={x:450,y:600,kind:'mouse'};
 m.flush();advance();m.flush();assert.equal(log.some(x=>x[0]==='spawn'),false);
 m.spectatorAcks.set(secondary,{x:0,y:0,sequence:1,socket:secondary.network.ws});m.flush();assert.equal(log.some(x=>x[0]==='spawn'),false);
 m.spectatorAcks.set(secondary,{x:450,y:600,sequence:2,socket:secondary.network.ws});m.flush();m.flush();assert.equal(log.filter(x=>x[0]==='spawn').length,1);
 assert.deepEqual(log.find(x=>x[0]==='cursor'),['cursor',2,450,600,0]);
});
test('mouse positioning timeout never falls through to a distant spawn',()=>{
 const {m,log,advance}=multi();m.intent.requestedAnchor={x:450,y:600,kind:'mouse'};m.port.notify=()=>{};
 m.flush();for(let i=0;i<41;i++)advance();m.flush();assert.equal(m.intent,null);assert.equal(log.some(x=>x[0]==='spawn'),false);assert.match(m.error,/did not confirm/);
});
test('stale socket acknowledgement cannot authorize a mouse spawn',()=>{
 const {m,secondary,log,advance}=multi();m.intent.requestedAnchor={x:450,y:600,kind:'mouse'};m.spectatorAcks=new WeakMap();m.flush();advance();
 m.spectatorAcks.set(secondary,{x:450,y:600,sequence:1,socket:{}});m.flush();assert.equal(log.some(x=>x[0]==='spawn'),false);
});
test('locked target positions only empty same-server connections',()=>{
 const {m,primary,secondary,log}=multi();m.mouseSpawn=true;m.intent=null;m.spawnTarget={x:70,y:90,endpoint:primary.network.url};m.updateSpawnTargets();
 assert.deepEqual(log,[['spectate',2],['cursor',2,70,90,0]]);
 log.length=0;secondary.network.url='different';m.updateSpawnTargets();assert.equal(log.length,0);
});
test('native spectator cursor matches ONYX opcode, mode and signed coordinate layout',()=>{
 const source=read('src/snapshot/senpaJS.js'),start=source.indexOf('cursor(e,t,n){'),end=source.indexOf('customGameInfo(',start);
 const writer={reset(){this.bytes=[];},writeUInt8(v){this.bytes.push(v&255);},writeInt32(v){const b=Buffer.alloc(4);b.writeInt32LE(v);this.bytes.push(...b);},get buffer(){return Uint8Array.from(this.bytes);}};
 const sent=[],X={connected:true,send:b=>sent.push([...b])},B={isAlive:false,isSpectating:true,activeTab:0},actions={specMode:1};
 const packets=Function('X','B','$h','return ({'+source.slice(start,end)+'})')(X,B,actions);
 packets.handshakeDone=true;packets.spectateCursorWriter=writer;packets.cursor(450,-600,0);
 const expected=Buffer.alloc(10);expected[0]=20;expected[1]=1;expected.writeInt32LE(450,2);expected.writeInt32LE(-600,6);
 assert.deepEqual(sent[0],[...expected]);
});
