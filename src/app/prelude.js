(() => {
    'use strict';
    const rp = window.RYUTEN_PORT;
    rp.modules = {};
    rp.status = { phase: 'initializing', ready: false, renderer: 'pending' };
    rp.listeners = [];
    rp.shieldsEnabled = rp.build.variant !== 'no-shields';
    rp.localInventory = rp.shieldsEnabled;
    rp.nativeStorage = { getItem: k => localStorage.getItem('ryuten.senpa.v1.native.' + k), setItem: (k, v) => localStorage.setItem('ryuten.senpa.v1.native.' + k, v), removeItem: k => localStorage.removeItem('ryuten.senpa.v1.native.' + k) };
    rp.setting = (key, fallback) => { try {
        const v = JSON.parse(localStorage.getItem('ryuten.senpa.v1.preferences') || '{}');
        return key in v ? v[key] : fallback;
    }
    catch {
        return fallback;
    } };
    rp.saveSetting = (key, value) => { let v = {}; try {
        v = JSON.parse(localStorage.getItem('ryuten.senpa.v1.preferences') || '{}');
    }
    catch { } v[key] = value; localStorage.setItem('ryuten.senpa.v1.preferences', JSON.stringify(v)); };
    rp.log = (level, event, detail = {}) => rp.parentPort.log(event, detail);
    rp.on = (target, event, fn, options) => { target.addEventListener(event, fn, options); rp.listeners.push(() => target.removeEventListener(event, fn, options)); };
    rp.timeout = (promise, ms, label) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error(label + ' timed out')), ms); Promise.resolve(promise).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); }); });
    rp.missingAssets=new Set();
    rp.asset = url => {
        const raw=String(url||'');if(/^(data:|blob:)/.test(raw))return raw;
        if(rp.assets[raw])return rp.assets[raw];
        let key=raw.replace(/^\.\//,'');
        try{if(/^https?:/.test(key)){
            const u=new URL(key);
            // Account/opponent media is server-supplied data, not executable client code.
            // A local asset pack may override its exact URL above.
            if(!['ryuten.io','www.ryuten.io'].includes(u.hostname))return raw;
            key=u.pathname.replace(/^\/(play\/)?/,'');
        }}catch{}
        key=key.split(/[?#]/)[0];if(rp.assets[key])return rp.assets[key];
        rp.missingAssets.add(key);return rp.assets['local/missing.svg'];
    };
    rp.request = async (url, type = 'text', ms = 10000) => { const control = new AbortController(), timer = setTimeout(() => control.abort(), ms); try {
        const response = await fetch(url, { credentials: 'omit', signal: control.signal });
        if (!response.ok)
            throw Error('HTTP ' + response.status);
        return type === 'json' ? await response.json() : type === 'arraybuffer' ? await response.arrayBuffer() : await response.text();
    }
    finally {
        clearTimeout(timer);
    } };
    rp.loadImage = async (url) => { const image = new Image(); image.crossOrigin = 'anonymous'; image.decoding = 'async'; image.src = rp.asset(url); await image.decode(); return image; };
    rp.createAudio = url => { const sound = new Audio(); sound.preload = 'none'; const play = sound.play.bind(sound); sound.play = () => { if (!sound.src)
        sound.src = rp.asset(url); return play().catch(() => { }); }; return sound; };
    rp.referencePromise = new Promise(resolve => rp.referenceResolve = resolve);
    rp.wasmPromise = new Promise(resolve => rp.wasmReadyResolve = resolve);
    rp.el = (tag, attributes = {}, text) => { const element = document.createElement(tag); for (const [k, v] of Object.entries(attributes)) {
        if (k in element)
            element[k] = v;
        else
            element.setAttribute(k, v);
    } if (text != null)
        element.textContent = text; return element; };
    rp.download = (name, content, type = 'application/json') => { const url = URL.createObjectURL(new Blob([content], { type })); const a = rp.el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); };
})();