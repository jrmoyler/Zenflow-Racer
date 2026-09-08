(() => {
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !['terminal.local', 'localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(registration => {
      let reloading=false;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
      const offer=()=>{
        if(!registration.waiting||document.getElementById('game-update'))return;
        const button=document.createElement('button');button.id='game-update';button.textContent='Update ready · reload game';button.type='button';
        button.onclick=()=>{if(typeof game!=='undefined'&&['race','countdown','finish'].includes(game.state)){button.textContent='Pause the race to update';return;}reloading=true;registration.waiting?.postMessage({type:'ACTIVATE_UPDATE'});};
        document.body.append(button);
      };
      offer();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});
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
