import { audioAvailable, fetchAudio, playUrl, stopAudio } from './audio';

/**
 * Reproducción de frases: primero la voz natural pregrabada (audio.ts); si la frase no tiene
 * archivo o se eligió una voz del sistema, la síntesis de voz con la Web Speech API. La disponibilidad y la calidad de las voces
 * dependen del navegador y del dispositivo; todas las funciones fallan con elegancia.
 */

export type Gender = 'male' | 'female';

export function ttsAvailable(): boolean {
  return audioAvailable() || webSpeechAvailable();
}

function webSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Las voces se cargan de forma asíncrona en Chrome/Android: esperamos el evento voiceschanged. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!webSpeechAvailable()) return Promise.resolve([]);
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
  // Voces femeninas que suenan más naturales (Edge/Windows, Apple, Chrome), por orden de preferencia.
  for (const re of [/(Ava|Jenny|Aria|Emma|Michelle).*(Natural|Online)/i, /Natural|Neural|Premium|Enhanced/i, /Samantha|Zira/i, /Google US English/i, /google/i]) {
    const v = en.find((x) => re.test(x.name) && /en[-_]US/i.test(x.lang));
    if (v) return v;
  }
  return en[0] ?? null;
}

// ── Voces diferenciadas por género para diálogos ────────────────────────────

/** Patrones de nombre de voz típicamente masculinos en las principales plataformas. */
const MALE_PATTERNS = [
  /\b(Guy|Andrew|David|Mark|Brian|Christopher|Eric|Roger|Steffan)\b/i,
  /\b(James|John|Ryan|Adam|Daniel|Matthew|Michael|William|Robert)\b/i,
];
/** Patrones de nombre de voz típicamente femeninos. */
const FEMALE_PATTERNS = [
  /\b(Ava|Jenny|Aria|Emma|Michelle|Samantha|Zira|Sara|Susan|Linda|Karen)\b/i,
  /\b(Joanna|Salli|Kimberly|Kendra|Amy|Nicole|Fiona|Moira|Tessa|Allison)\b/i,
];

function scoreGender(name: string, patterns: RegExp[]): number {
  return patterns.reduce((n, re) => n + (re.test(name) ? 1 : 0), 0);
}

/**
 * Elige una voz en inglés que corresponda al género indicado.
 * Si no puede distinguir género, devuelve cualquier voz distinta de `exclude`.
 */
export function pickVoiceForGender(
  voices: SpeechSynthesisVoice[],
  gender: Gender,
  exclude?: SpeechSynthesisVoice | null,
): SpeechSynthesisVoice | null {
  const en = englishVoices(voices);
  if (!en.length) return null;

  const preferred = gender === 'male' ? MALE_PATTERNS : FEMALE_PATTERNS;
  const avoid = gender === 'male' ? FEMALE_PATTERNS : MALE_PATTERNS;

  // Candidatas: voces en inglés con coincidencia positiva de género y sin coincidencia del opuesto.
  const candidates = en
    .map((v) => ({ v, score: scoreGender(v.name, preferred), antiScore: scoreGender(v.name, avoid) }))
    .filter((c) => c.score > 0 && c.antiScore === 0)
    .sort((a, b) => b.score - a.score);

  // Preferir una voz distinta a la excluida.
  if (exclude) {
    const different = candidates.find((c) => c.v.voiceURI !== exclude.voiceURI);
    if (different) return different.v;
  }
  if (candidates.length) return candidates[0].v;

  // Sin coincidencia de género: devolver cualquier voz distinta de la excluida.
  if (exclude) {
    const fallback = en.find((v) => v.voiceURI !== exclude.voiceURI);
    if (fallback) return fallback;
  }
  return en[0] ?? null;
}

// ── Mapa de género para los hablantes de los diálogos ───────────────────────

/**
 * Género conocido de los hablantes que aparecen en los diálogos del curso.
 * Los nombres de persona siguen su género natural; los roles genéricos se asignan
 * aquí con un género fijo para garantizar la diferenciación constante de voces.
 */
const SPEAKER_GENDER: Record<string, Gender> = {
  // Hombres
  Diego: 'male',
  Mark: 'male',
  Leo: 'male',
  Doctor: 'male',
  CTO: 'male',
  VP: 'male',
  Director: 'male',
  Investor: 'male',
  // Mujeres
  Sarah: 'female',
  Ana: 'female',
  Jessica: 'female',
  Priya: 'female',
  Woman: 'female',
  // Roles neutros: se asigna un género fijo para estabilidad
  Manager: 'female',
  Recruiter: 'female',
  HR: 'female',
  Host: 'female',
  Reception: 'female',
  Barista: 'female',
  Agent: 'male',
  Clerk: 'male',
  Client: 'male',
  Friend: 'male',
  User: 'male',
};

/** Devuelve el género de un hablante del diálogo; por defecto 'male'. */
export function speakerGender(who: string): Gender {
  return SPEAKER_GENDER[who] ?? 'male';
}

export interface SpeakOptions {
  rate?: number;
  /** null: voz natural pregrabada (y, si falta, la mejor voz del sistema). */
  voiceURI?: string | null;
  /** Género del hablante: permite seleccionar una voz acorde en diálogos. */
  gender?: Gender;
}

export type SpeakResult = 'ok' | 'failed' | 'interrupted';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Registro de los últimos eventos de audio (se muestra en Ajustes → Voz para diagnosticar). */
const events: string[] = [];
let t0 = 0;
function logEvent(msg: string) {
  const now = Date.now();
  if (!t0 || now - t0 > 60_000) t0 = now;
  events.push(`+${((now - t0) / 1000).toFixed(2)}s ${msg}`);
  if (events.length > 30) events.shift();
}
export const audioLog = () => [...events];

