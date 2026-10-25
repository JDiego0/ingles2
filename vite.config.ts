import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Lista recursiva de archivos de /public para incluirlos en el precache. */
function listPublic(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listPublic(full, root);
    return [relative(root, full).replace(/\\/g, '/')];
  });
}

/**
 * Genera dist/sw.js con la lista exacta de archivos del build.
 * La versión depende del contenido, así que cada despliegue nuevo crea una caché
 * nueva y el service worker borra las anteriores al activarse.
 */
function serviceWorker(): Plugin {
  return {
    name: 'english-journey-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = new Set<string>(['./', 'index.html']);
      for (const name of Object.keys(bundle)) {
        if (!name.endsWith('.map') && name !== 'sw.js') files.add(name);
      }
      for (const f of listPublic('public')) files.add(f);
      const list = [...files].map((f) => (f === './' ? f : './' + f));
      const hash = createHash('sha256');
      for (const [name, item] of Object.entries(bundle)) {
        hash.update(name);
        hash.update(item.type === 'chunk' ? item.code : String(item.source));
      }
      const version = hash.digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: swSource(version, list),
      });
    },
  };
}

function swSource(version: string, files: string[]): string {
  return `/* English Journey service worker — generado en el build */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'english-journey-' + VERSION;
const PRECACHE = ${JSON.stringify(files)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('english-journey-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegación: red primero (para recibir versiones nuevas), caché si no hay conexión.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Recursos con hash: caché primero, red como respaldo.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
`;
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
