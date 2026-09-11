(() => {
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !['terminal.local', 'localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
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
