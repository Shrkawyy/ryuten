// Reproducible local build from the exact attached full-shields XPLUS500 payload.
// Frozen compiled snapshots preserve previous verified build seams. Changes belong
// in src/app or guarded transforms below, never in a network/protocol snapshot.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const layout=JSON.parse(read('source-layout.json')),pkg=JSON.parse(read('package.json'));
const baseline=process.argv.includes('--baseline');
const record=JSON.parse(read('references/RECOVERED_BASELINE.json'));
for(const [file,hash] of Object.entries(record.snapshotHashes))if(sha(fs.readFileSync(path.join(root,file)))!==hash)throw Error('Frozen snapshot changed: '+file);
const payload={};
for(const key of layout.payloadOrder){
 if(key==='version')payload[key]=baseline?layout.baselineVersion:pkg.version;
 else if(key==='buildVariant')payload[key]=layout.buildVariant;
 else if(key==='childScripts'){
  const names=[...layout.childModules];if(!baseline)names.splice(names.indexOf('presentation'),0,'mass-labels');
  payload[key]=baseline?read('src/snapshot/childScripts.original.js'):names.map(n=>read('src/app/'+n+'.js')).join('')+'\n';
 }else{const f=layout.fields[key];const data=fs.readFileSync(path.join(root,f.path));payload[key]=f.encoding==='json'?JSON.parse(data):data.toString(f.encoding);}
}
const patches=[];
const once=(s,needle,replacement,label)=>{const n=s.split(needle).length-1;if(n!==1)throw Error(label+': expected one source seam, found '+n);patches.push(label);return s.replace(needle,replacement);};
if(!baseline){
 // Cells/names retain source colors. Mass glyphs have white fill plus their own
 // opaque black stroke; never multiply the numeral texture by name/game tint.
 payload.ryutenJS=once(payload.ryutenJS,'e.children.forEach(s=>s.tint=globalThis.RYUTEN_PORT.nameTint(t))','e.children.forEach(s=>s.tint=0xffffff)','Mass color independent of name/game color');
}
let begin=read('src/snapshot/begin.js');
if(!baseline){
 begin=begin.replace('// @version      '+layout.baselineVersion,'// @version      '+pkg.version)
 .replace('// @name         Ryuten for Senpa — XPLUS 500 Test — Full Shields','// @name         Ryuten for Senpa — XPLUS 500 — Full Shields — Border Teamtag FFA Fix')
 .replace(/^\/\/ @description.*$/m,'// @description  Border geometry, Teamtag labels and nearby FFA spawn requests; includes existing held feed fixes. Disable older port versions.');
}
const parentSource=n=>{
 if(baseline&&n==='multibox'){const original=read('references/multibox.before-held-feed.js');if(sha(original)!=='3ed126ac691d0b99f21ae9c3e170406d3b5d776aeed9bbb8abcab4c60b18a1b5')throw Error('Baseline multibox oracle changed');return original;}
 return read('src/app/'+n+'.js');
};
const activeParents=layout.parentModules.filter(n=>!(baseline&&n==='bots'));const tail=read('src/snapshot/after-payload.js')+activeParents.map(parentSource).join('')+read('src/snapshot/end.js');
const output=begin+JSON.stringify(payload)+tail;
for(const [name,text] of Object.entries({userscript:output,child:payload.childScripts,senpa:payload.senpaJS,ryuten:payload.ryutenJS}))new vm.Script(text,{filename:name+'.js'});
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
if(baseline){if(sha(output)!==record.baselineSHA256)throw Error('Baseline reconstruction is not byte-identical');console.log('Baseline reconstructed byte-identically',Buffer.byteLength(output),sha(output));}
else{
 fs.writeFileSync(path.join(root,'dist/RYUTEN-Senpa.user.js'),output);
 fs.writeFileSync(path.join(root,'dist/build-manifest.json'),JSON.stringify({version:pkg.version,buildVariant:layout.buildVariant,bytes:Buffer.byteLength(output),sha256:sha(output),baselineSHA256:record.baselineSHA256,patches,networkSnapshotUnchanged:true,assetFilesLocal:true},null,2)+'\n');
 console.log('Built',pkg.version,Buffer.byteLength(output),sha(output));
}

// Stage the install page and its linked files for static hosting.
if (!baseline) {
 const publicRoot = path.join(root, 'public');
 fs.mkdirSync(publicRoot, {recursive:true});
 for (const item of ['dist', 'verification']) {
  fs.cpSync(path.join(root, item), path.join(publicRoot, item), {recursive:true});
 }
 const manifest = JSON.parse(read('dist/build-manifest.json'));
 const page = read('index.html')
  .replace(/1\.2\.1-xplus\.\d+/g, pkg.version)
  .replace(/(<code>)[a-f0-9]{64}(<\/code>)/, '$1' + manifest.sha256 + '$2');
 fs.writeFileSync(path.join(publicRoot, 'index.html'), page);
 for (const item of ['README.md', 'NOTICE.md']) {
  fs.copyFileSync(path.join(root, item), path.join(publicRoot, item));
 }
 console.log('Static site ready: public/index.html');
}
