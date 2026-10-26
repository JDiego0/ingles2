/**
 * Voz natural pregrabada. Las frases del curso se generan con una voz neuronal
 * (scripts/make-audio.py) y se guardan en public/audio/<id>.mp3. Si una frase no tiene
 * archivo, tts.ts usa la síntesis de voz del navegador.
 *
 * Hay un único elemento <audio> para toda la app: es imposible que suenen dos frases a la vez.
 */

/** Forma canónica del texto: la misma frase con distinto espaciado o «…» usa el mismo archivo. */
export function audioKey(text: string): string {
  return text.replace(/…/g, ' ').replace(/\s+/g, ' ').trim();
}

/** FNV-1a de 64 bits del texto canónico, en hexadecimal. */
export function audioId(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(audioKey(text))) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

export function audioAvailable(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined' && typeof fetch !== 'undefined';
}

let el: HTMLAudioElement | null = null;
function player(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
  }
  return el;
}

/**
 * iOS y algunos Android solo dejan reproducir audio desde un toque. Con el primer toque
 * se «desbloquea» el elemento compartido y a partir de ahí se puede usar tras esperar la descarga.
 */
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let unlocked = false;
if (audioAvailable()) {
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    const a = player();
    if (a.src) return;
    a.src = SILENCE;
    a.play().catch(() => undefined);
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

/** Archivos ya descargados (URL de objeto) y frases sin archivo. */
const blobs = new Map<string, string>();
const missing = new Set<string>();

/** Descarga el audio de una frase; null si no existe (o no hay conexión ni caché). */
export async function fetchAudio(text: string): Promise<string | null> {
  const id = audioId(text);
  if (missing.has(id)) return null;
  const hit = blobs.get(id);
  if (hit) return hit;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}audio/${id}.mp3`);
    const type = res.headers.get('content-type') ?? '';
    // Sin archivo, algunos servidores devuelven index.html con estado 200.
    if (!res.ok || type.includes('html')) {
      if (res.status === 404 || type.includes('html')) missing.add(id);
      return null;
    }
    const url = URL.createObjectURL(await res.blob());
    blobs.set(id, url);
    if (blobs.size > 60) {
      const [oldId, oldUrl] = blobs.entries().next().value!;
      blobs.delete(oldId);
      URL.revokeObjectURL(oldUrl);
    }
    return url;
  } catch {
    return null;
  }
}

/** El audio en curso termina con este resultado si otra frase lo sustituye o se detiene. */
let finishCurrent: ((r: 'ok' | 'failed' | 'interrupted') => void) | null = null;

export function stopAudio() {
  const f = finishCurrent;
  finishCurrent = null;
  if (el) el.pause();
  f?.('interrupted');
}

/** Reproduce un archivo ya descargado. 'failed' si el navegador no lo deja sonar. */
export function playUrl(url: string, rate: number): Promise<'ok' | 'failed' | 'interrupted'> {
  stopAudio();
  const a = player();
  return new Promise((resolve) => {
    const done = (r: 'ok' | 'failed' | 'interrupted') => {
      if (finishCurrent !== done) return;
      finishCurrent = null;
      a.onended = a.onerror = null;
      resolve(r);
    };
    finishCurrent = done;
    a.onended = () => done('ok');
    a.onerror = () => done('failed');
    a.src = url;
    a.playbackRate = rate;
    a.defaultPlaybackRate = rate;
    a.preservesPitch = true;
    a.play().catch((e: unknown) => done(e instanceof DOMException && e.name === 'AbortError' ? 'interrupted' : 'failed'));
  });
}
