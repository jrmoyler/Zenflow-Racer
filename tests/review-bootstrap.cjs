const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const pwa=fs.readFileSync('pwa.js','utf8');
 for(const hostname of ['localhost','127.0.0.1','[::1]','terminal.local']){
  const events={},removed=[],deleted=[],href=`http://${hostname}/racer/index.html`;
  const reg=(path,key,slot='active')=>({[slot]:{scriptURL:new URL(path,href).href},unregister:async()=>removed.push(key)});
  const context={URL,location:{protocol:'http:',hostname,href},navigator:{serviceWorker:{getRegistrations:async()=>[reg('./sw.js','racer'),reg('/other/sw.js','other'),reg('./sw.js','waiting','waiting')],register:()=>{throw Error('Local registration is disabled');}}},document:{getElementById:()=>null},window:{addEventListener:(name,fn)=>events[name]=fn,caches:{keys:async()=>['zenflow-racer-v1','zenflow-racer-current','other-app'],delete:async key=>deleted.push(key)}}};
  vm.runInNewContext(pwa,context);await events.load();assert.deepEqual(removed,['racer','waiting']);assert.deepEqual(deleted,['zenflow-racer-v1','zenflow-racer-current']);
  context.navigator.serviceWorker.getRegistrations=async()=>{throw Error('Storage denied');};await events.load();
 }
 console.log('PASS local workers/cache cleanup: all local hosts, unrelated registrations preserved, denied storage tolerated');
 const source=fs.readFileSync('game.js','utf8'),barrier=source.slice(source.lastIndexOf('if(document.fonts&&document.fonts.load)')).split('\n')[0];
 const pending=new Map();let boots=0;
 vm.runInNewContext(barrier,{document:{fonts:{load:font=>new Promise((resolve,reject)=>pending.set(font,{resolve,reject}))}},boot:()=>boots++,setTimeout:fn=>fn()});
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 assert.equal(pending.size,4);pending.get('700 20px "Rajdhani"').reject(Error('Font unavailable'));pending.get('500 12px "Rajdhani"').resolve([]);await flush();assert.equal(boots,0);
 pending.get('700 20px "Orbitron"').resolve([]);await flush();assert.equal(boots,0);
 pending.get('800 120px "Orbitron"').resolve([]);await flush();assert.equal(boots,1);
 console.log('PASS texture boot waits for both Orbitron weights even if another font fails');
})().catch(error=>{console.error(error);process.exitCode=1;});
