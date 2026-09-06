/* Validate the generated release, including offline requests, without a browser. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const out=path.resolve(__dirname,'../dist');
 for(const file of ['package.json','tests','docs','tools','references','assets/art'])assert.ok(!fs.existsSync(path.join(out,file)),`Non-runtime file leaked: ${file}`);
 const index=fs.readFileSync(path.join(out,'index.html'),'utf8');
 const listeners={};let cached=new Set();const origin='https://zenflow.example';
 const sw=fs.readFileSync(path.join(out,'sw.js'),'utf8');
 const context={URL,self:{location:{origin},addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async()=>({match:async request=>cached.has(request.url)?{ok:true,offline:true}:undefined,addAll:async files=>{for(const file of files){const relative=file==='./'?'index.html':file.replace(/^\.\//,'');assert.ok(fs.existsSync(path.join(out,relative)),`Missing precache asset ${file}`);}cached=new Set(files.map(f=>new URL(f,origin+'/').href));}}),match:async()=>{throw Error('Must not read unrelated release caches');}},fetch:()=>Promise.reject(Error('Network offline'))};
 vm.createContext(context);vm.runInContext(sw+';globalThis.shell=SHELL;globalThis.cacheKey=CACHE;',context);
 assert.match(context.cacheKey,/^zenflow-racer-[a-f0-9]{14}$/,'Release cache should use content hash');
 let install;listeners.install({waitUntil:p=>install=p});await install;
 const resources=[...index.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(src=>!/^https?:/.test(src));
 for(const required of ['kart-assets.js','vendor/GLTFLoader.js','surface-detail.js','item-models.js','reference-polish.css','maps.js','kart-materials.js','kart-clips.js','racefx.js','item-art.js','abilities.js','effects.js','postfx.js','menu.js','vendor/three.min.js'])assert.ok(resources.includes(required),`Entrypoint must load ${required}`);
 const scripts=[...index.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 for(const [before,after] of [['vendor/three.min.js','vendor/GLTFLoader.js'],['vendor/GLTFLoader.js','kart-assets.js'],['kart-assets.js','game.js'],['surface-detail.js','world.js'],['vehicles.js','item-models.js'],['item-models.js','game.js'],['maps.js','world.js'],['kart-materials.js','vehicles.js'],['kart-clips.js','vehicles.js'],['vehicles.js','racefx.js'],['racefx.js','game.js'],['vehicles.js','item-art.js'],['item-art.js','game.js'],['vendor/three.min.js','world.js'],['fallback-renderer.js','world.js'],['effects.js','abilities.js'],['abilities.js','game.js'],['vehicles.js','game.js'],['vendor/anime.umd.min.js','menu.js']])assert.ok(scripts.indexOf(before)<scripts.indexOf(after),`${before} must load before ${after}`);
 for(const resource of ['./',...resources]){let response;listeners.fetch({request:{url:new URL(resource,origin+'/').href,method:'GET'},respondWith:p=>response=p});assert.equal((await response)?.offline,true,`Offline cache miss: ${resource}`);}
 assert.ok(!/assets\/art|art-gallery|<img\b/.test(index),'Runtime menus must not display reference artwork');
 for(const name of ['zenflow','collective','hybrid','nexus','kinetic','juris','signal','loom','vector','aether','animus','helix'])assert.ok(cached.has(new URL('assets/models/'+name+'.glb',origin+'/').href),'Playable GLB cached for offline launch: '+name);
 require('./software-renderer.cjs');
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.webmanifest'),'utf8'));
 assert.equal(manifest.display,'standalone');assert.ok(cached.has(new URL(manifest.start_url,origin+'/').href));
 for(const icon of manifest.icons){const bytes=fs.readFileSync(path.join(out,icon.src));assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);}
 console.log(`PASS release shell: ${resources.length} entrypoint resources load offline; script dependency order, manifest launch, icons and ${context.shell.length} cached assets verified.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
