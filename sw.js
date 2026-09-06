// Development worker: never install an incomplete, stale release cache.
// npm run build replaces this file in dist/ with the complete hashed offline shell.
self.addEventListener('fetch', () => {});
