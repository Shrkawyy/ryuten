// Probe the supplied, unmodified renderer WASM; no browser or network required.
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('src/snapshot/ryutenJS.js',root),'utf8');
const end=source.search(/},\d+:/);
const factory=Function('return '+source.slice('(()=>{var t,_,e={526:'.length,end+1))();
globalThis.document={createElement:()=>({getContext:()=>({})})};
globalThis.window={dispatchEvent:()=>{}};
let ready;const done=new Promise(resolve=>ready=resolve);
globalThis.RYUTEN_PORT={wasmBytes:fs.readFileSync(new URL('src/snapshot/ryutenWasm.wasm',root)),wasmReadyResolve:()=>setTimeout(ready,0)};
const mod={};factory(mod);await done;
const result=[];
for(const side of [10000,14000,32767]){
 mod.exports.mesh_gen_border_update_buffers(side,250,0xff0000,20,0xffffff);
 const buffers=mod.exports.mesh_gen_border_get_buffers();
 result.push({side,buffers:buffers.map(v=>({length:v.length,nonzero:[...v].filter(n=>n!==0).length}))});
}
console.log(JSON.stringify({kind:'ORIGINAL_WASM_PROBE',result},null,2));
