"""Verify packaged files without external dependencies. Do not modify this tree first."""
from pathlib import Path
import hashlib, json, sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'PACKAGE_MANIFEST.json').read_text())
failed=[]
for item in manifest['files']:
    path=root/item['path']
    if not path.is_file(): failed.append(item['path']+' missing'); continue
    data=path.read_bytes()
    if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']: failed.append(item['path']+' mismatch')
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name not in {'PACKAGE_MANIFEST.json','FILES.sha256'}}
expected={v['path'] for v in manifest['files']}
failed += ['Unexpected file '+p for p in sorted(actual-expected)]
for line in (root/'FILES.sha256').read_text().splitlines():
    checksum,name=line.split('  ',1);path=root/name
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=checksum: failed.append(name+' checksum-list mismatch')
if failed: print('FAILED\n'+'\n'.join(failed)); sys.exit(1)
print(f"PASS: {len(expected)} package files plus manifest checksums; version {manifest['version']}")
