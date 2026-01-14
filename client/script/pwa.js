// /script/pwa.js
(() => {
  // Register service worker for offline + installability
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // console.log('✅ Service Worker registered');
    } catch (err) {
      console.warn('⚠️ Service Worker registration failed:', err);
    }
  });
})();
