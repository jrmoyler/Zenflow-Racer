/* Validate the generated release, including offline requests, without a browser. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const out=path.resolve(__dirname,'../dist');
 for(const file of ['package.json','tests','docs','tools','references','assets/art'])assert.ok(!fs.existsSync(path.join(out,file)),`Non-runtime file leaked: ${file}`);
 const index=fs.readFileSync(path.join(out,'index.html'),'utf8');
 const listeners={};let cached=new Set(),activated=0;const origin='https://zenflow.example';
 const sw=fs.readFileSync(path.join(out,'sw.js'),'utf8');
 const context={URL,self:{location:{origin},skipWaiting:()=>activated++,addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async()=>({match:async (request,options)=>cached.has(options?.ignoreSearch?request.url.split('?')[0]:request.url)?{ok:true,offline:true}:undefined,addAll:async files=>{for(const file of files){const relative=file==='./'?'index.html':file.replace(/^\.\//,'');assert.ok(fs.existsSync(path.join(out,relative)),`Missing precache asset ${file}`);}cached=new Set(files.map(f=>new URL(f,origin+'/').href));}}),match:async()=>{throw Error('Must not read unrelated release caches');}},fetch:()=>Promise.reject(Error('Network offline'))};
 vm.createContext(context);vm.runInContext(sw+';globalThis.shell=SHELL;globalThis.cacheKey=CACHE;',context);
 assert.equal(activated,0);listeners.message({data:{type:'OTHER'}});assert.equal(activated,0);listeners.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(activated,1,'only explicit update activates a waiting worker');
 assert.match(context.cacheKey,/^zenflow-racer-[a-f0-9]{14}$/,'Release cache should use content hash');
 let install;listeners.install({waitUntil:p=>install=p});await install;
 const resources=[...index.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(src=>!/^https?:/.test(src));
 for(const required of ['addons.js','addon-effects.js','addon-ui.js','addon-ui.css','presentation.js','presentation.css','fonts.css','kart-assets.js','vendor/GLTFLoader.js','surface-detail.js','item-models.js','reference-polish.css','maps.js','immersion.js','kart-materials.js','kart-clips.js','racefx.js','item-art.js','abilities.js','effects.js','postfx.js','menu.js','vendor/three.min.js'])assert.ok(resources.includes(required),`Entrypoint must load ${required}`);
 const scripts=[...index.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 for(const [before,after] of [['vendor/three.min.js','vendor/GLTFLoader.js'],['vendor/GLTFLoader.js','kart-assets.js'],['kart-assets.js','game.js'],['surface-detail.js','world.js'],['vehicles.js','item-models.js'],['item-models.js','game.js'],['maps.js','world.js'],['world.js','immersion.js'],['immersion.js','game.js'],['kart-materials.js','vehicles.js'],['kart-clips.js','vehicles.js'],['vehicles.js','racefx.js'],['racefx.js','game.js'],['vehicles.js','item-art.js'],['item-art.js','game.js'],['vendor/three.min.js','world.js'],['fallback-renderer.js','world.js'],['effects.js','abilities.js'],['abilities.js','addons.js'],['addons.js','addon-effects.js'],['addon-effects.js','game.js'],['game.js','addon-ui.js'],['abilities.js','game.js'],['vehicles.js','game.js'],['vendor/anime.umd.min.js','menu.js']])assert.ok(scripts.indexOf(before)<scripts.indexOf(after),`${before} must load before ${after}`);
 for(const resource of ['./',...resources]){let response;listeners.fetch({request:{url:new URL(resource,origin+'/').href,method:'GET'},respondWith:p=>response=p});assert.equal((await response)?.offline,true,`Offline cache miss: ${resource}`);}
 let navigation;listeners.fetch({request:{url:origin+'/index.html?review=podium',method:'GET',mode:'navigate'},respondWith:p=>navigation=p});assert.equal((await navigation)?.offline,true,'query navigation must stay on the same cached release');
 assert.ok(!/assets\/art|art-gallery/.test(index),'Reference sheets must not be shipped as gameplay scenery');
 const cardImages=[...index.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(cardImages,['cherry','stormforge','canopy'].map(id=>'assets/map-cards/'+id+'.webp'),'Only the three explicitly commissioned circuit-card images are embedded');
 for(const image of cardImages)assert.ok(cached.has(new URL(image,origin+'/').href),'Circuit artwork works offline: '+image);
 for(const name of ['zenflow','collective','hybrid','nexus','kinetic','juris','signal','loom','vector','aether','animus','helix','ledger','terra','obsidian','civic','cognara','gaia','nomad','eon'])assert.ok(cached.has(new URL('assets/models/'+name+'.glb',origin+'/').href),'Playable GLB cached for offline launch: '+name);
 require('./software-renderer.cjs');
 for(const font of ['orbitron-700','orbitron-800','rajdhani-500','rajdhani-700'])assert.ok(cached.has(new URL('assets/fonts/'+font+'.ttf',origin+'/').href),'Font available offline: '+font);
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.webmanifest'),'utf8'));
 assert.equal(manifest.display,'standalone');assert.ok(cached.has(new URL(manifest.start_url,origin+'/').href));
 for(const icon of manifest.icons){const bytes=fs.readFileSync(path.join(out,icon.src));assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);}
 console.log(`PASS release shell: ${resources.length} entrypoint resources load offline; script dependency order, manifest launch, icons and ${context.shell.length} cached assets verified.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
