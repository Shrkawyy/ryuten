/* Merge observations by server identity, never by nickname, skin, position or radius.
 * Native per-connection worlds are read-only here. WindBine has two native tabs in
 * each connection, so the presentation world exposes four logical slots while keeping
 * every cell owned by its original native source.
 */
class SenpaMultiWorld {
  constructor(manager){this.m=manager;this.previousOwned=new Map();this.retired=new WeakSet();this.epoch=-1;this.affinity=new Map();}
  reset(){this.affinity.clear();this.previousOwned.clear();this.retired=new WeakSet();}
  build(){
    const m=this.m,p=m.primary;
    if(!m.multi)return p.world;
    if(this.epoch!==m.generation){this.epoch=m.generation;this.reset();}
    const a=m.aux?.host;
    const sources=[p];
    if(a?.network.connected&&a.network.url===p.network.url&&a.border.right-a.border.left===p.border.right-p.border.left)sources.push(a);
    const clientsList=new Map(),playersList=new Map(),minimapPlayers=new Map(),cells=new Map();
    const ownedClientIDs=new Set(),ownerSlots=new Map(),myPlayerIDs=[],myCells=[];
    const sourceSlots=m.sourceSlotCount||2;
    sources.forEach((h,sourceIndex)=>{
      const w=h.world;
      if(w.myClientID>=0)ownedClientIDs.add(w.myClientID);
      for(let native=0;native<sourceSlots;native++){
        const logical=sourceIndex*sourceSlots+native,id=w.myPlayerIDs[native];
        if(Number.isInteger(id)){ownerSlots.set(id,logical);myPlayerIDs[logical]=id;}
        myCells[logical]=w.myCells[native]||m.empty;
      }
      const ownIDs=new Set(w.myPlayerIDs);
      for(const [id,c]of w.clientsList)if(!clientsList.has(id)||id===w.myClientID)clientsList.set(id,c);
      for(const [id,player]of w.playersList)if(!playersList.has(id)||ownIDs.has(id))playersList.set(id,player);
      for(const [id,v]of w.minimapPlayers)if(!minimapPlayers.has(id)||ownIDs.has(id))minimapPlayers.set(id,v);
    });
    const liveOwned=new Map();
    sources.forEach((h,sourceIndex)=>{
      for(let native=0;native<sourceSlots;native++){
        const logical=sourceIndex*sourceSlots+native;
        for(const [id,c]of h.world.myCells[native]||[]){if(!c.removed)liveOwned.set(id,{cell:c,slot:logical,parent:c.parentPlayerID});}
      }
    });
    // Retire stale copies of a definitively dead OWN cell, not arbitrary overlapping enemies.
    for(const [id,old]of this.previousOwned){
      if(liveOwned.get(id)?.cell===old.cell)continue;
      for(const h of sources){const peer=h.world.cells.get(id);if(peer&&peer!==liveOwned.get(id)?.cell&&peer.parentPlayerID===old.parent)this.retired.add(peer);}
    }
    this.previousOwned=liveOwned;
    const chosen=new Map();
    sources.forEach((h,sourceIndex)=>{
      const offset=sourceIndex?m.aux?.clockOffset||0:0;
      for(const [key,cell]of h.world.cells){
        if(this.retired.has(cell)&&!cell.removed)continue;
        const own=liveOwned.get(cell.id),ownerSlot=ownerSlots.get(cell.parentPlayerID);
        if(own&&own.cell!==cell)continue;
        // Cell ids are global in the captured protocol. Removal suffix is kept separate for one native fade.
        const canonical=cell.removed?String(cell.id)+':removed':cell.id;
        const sourceSlot=ownerSlot??sourceIndex*sourceSlots;
        const candidate={cell,sourceIndex,sourceSlot,at:(cell.updateTime||0)+offset,owned:ownerSlot===sourceSlot};
        const prior=chosen.get(canonical);
        const preferred=this.affinity.get(canonical);
        if(!prior||candidate.owned&&!prior.owned||candidate.owned===prior.owned&&(candidate.sourceIndex===preferred&&prior.sourceIndex!==preferred||preferred==null&&candidate.at>prior.at))chosen.set(canonical,candidate);
      }
    });
    for(const key of this.affinity.keys())if(!chosen.has(key))this.affinity.delete(key);
    for(const [key,v]of chosen){cells.set(key,v.cell);this.affinity.set(key,v.sourceIndex);}
    // Own markers are available from authoritative local cells even without server radar packets.
    sources.forEach((h,sourceIndex)=>{
      for(let native=0;native<sourceSlots;native++){
        const logical=sourceIndex*sourceSlots+native,id=h.world.myPlayerIDs[native],set=myCells[logical];if(!Number.isInteger(id)||!set?.size)continue;
        let x=0,y=0,area=0,n=0;for(const c of set.values()){if(c.removed)continue;x+=c.x;y+=c.y;area+=c.radius*c.radius;n++;}
        if(n)minimapPlayers.set(id,{id,x:x/n,y:y/n,radius:Math.sqrt(area)});
      }
    });
    const activeHost=m.host(m.active)||p;
    return {clientsList,playersList,minimapPlayers,cells,myClientID:activeHost.world.myClientID,myPlayerIDs,myCells,
      ownedClientIDs,ownerSlots,activeSlot:m.active,activePair:m.activePair,isMultibox:true};
  }
}