/** Cada reproducción tiene un número: si empieza otra, la anterior se da por interrumpida. */
let generation = 0;

interface Active {
  key: string;
  at: number;
  promise: Promise<SpeakResult>;
  /** Referencia fuerte: en Android, si la frase se libera de memoria, `onend` no llega nunca. */
  u: SpeechSynthesisUtterance | null;
  done: boolean;
}
let active: Active | null = null;

/** Espera a que el sintetizador quede en silencio (máx. `max` ms). */
async function waitSilence(synth: SpeechSynthesis, max: number) {
  const until = Date.now() + max;
  while ((synth.speaking || synth.pending) && Date.now() < until) await sleep(50);
}

/**
 * Reproduce un texto y dice cómo terminó.
 *
 * Evita el audio «doble» de Chrome para Android:
 * - solo suena una frase a la vez: antes de empezar otra se cancela la anterior y se espera
 *   a que termine de verdad (en Android `cancel()` es asíncrono y, si se habla enseguida,
 *   la frase anterior puede seguir sonando encima o repetirse);
 * - un doble toque (o el clic fantasma de algunos móviles) no la lanza dos veces, y tocar
 *   de nuevo la frase que está sonando la detiene;
 * - el final se toma de `onend`; el estado del sintetizador solo se usa como respaldo cuando
 *   ya pasó la duración esperada (en algunos Android `speaking` es poco fiable).
 */
export function speakResult(text: string, opts: SpeakOptions = {}): Promise<SpeakResult> {
  if (!ttsAvailable()) return Promise.resolve('failed');
  const rate = opts.rate ?? 0.9;
  const key = `${text}|${rate}`;
  const now = Date.now();
  if (active && !active.done && active.key === key) {
    if (now - active.at < 1000) {
      logEvent('toque repetido ignorado');
      return active.promise;
    }
    logEvent('misma frase tocada otra vez: detener');
    stopSpeaking();
    return Promise.resolve('interrupted');
  }
  const my = ++generation;
  stopAudio();
  const prev = active;
  const entry: Active = { key, at: now, promise: Promise.resolve('interrupted' as SpeakResult), u: null, done: false };
  entry.promise = (async (): Promise<SpeakResult> => {
    if (!opts.voiceURI && audioAvailable()) {
      // Audio masculino usa archivos etiquetados ('m'); sin etiqueta = voz femenina predeterminada.
      const voiceTag = opts.gender === 'male' ? 'm' : undefined;
      const url = await fetchAudio(text, voiceTag);
      if (my !== generation) return 'interrupted';
      if (url) {
        if (webSpeechAvailable()) window.speechSynthesis.cancel();
        logEvent(`voz natural: «${text.slice(0, 30)}»`);
        const r = await playUrl(url, rate);
        logEvent(`fin (${r}): «${text.slice(0, 30)}»`);
        if (r !== 'failed' || my !== generation) return r;
      }
    }
    if (!webSpeechAvailable()) return 'failed';
    const synth = window.speechSynthesis;
    const voices = await loadVoices();
    if (my !== generation) return 'interrupted';
    if ((prev && !prev.done) || synth.speaking || synth.pending) {
      logEvent('cancelar audio anterior');
      synth.cancel();
      if (prev && !prev.done) await Promise.race([prev.promise, sleep(500)]);
      await waitSilence(synth, 800);
      await sleep(120);
      if (my !== generation) return 'interrupted';
    }
    return new Promise<SpeakResult>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      entry.u = u;
      // Si se indicó un género, buscar una voz apropiada; si no, la normal.
      const voice = opts.gender
        ? pickVoiceForGender(voices, opts.gender)
        : pickVoice(voices, opts.voiceURI ?? null);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.rate = rate;
      let finished = false;
      let started = false;
      let silentPolls = 0;
      const startedAt = Date.now();
      const expected = 1500 + (text.length * 75) / (rate || 1);
      const timers: ReturnType<typeof setTimeout>[] = [];
      const end = (r: SpeakResult) => {
        if (finished) return;
        finished = true;
        entry.done = true;
        clearInterval(poll);
        timers.forEach(clearTimeout);
        logEvent(`fin (${r}): «${text.slice(0, 30)}»`);
        resolve(r);
      };
      u.onstart = () => {
        started = true;
        logEvent('empieza a sonar');
      };
      u.onend = () => end('ok');
      u.onerror = (e) => end(e.error === 'interrupted' || e.error === 'canceled' ? 'interrupted' : 'failed');
      const poll = setInterval(() => {
        if (my !== generation) return end('interrupted');
        if (synth.speaking) {
          started = true;
          silentPolls = 0;
        } else if (started && Date.now() - startedAt > expected && ++silentPolls >= 2) end('ok');
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
      logEvent(`hablar: «${text.slice(0, 30)}» (voz: ${voice?.name ?? 'predeterminada'})`);
      synth.speak(u);
    });
  })();
  entry.promise.finally(() => {
    entry.done = true;
  });
  active = entry;
  return entry.promise;
}

/** Reproduce un texto. Resuelve true al terminar (o si otra frase lo interrumpió), false si no fue posible. */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<boolean> {
  return (await speakResult(text, opts)) !== 'failed';
}

export function stopSpeaking() {
  generation++;
  active = null;
  stopAudio();
  if (webSpeechAvailable()) window.speechSynthesis.cancel();
}
