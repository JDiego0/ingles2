/**
 * Síntesis de voz con la Web Speech API. La disponibilidad y la calidad de las voces
 * dependen del navegador y del dispositivo; todas las funciones fallan con elegancia.
 */

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Las voces se cargan de forma asíncrona en Chrome/Android: esperamos el evento voiceschanged. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsAvailable()) return Promise.resolve([]);
  if (voicesPromise) return voicesPromise;
  const p = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 2500);
  });
  voicesPromise = p;
  p.then((v) => {
    if (!v.length) voicesPromise = null;
  });
  return p;
}

export function englishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const us = voices.filter((v) => /^en[-_]US/i.test(v.lang));
  const other = voices.filter((v) => /^en/i.test(v.lang) && !/^en[-_]US/i.test(v.lang));
  return [...us, ...other];
}

/** Prefiere la voz elegida; si no existe, una voz en-US (las de Google suelen sonar mejor). */
export function pickVoice(voices: SpeechSynthesisVoice[], preferredURI: string | null): SpeechSynthesisVoice | null {
  if (preferredURI) {
    const found = voices.find((v) => v.voiceURI === preferredURI);
    if (found) return found;
  }
  const en = englishVoices(voices);
  return en.find((v) => /google/i.test(v.name) && /en[-_]US/i.test(v.lang)) ?? en[0] ?? null;
}

export interface SpeakOptions {
  rate?: number;
  voiceURI?: string | null;
}

export type SpeakResult = 'ok' | 'failed' | 'interrupted';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cada reproducción tiene un número: si empieza otra, la anterior se da por interrumpida. */
let generation = 0;
let current: { key: string; at: number; promise: Promise<SpeakResult> } | null = null;

/**
 * Reproduce un texto y dice cómo terminó.
 *
 * Evita el audio «doble» de Chrome para Android:
 * - un doble toque (o el clic fantasma de algunos móviles) sobre la misma frase no la lanza dos veces;
 * - `cancel()` es asíncrono en Android: si se habla justo después, la frase anterior puede seguir
 *   sonando encima o repetirse, así que se espera un momento tras cancelar;
 * - el final se detecta también cuando el sintetizador queda en silencio (algunos Android no
 *   disparan `onend`), en vez de con un temporizador que podía lanzar la siguiente frase encima.
 */
export function speakResult(text: string, opts: SpeakOptions = {}): Promise<SpeakResult> {
  if (!ttsAvailable()) return Promise.resolve('failed');
  const synth = window.speechSynthesis;
  const rate = opts.rate ?? 0.9;
  const key = `${text}|${rate}`;
  const now = Date.now();
  if (current && current.key === key && now - current.at < 800) return current.promise;
  const my = ++generation;
  const promise = (async (): Promise<SpeakResult> => {
    const voices = await loadVoices();
    if (my !== generation) return 'interrupted';
    if (synth.speaking || synth.pending) {
      synth.cancel();
      await sleep(150);
      if (my !== generation) return 'interrupted';
    }
    return new Promise<SpeakResult>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(voices, opts.voiceURI ?? null);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.rate = rate;
      let finished = false;
      let started = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const end = (r: SpeakResult) => {
        if (finished) return;
        finished = true;
        clearInterval(poll);
        timers.forEach(clearTimeout);
        resolve(r);
      };
      u.onstart = () => {
        started = true;
      };
      u.onend = () => end('ok');
      u.onerror = (e) => end(e.error === 'interrupted' || e.error === 'canceled' ? 'interrupted' : 'failed');
      const poll = setInterval(() => {
        if (my !== generation) return end('interrupted');
        if (synth.speaking) started = true;
        else if (started && !synth.pending) end('ok');
      }, 300);
      // Si el audio no empieza (sin voces instaladas, bloqueo del navegador), se informa del fallo.
      timers.push(
        setTimeout(() => {
          if (!started && !synth.speaking) {
            synth.cancel();
            end('failed');
          }
        }, 3000),
      );
      // Límite absoluto por si el navegador nunca informa del final.
      timers.push(setTimeout(() => end('ok'), 15000 + (text.length * 150) / (rate || 1)));
      synth.speak(u);
    });
  })();
  current = { key, at: now, promise };
  return promise;
}

/** Reproduce un texto. Resuelve true al terminar (o si otra frase lo interrumpió), false si no fue posible. */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<boolean> {
  return (await speakResult(text, opts)) !== 'failed';
}

export function stopSpeaking() {
  generation++;
  current = null;
  if (ttsAvailable()) window.speechSynthesis.cancel();
}
