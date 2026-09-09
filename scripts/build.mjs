import { cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
// Only ship runtime assets. New documentation, exports and local files stay private.
const runtime=['reconstruction-review.js','responsive-review.html','race-telemetry.js','index.html','core.js','surface-detail.js','kart-materials.js','kart-clips.js','racefx.js','fallback-renderer.js','maps.js','world-motion-data.js','living-world.js','natural-stone-data.js','natural-world.js','world.js','immersion.js','vehicles.js',
 'addons.js','addon-effects.js','addon-ui.js','addon-ui.css','kart-assets.js','item-art.js','item-models.js','effects.js','abilities.js','postfx.js','game.js','title-attract.js','menu.js','pwa.js','polish.css','reference-polish.css',
 'presentation.js','presentation.css','fonts.css','manifest.webmanifest','vendor','icons','assets'];
for(const file of runtime){
 await mkdir(path.dirname(path.join(out,file)),{recursive:true});
 await cp(path.join(root,file),path.join(out,file),{recursive:true,filter:source=>!source.split(path.sep).includes('art')});
}
// Bind exported diagnostic reports to the code that was actually deployed.
let release=process.env.VERCEL_GIT_COMMIT_SHA;
if(!release){try{release=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{release='development';}}
if(!/^[a-f0-9]{40}$/.test(release))release='development';
const html=await readFile(path.join(out,'index.html'),'utf8');
await writeFile(path.join(out,'index.html'),html.replace('</head>',`<meta name="zenflow-release" content="${release}">\n</head>`));
// Version every application byte so an installed game updates as a coherent release.
const assets=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else if(e.name!=='sw.js')assets.push(path.relative(out,f).split(path.sep).join('/'));}}
await walk(out);assets.sort();
const hash=createHash('sha256');for(const f of assets){hash.update(f);hash.update(await readFile(path.join(out,f)));}
const cache='zenflow-racer-'+hash.digest('hex').slice(0,14);
const shell=['./',...assets.filter(f=>/\.(js|css|html|webmanifest|png|jpg|jpeg|webp|glb|ttf|woff2)$/.test(f)).map(f=>'./'+f)];
await writeFile(path.join(out,'sw.js'),`const CACHE=${JSON.stringify(cache)};const SHELL=${JSON.stringify(shell)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('zenflow-racer-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.open(CACHE).then(cache=>cache.match(e.request,{ignoreSearch:e.request.mode==='navigate'})).then(c=>c||fetch(e.request)));});\n`);
console.log('Static game built in dist/');
