

/* Senpa world targets and lifetimes are authoritative.
 * Draw native Senpa coordinates or sample the independently selected Ryuten client profile.
 * No duplicate socket or stacked position/camera interpolator. */
(() => {
    'use strict';
    const rp = window.RYUTEN_PORT;
    class WorldBridge {
        constructor(host, reference) {
            this.h = host;
            this.r = reference;
            this.cells = new Map();
            this.clients = new Map();
            this.players = new Map();
            this.nextView = 1;
            this.offset = 0;
            this.lastSide = 0;
            this.lastClientId = -999;
            this.model=host.world;this.selfGroup=null;
            this.frameCount = 0;this.seen=new Set();
            reference.Be._2997 = (slot, alive) => { reference.Be._7330[slot] = alive; reference.Be._6881 = reference.Be._7330.some(Boolean); };
        }
        reset() { rp.motion?.reset();rp.cosmetics?.reset(); this.cells.clear(); this.clients.clear(); this.players.clear(); this.r.ne._6212(); this.r.Be._6212(); this.lastClientId = -999; this.nextView = 1;this.selfGroup=null; }
        client(id, source) { let c = this.clients.get(id); if (!c) {
            c = new this.r.p(id, '', '', '', 0, ['', 0], '');
            this.clients.set(id, c);
            this.r.ne._2708.set(id, c);
        } const own = id>=0&&(this.model.ownedClientIDs?this.model.ownedClientIDs.has(id):id===this.h.world.myClientID); c._9710 = own; c._6988 = String(source?.nick || (own ? this.h.player.nick : '') || 'Unnamed player'); c._senpaTeamId = String(source?.tag || ''); c._senpaClanTag = String(source?.clanTag || ''); c._9067 = c._senpaTeamId || c._senpaClanTag; c._8313 = own && rp.shieldsEnabled ? (this.r.pe._2874.shield || '') : ''; if (own && !this.model.isMultibox) {
            this.r.Be._4167 = id;
            this.r.Be._1059 = c;
        } c._senpaNameColor=rp.nameColor(source?.teamColor);return c; }
        player(id, source) { let p = this.players.get(id); if (!p) {
            p = this.r.ne._2986(id, new this.r.y(133, 133, 133), '');
            this.players.set(id, p);
        } const index = this.model.ownerSlots?.get(id) ?? this.model.myPlayerIDs.indexOf(id); const own = index >= 0; const cid = this.model.isMultibox?(source?.parentClientID??-1):own ? this.h.world.myClientID : (source?.parentClientID ?? -1); const client = this.client(cid, this.model.clientsList.get(cid) || source?.parentClient); if (p._1059 !== client) {
            if (p._1059 && p._1059 !== this.r.f)
                p._1059._4221.delete(id);
            p._1059 = client;
            client._4221.set(id, p);
        } p._3090 = own ? index : Math.max(0, [...client._4221.keys()].indexOf(id)); p._6728._4659(source?.r ?? 133, source?.g ?? 133, source?.b ?? 133); const ownClient = this.model.clientsList.get(this.h.world.myClientID); const teammate = cid === this.h.world.myClientID || !!(ownClient?.tag && ownClient.tag === client._senpaTeamId); const showSkin = this.h.settings.cellSkin && (own || (teammate ? this.h.settings.teammateCellSkin : this.h.settings.enemyCellSkin)); const local=own&&this.model.isMultibox?rp.parentPort.multibox.profile(rp.parentPort.multibox.profileIndex(index)):null;const skin = showSkin ? (local?.skinMode==='none'?'':local?.skinMode==='url'?local.url:rp.resolveSkinURL(source?.skinURL || '')) : ''; if (p._3661 !== skin)
            p._3661 = skin; if (own && !this.r.Be._6328[index])
            this.r.Be._6328[index] = new this.r.g; return p; }
        remove(key, entry) { if (entry.view._2182 !== this.r.C)
            entry.view._2182._2430.delete(entry.view._9782); this.r.ne._2430.delete(entry.view._9782); this.cells.delete(key); }
        sync() {
            const base=this.h;this.model=rp.parentPort.multibox?.worldView?.build()||base.world;
            const h={...base,world:this.model},r=this.r,side=Math.max(1,h.border.right-h.border.left);
            this.offset = (65535 - side) / 2 - h.border.left;
            if (this.lastSide !== side) {
                r.ne._2908(side);
                this.lastSide = side;
            }
            if (this.lastClientId !== h.world.myClientID) {
                this.lastClientId = h.world.myClientID;
            }
            for (const [id, c] of h.world.clientsList)
                this.client(id, c);
            for (const [id, p] of h.world.playersList)
                this.player(id, p);
            if (h.world.myClientID >= 0) {
                this.client(h.world.myClientID, h.world.clientsList.get(h.world.myClientID));
                for (const id of h.world.myPlayerIDs)
                    this.player(id, h.world.playersList.get(id));
            }
            const seen=this.seen;seen.clear();
            for (const [key, cell] of h.world.cells) {
                if (cell.type < 0 || cell.type > 3 || cell.type === 3 && !h.settings.pellets)
                    continue;
                seen.add(key);
                let entry = this.cells.get(key);
                if (entry && entry.source !== cell) {
                    if(this.model.isMultibox && entry.source.id===cell.id && entry.source.parentPlayerID===cell.parentPlayerID && !entry.source.removed && !cell.removed){
                        // The view outlives either mirrored native Cell object.
                        rp.motion?.rebind(entry.source,cell,rp.motion.frameNow);
                        entry.source=cell;entry.view._senpaSource=cell;
                    }else{this.remove(key,entry);entry=null;}
                }
                if (!entry) {
                    const view = r.ne._9190(this.nextView++, cell.x + this.offset, cell.y + this.offset, Math.max(0, cell.radius), [1, 3, 2, 4][cell.type] ?? 1);
                    entry = { source: cell, view };
                    this.cells.set(key, entry);
                    view._senpaSource = cell;
                    view._senpaBridge = this;
                    view._5792 = function () { const s = this._senpaSource, o = this._senpaBridge.offset, pose=rp.motion?.sample(s)||{x:s.x,y:s.y,r:s.radius,u:s.dt}; this._7847 = pose.x + o; this._9202 = pose.y + o; this._1904 = Math.max(0, pose.r); this._5277 = s.endX + o; this._1299 = s.endY + o; this._3933 = Math.max(0, s.endRadius); this._9491 = !!s.removed; this._8215 = pose.u; };
                    Object.defineProperty(view, '_2427', { get: () => entry.source.removed ? Math.max(0, 1 - view._8215) : 1 });
                }
                const view = entry.view;
                view._5792();
                view._7926 = [1, 3, 2, 4][cell.type] ?? 1;
                const parent = (cell.parentPlayerID >= 0) ? this.player(cell.parentPlayerID, h.world.playersList.get(cell.parentPlayerID) || cell.parentPlayer) : r.C;
                if (view._2182 !== parent) {
                    if (view._2182 !== r.C)
                        view._2182._2430.delete(view._9782);
                    view._2182 = parent;
                    if (parent !== r.C && !cell.removed)
                        parent._2430.set(view._9782, view);
                }
                if (cell.removed && parent !== r.C)
                    parent._2430.delete(view._9782);
                if (cell.color&&entry.lastColor!==cell.color) {
                    entry.lastColor=cell.color;const rgb = parseInt(String(cell.color).replace('#', ''), 16);
                    if (Number.isFinite(rgb))
                        view._6728._4659((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
                }
            }
            for (const [key, entry] of this.cells)
                if (!seen.has(key))
                    this.remove(key, entry);
            if(this.model.isMultibox){
                this.selfGroup??=new r.p(-2,'','','',0,['',0],'');this.selfGroup._9710=true;this.selfGroup._4221.clear();
                for(const id of h.world.myPlayerIDs){const p=this.players.get(id);if(p)this.selfGroup._4221.set(id,p);}
                r.Be._4167=h.world.myClientID;r.Be._1059=this.selfGroup;
            }
            r.Be._7330 = h.world.myCells.map(c => c.size > 0);
            r.Be._6881 = this.model.isMultibox?r.Be._7330.some(Boolean):!!h.player.isAlive;
            r.Be._4409 = this.model.isMultibox?this.model.activeSlot:Math.max(0,h.player.activeTab||0);
            r.Be._8709 = h.player.nick;
            r.Be._6448 = h.player.teamTag;
            if (++this.frameCount % 30 === 0) {
                for (const [id, p] of this.players)
                    if (!h.world.playersList.has(id) && !h.world.myPlayerIDs.includes(id) && !p._2430.size) {
                        p._1059?._4221.delete(id);
                        r.ne._4221.delete(id);
                        this.players.delete(id);
                    }
                for (const [id, c] of this.clients)
                    if (!h.world.clientsList.has(id) && !h.world.ownedClientIDs?.has(id) && id !== h.world.myClientID && !c._4221.size) {
                        this.clients.delete(id);
                        r.ne._2708.delete(id);
                    }
            }
            const teamSeen = new Set();
            for (const [id, member] of h.world.minimapPlayers) {
                const p = this.players.get(id);
                if (!p)
                    continue;
                teamSeen.add(id);
                let m = r.ne._8202.get(id);
                if (!m) {
                    m = r.ne._5492(id, p);
                    m._5792 = () => { };
                }
                m._6771 = true;
                m._2182 = p;
                m._7847 = m._5277 = member.x + this.offset;
                m._9202 = m._1299 = member.y + this.offset;
                m._7906 = Math.max(0, member.radius * member.radius / 100);
            }
            for (const id of r.ne._8202.keys())
                if (!teamSeen.has(id))
                    r.ne._8202.delete(id);
        }
        camera() { if(rp.motion?.camera())return; const r = this.r, h = this.h; const scale = r.X_._3473 / Math.max(1, window.innerWidth); r.z_._3852._5117(h.camera.x + this.offset, h.camera.y + this.offset); r.z_._4336 = Math.max(.0001, h.camera.zoom * scale); r.z_._9695(); }
        snapshot() { return { views: this.cells.size, nativeCells: (this.model||this.h.world).cells.size, players: this.players.size, ownFragments: (this.model||this.h.world).myCells.map(x => x.size), active: this.model?.isMultibox?this.model.activeSlot:this.h.player.activeTab, animationMs: this.h.settings.cellAnimation, style: rp.motion?.style||'Senpa', ryutenAnimationMs:rp.motion?.delay, camera: { x: this.h.camera.x, y: this.h.camera.y, zoom: this.h.camera.zoom } }; }
    }
    rp.modules.WorldBridge = WorldBridge;
})();