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
        // El reconocedor de voz (≈27 MB) solo se descarga si se usa el micrófono.
        if (!name.endsWith('.map') && name !== 'sw.js' && !isSpeechEngine(name)) files.add(name);
      }
      // El audio (miles de archivos) no se precachea: se guarda al escucharlo por primera vez.
      for (const f of listPublic('public')) if (!f.startsWith('audio/')) files.add(f);
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

const isSpeechEngine = (name: string) => name.endsWith('.wasm') || name.includes('stt.worker');

function swSource(version: string, files: string[]): string {
  return `/* English Journey service worker — generado en el build */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'english-journey-' + VERSION;
const PRECACHE = ${JSON.stringify(files)};
// Los audios no cambian (el nombre sale del texto), así que su caché sobrevive a las versiones nuevas.
const AUDIO_CACHE = 'english-journey-audio';
// El motor del reconocedor de voz tiene nombre con hash: se guarda aparte para no volver a bajarlo en cada versión.
const STT_CACHE = 'english-journey-stt';

// Aislamiento entre orígenes: GitHub Pages no permite poner cabeceras, así que las añade el service worker.
// Con él, el reconocedor de voz puede usar varios núcleos del procesador (SharedArrayBuffer).
// «credentialless» no bloquea recursos de otros sitios (el modelo se descarga de Hugging Face con CORS).
function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque' || res.type === 'opaqueredirect') return res;
  const headers = new Headers(res.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('english-journey-') && k !== CACHE && k !== AUDIO_CACHE && k !== STT_CACHE).map((k) => caches.delete(k))))
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
        .then(isolate)
    );
    return;
  }

  const persistent = url.pathname.includes('/audio/') ? AUDIO_CACHE : /\\.wasm$|stt\\.worker/.test(url.pathname) ? STT_CACHE : null;
  if (persistent) {
    event.respondWith(
      caches.open(persistent).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok && res.status === 200) c.put(req, res.clone());
        return res;
      }))).then(isolate)
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
    })).then(isolate)
  );
});
`;
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  // Las mismas cabeceras que pone el service worker en producción (varios núcleos para el reconocedor).
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
