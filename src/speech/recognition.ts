/**
 * Reconocimiento de voz (Web Speech API). En Chrome para Android normalmente funciona,
 * pero suele requerir conexión porque el audio se procesa en servidores del navegador.
 * La transcripción NO evalúa la pronunciación: solo muestra qué palabras se reconocieron.
 *
 * Chrome para Android repite resultados: con `continuous` cada resultado nuevo trae
 * de nuevo el texto anterior («hello», «hello my», «hello my name»…) y a veces el mismo
 * resultado final llega dos veces. Por eso el texto se reconstruye entero en cada evento
 * y se fusionan los fragmentos solapados.
 */

interface RecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface RecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternativeLike;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionAvailable(): boolean {
  return !!ctor();
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const key = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

/** Quita repeticiones consecutivas de 1 a 5 palabras: «hello hello my name» → «hello my name». */
export function collapseRepeats(text: string): string {
  const w = words(text);
  for (let n = Math.min(5, Math.floor(w.length / 2)); n >= 1; n--) {
    for (let i = 0; i + 2 * n <= w.length; ) {
      let same = true;
      for (let k = 0; k < n && same; k++) same = key(w[i + k]) === key(w[i + n + k]) && key(w[i + k]) !== '';
      if (same) w.splice(i + n, n);
      else i++;
    }
  }
  return w.join(' ');
}

/**
 * Une los fragmentos que devuelve el reconocedor sin duplicar texto:
 * si un fragmento contiene al anterior lo reemplaza, si ya está incluido se ignora
 * y si se solapa por el final solo se añade la parte nueva.
 */
export function mergePieces(pieces: string[]): string {
  let acc: string[] = [];
  for (const raw of pieces) {
    const p = words(raw);
    if (!p.length) continue;
    const a = acc.map(key).join(' ');
    const b = p.map(key).join(' ');
    if (!a || b.startsWith(a)) {
      acc = p;
      continue;
    }
    if (a.includes(b)) continue;
    // Solapamiento: el final de acc coincide con el principio de p.
    let overlap = 0;
    for (let n = Math.min(acc.length, p.length); n >= 1; n--) {
      if (acc.slice(-n).map(key).join(' ') === p.slice(0, n).map(key).join(' ')) {
        overlap = n;
        break;
      }
    }
    acc = [...acc, ...p.slice(overlap)];
  }
  return collapseRepeats(acc.join(' '));
}

export interface RecognitionOutcome {
  /** Mejor transcripción (la elegida por `pick` si se indicó). */
  transcript: string;
  /** Todas las interpretaciones posibles, la más probable primero. */
  alternatives: string[];
}

export interface RecognitionHandle {
  stop(): void;
  result: Promise<RecognitionOutcome>;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'El navegador no tiene permiso para usar el micrófono. Revísalo en los ajustes del sitio.',
  'service-not-allowed': 'El reconocimiento de voz no está permitido en este navegador.',
  'no-speech': 'No te escuché. Pulsa el micrófono y habla justo después, cerca del teléfono.',
  network: 'El reconocimiento de voz necesita conexión a internet en este dispositivo.',
  'audio-capture': 'No se encontró un micrófono.',
  aborted: 'Grabación cancelada.',
};

export function recognitionError(code: string): string {
  return ERRORS[code] ?? `No se pudo reconocer la voz (${code}).`;
}

/** Interpretaciones posibles a partir de la lista de resultados (sin duplicados). */
export function candidatesFrom(results: ArrayLike<RecognitionResultLike>): string[] {
  const list = Array.from(results);
  if (!list.length) return [];
  const firsts = list.map((r) => r[0]?.transcript ?? '');
  const out: string[] = [mergePieces(firsts)];
  // Variantes: cambiar la interpretación del último fragmento (normalmente el único).
  const last = list[list.length - 1];
  for (let a = 1; a < last.length; a++) {
    out.push(mergePieces([...firsts.slice(0, -1), last[a].transcript]));
  }
  return [...new Set(out.filter(Boolean))];
}

/**
 * Escucha en inglés de EE. UU. hasta que se llama a `stop()` (el botón «Listo»).
 * El navegador corta solo al detectar silencio; si todavía no se pulsó «Listo», se vuelve a
 * escuchar enseguida y se suma lo nuevo, así puedes pausar para pensar sin perder la grabación.
 * `pick` elige entre las interpretaciones posibles (por ejemplo, la que coincide con la respuesta esperada).
 */
export function startRecognition(onInterim?: (text: string) => void, pick?: (alternatives: string[]) => string | undefined): RecognitionHandle {
  const C = ctor();
  if (!C) {
    return { stop() {}, result: Promise.reject(new Error('Reconocimiento de voz no disponible en este navegador.')) };
  }
  const MAX_MS = 3 * 60_000;
  const startedAt = Date.now();
  /** Texto de las sesiones ya terminadas. */
  const segments: string[] = [];
  /** Interpretaciones de la sesión en curso y de la última con texto. */
  let candidates: string[] = [];
  let lastAlts: string[] = [];
  let stopped = false;
  let settled = false;
  let listening = false;
  let quickEmpty = 0;
  let rec: RecognitionLike | null = null;
  let resolveFn: (r: RecognitionOutcome) => void = () => {};
  let rejectFn: (e: Error) => void = () => {};
  const result = new Promise<RecognitionOutcome>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  const joined = (last: string) => mergePieces([...segments, last]);

  const finish = (errorCode?: string) => {
    if (settled) return;
    settled = true;
    if (candidates.length) {
      segments.push(candidates[0]);
      lastAlts = candidates;
    }
    if (!segments.length) {
      rejectFn(new Error(recognitionError(errorCode ?? 'no-speech')));
      return;
    }
    const before = segments.slice(0, -1);
    const alternatives = [...new Set((lastAlts.length ? lastAlts : [segments[segments.length - 1]]).map((a) => mergePieces([...before, a])))];
    resolveFn({ transcript: pick?.(alternatives) ?? alternatives[0], alternatives });
  };

  const session = () => {
    if (settled) return;
    const r = new C();
    rec = r;
    r.lang = 'en-US';
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.continuous = true;
    const sessionStart = Date.now();
    let fatal: string | null = null;
    r.onresult = (e) => {
      // Se reconstruye desde el principio en cada evento: nunca se acumula texto repetido.
      candidates = candidatesFrom(e.results);
      onInterim?.(joined(candidates[0] ?? ''));
    };
    r.onerror = (e) => {
      // Silencio o corte del navegador: no es un fallo, se sigue escuchando.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      fatal = e.error;
    };
    r.onend = () => {
      listening = false;
      const hadText = candidates.length > 0;
      if (hadText) {
        segments.push(candidates[0]);
        lastAlts = candidates;
        candidates = [];
      }
      if (fatal) return finish(fatal);
      if (stopped || Date.now() - startedAt > MAX_MS) return finish();
      // Evita un bucle infinito si el navegador corta una y otra vez sin escuchar nada.
      quickEmpty = !hadText && Date.now() - sessionStart < 1000 ? quickEmpty + 1 : 0;
      if (quickEmpty >= 4) return finish();
      setTimeout(session, 60);
    };
    try {
      r.start();
      listening = true;
    } catch (err) {
      if (!segments.length) {
        settled = true;
        rejectFn(err instanceof Error ? err : new Error(String(err)));
      } else finish();
    }
  };

  session();
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (listening && rec) {
        rec.stop();
        // Por si el navegador no avisa del final.
        setTimeout(() => finish(), 1500);
      } else finish();
    },
    result,
  };
}
