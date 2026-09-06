import { cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const omit=new Set(['dist','node_modules','scripts','tests','docs','tools','.git','.vercel','package.json','package-lock.json','vercel.json','README.md']);
for(const entry of await readdir(root,{withFileTypes:true})){
 if(omit.has(entry.name)||entry.name.startsWith('.')) continue;
 await cp(path.join(root,entry.name),path.join(out,entry.name),{recursive:true});
}
// Version every application byte so an installed game updates as a coherent release.
const assets=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else if(e.name!=='sw.js')assets.push(path.relative(out,f).split(path.sep).join('/'));}}
await walk(out);assets.sort();
const hash=createHash('sha256');for(const f of assets){hash.update(f);hash.update(await readFile(path.join(out,f)));}
const cache='zenflow-racer-'+hash.digest('hex').slice(0,14);
const shell=['./',...assets.filter(f=>/\.(js|css|html|webmanifest|png|jpg|jpeg|webp)$/.test(f)).map(f=>'./'+f)];
await writeFile(path.join(out,'sw.js'),`const CACHE=${JSON.stringify(cache)};const SHELL=${JSON.stringify(shell)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('zenflow-racer-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));});\n`);
console.log('Static game built in dist/');
