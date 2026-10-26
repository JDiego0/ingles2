/**
 * Reconocimiento de voz (Web Speech API). En Chrome para Android normalmente funciona,
 * pero suele requerir conexión porque el audio se procesa en servidores del navegador.
 * La transcripción NO evalúa la pronunciación: solo muestra qué palabras se reconocieron.
 *
 * Chrome para Android repite resultados: con `continuous` cada resultado nuevo trae
 * de nuevo el texto anterior («hello», «hello my», «hello my name»…) y a veces el mismo
 * resultado final llega dos veces. Por eso se escucha una sola frase (`continuous = false`),
 * el texto se reconstruye entero en cada evento y se fusionan los fragmentos solapados.
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
 * Escucha una frase en inglés de EE. UU. Termina sola al dejar de hablar o con `stop()`.
 * `pick` elige entre las interpretaciones posibles (por ejemplo, la que coincide con la respuesta esperada).
 */
export function startRecognition(onInterim?: (text: string) => void, pick?: (alternatives: string[]) => string | undefined): RecognitionHandle {
  const C = ctor();
  if (!C) {
    return { stop() {}, result: Promise.reject(new Error('Reconocimiento de voz no disponible en este navegador.')) };
  }
  const rec = new C();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let candidates: string[] = [];
  const result = new Promise<RecognitionOutcome>((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (!candidates.length) reject(new Error(recognitionError('no-speech')));
      else resolve({ transcript: pick?.(candidates) ?? candidates[0], alternatives: candidates });
    };
    rec.onresult = (e) => {
      // Se reconstruye desde el principio en cada evento: nunca se acumula texto repetido.
      candidates = candidatesFrom(e.results);
      onInterim?.(candidates[0] ?? '');
    };
    rec.onerror = (e) => {
      if (settled) return;
      if ((e.error === 'no-speech' || e.error === 'aborted') && candidates.length) return done();
      settled = true;
      reject(new Error(recognitionError(e.error)));
    };
    rec.onend = done;
  });
  try {
    rec.start();
  } catch (err) {
    return { stop() {}, result: Promise.reject(err instanceof Error ? err : new Error(String(err))) };
  }
  return { stop: () => rec.stop(), result };
}
