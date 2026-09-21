(()=>{
 const h=SENPA_HOST,port=SENPA_PORT,rp=port.child,r=rp.reference;
 const assert=(condition,message)=>{if(!condition)throw Error(message);};
 class Writer{
  constructor(op){this.b=[];this.u8(op);} u8(n){this.b.push(n&255);return this;}u16(n){return this.u8(n).u8(n>>8);}u32(n){return this.u16(n).u16(n>>>16);}i32(n){return this.u32(n>>>0);}s8(s){this.u8(s.length);for(const c of s)this.u8(c.charCodeAt(0));return this;}s16(s){this.u8(s.length);for(let i=0;i<s.length;i++)this.u16(s.charCodeAt(i));return this;}send(){h.parser.parse(Uint8Array.from(this.b).buffer);return this;}}
 const world=(adds=[],updates=[],remove=[],eaten=[])=>{const w=new Writer(20).u16(eaten.length);for(const[a,b]of eaten)w.u32(a).u32(b);w.u16(adds.length);for(const x of adds){w.u32(x.id).i32(x.x).i32(x.y).u16(x.radius).u8(x.type??0);if((x.type??0)===0)w.u16(x.parent).u8(x.r??255).u8(x.g??0).u8(x.b??100);else if(x.type===2)w.u8(255).u8(40).u8(70);}w.u16(updates.length);for(const x of updates)w.u32(x.id).i32(x.x).i32(x.y).u16(x.radius);w.u16(remove.length);for(const id of remove)w.u32(id);w.send();};
  const advance=()=>{h.player.update(performance.now());h.camera.update();h.world.update(performance.now());port.flushActions();rp.frame(performance.now());};
  const makeCell=(id,x,y,radius,parent=100,type=0)=>{const cell=new h.Cell(id,x,y,radius,type);cell.parentPlayerID=parent;cell.removed=false;return cell;};
  const mergedModel=(cells,activeSlot=0)=>({
   clientsList:h.world.clientsList,playersList:h.world.playersList,minimapPlayers:h.world.minimapPlayers,
   cells:new Map(cells.map(cell=>[cell.removed?String(cell.id)+':removed':cell.id,cell])),myClientID:h.world.myClientID,
   myPlayerIDs:h.world.myPlayerIDs.slice(),myCells:h.world.myCells,ownedClientIDs:new Set([h.world.myClientID]),
   ownerSlots:new Map(h.world.myPlayerIDs.map((id,index)=>[id,index])),activeSlot,isMultibox:true
  });
  const fixture={h,port,rp,r,assert,Writer,world,advance,makeCell,mergedModel,sent:[]};
 fixture.connect=()=>{h.network.ws={readyState:1,send:data=>fixture.sent.push(Array.from(new Uint8Array(data))),close(){this.readyState=3;}};h.network.url='eu1.senpa.io:7101';h.network.isReplay=false;new Writer(0).u32(16000).u16(41).u8(2).u16(100).u16(101).send();new Writer(8).send();new Writer(10).u8(2).u16(41).u8(0).s16('Our tester').s16('Team').u8(255).u8(0).u8(100).u8(0).s16('').u16(42).u8(0).s16('Friend').s16('Team').u8(0).u8(200).u8(255).u8(0).s16('').u8(0).u8(0).send();const p=new Writer(11).u8(3);for(const[id,cid,red,green,blue]of[[100,41,255,0,100],[101,41,0,150,255],[102,42,40,255,180]])p.u16(id).u16(cid).u8(red).u8(green).u8(blue).s8('').u32(0);p.u8(0).u8(0).send();advance();};
 window.FIXTURE=fixture;
 return {nativeSettings:Object.keys(h.settingsStore.definitions).length,ryutenSettings:Object.keys(r.Q).length,nativeMethods:{cell:typeof h.Cell.prototype.animate,camera:typeof h.camera.update,wasm:typeof h.wasm.create}};
})()
