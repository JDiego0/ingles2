/**
 * Registro del service worker (solo en producción) y aviso de versión nueva.
 * Cuando hay una versión nueva, la app ofrece actualizar en vez de recargar sola en mitad de una lección.
 */
import { useEffect, useState } from 'react';

export function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let reloading = false;
    const onController = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onController);
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        if (reg.active) setReady(true);
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed') {
              if (navigator.serviceWorker.controller) setWaiting(sw);
              else setReady(true);
            }
          });
        });
        // Buscar actualizaciones al volver a la app.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onController);
  }, []);

  return {
    updateAvailable: !!waiting,
    offlineReady: ready,
    applyUpdate: () => waiting?.postMessage('SKIP_WAITING'),
  };
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
