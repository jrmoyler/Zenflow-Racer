(() => {
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !['terminal.local', 'localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
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
