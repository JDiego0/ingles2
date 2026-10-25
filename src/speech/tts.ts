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

/** Reproduce un texto. Resuelve true al terminar, false si no fue posible. */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<boolean> {
  if (!ttsAvailable()) return false;
  const synth = window.speechSynthesis;
  const voices = await loadVoices();
  synth.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(voices, opts.voiceURI ?? null);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.rate = opts.rate ?? 0.9;
    let finished = false;
    let started = false;
    const end = (ok: boolean) => {
      if (finished) return;
      finished = true;
      resolve(ok);
    };
    u.onstart = () => {
      started = true;
    };
    u.onend = () => end(true);
    u.onerror = (e) => end(e.error === 'interrupted' || e.error === 'canceled');
    // Si el audio no empieza (sin voces instaladas, bloqueo del navegador), se informa del fallo.
    setTimeout(() => {
      if (!started && !synth.speaking) {
        synth.cancel();
        end(false);
      }
    }, 3000);
    // Algunos Android no disparan onend: límite de seguridad según la longitud.
    setTimeout(() => end(true), 4000 + (text.length * 120) / (u.rate || 1));
    synth.speak(u);
  });
}

export function stopSpeaking() {
  if (ttsAvailable()) window.speechSynthesis.cancel();
}
