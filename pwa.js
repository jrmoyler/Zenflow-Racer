(() => {
  const localHost=['terminal.local','localhost','127.0.0.1','[::1]'].includes(location.hostname);
  if('serviceWorker' in navigator&&location.protocol!=='file:'&&localHost){
    window.addEventListener('load',async()=>{
      try{
        const script=new URL('./sw.js',location.href).href;
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter(r=>[r.active,r.waiting,r.installing].some(w=>w&&new URL(w.scriptURL).href===script)).map(r=>r.unregister()));
        if('caches' in window){const keys=await window.caches.keys();await Promise.all(keys.filter(k=>k.startsWith('zenflow-racer-')).map(k=>window.caches.delete(k)));}
      }catch(_){/* A denied storage API must not prevent local play. */}
    });
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !localHost) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(registration => {
      let reloading=false,reloadQueued=false,reloadIssued=false;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading){reloadQueued=true;applyAtMenu();}});
      // Apply complete cached releases automatically at a menu. Never reload
      // a race, a paused race, a result ceremony, or a scene transition.
      const applyAtMenu=()=>{
        if(reloadIssued||typeof game==='undefined')return;
        if(!['title','roster'].includes(game.state)||document.hidden)return;
        if(typeof sceneCut!=='undefined'&&sceneCut.busy)return;
        if(reloadQueued){reloadIssued=true;location.reload();return;}
        if(reloading||!registration.waiting)return;
        reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
      };
      applyAtMenu();
      setInterval(applyAtMenu,2000);
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)applyAtMenu();});});
    }).catch(() => {}));
  }
  let installPrompt;
  const button = document.getElementById('installapp');
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
    if (button) button.hidden = false;
  });
  button?.addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null; button.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if (button) button.hidden = true; });
})();
