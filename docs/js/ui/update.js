// Registers the service worker and shows "Update available, tap to reload" when a new
// release has been saved on the phone and is waiting.
export function setupUpdates(banner, { container = navigator.serviceWorker } = {}) {
  if (!container) return;
  let reloading = false;
  function offer(worker) {
    banner.textContent = 'Update available, tap to reload';
    banner.hidden = false;
    banner.onclick = () => {
      reloading = true;
      worker.postMessage('skipWaiting');
    };
  }
  container.addEventListener('controllerchange', () => {
    if (reloading) window.location.reload();
  });
  container.register('sw.js').then((reg) => {
    if (reg.waiting && container.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && container.controller) offer(worker);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service worker not registered:', err));
}
