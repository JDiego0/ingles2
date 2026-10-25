/**
 * Reconocimiento de voz (Web Speech API). En Chrome para Android normalmente funciona,
 * pero suele requerir conexión porque el audio se procesa en servidores del navegador.
 * La transcripción NO evalúa la pronunciación: solo muestra qué palabras se reconocieron.
 */

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
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

export interface RecognitionHandle {
  stop(): void;
  result: Promise<{ transcript: string; confidence: number }>;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'El navegador no tiene permiso para usar el micrófono. Revísalo en los ajustes del sitio.',
  'service-not-allowed': 'El reconocimiento de voz no está permitido en este navegador.',
  'no-speech': 'No se detectó voz. Intenta de nuevo, más cerca del micrófono.',
  network: 'El reconocimiento de voz necesita conexión a internet en este dispositivo.',
  'audio-capture': 'No se encontró un micrófono.',
  aborted: 'Grabación cancelada.',
};

export function recognitionError(code: string): string {
  return ERRORS[code] ?? `No se pudo reconocer la voz (${code}).`;
}

/** Empieza a escuchar en inglés de EE. UU. */
export function startRecognition(onInterim?: (text: string) => void): RecognitionHandle {
  const C = ctor();
  if (!C) {
    return { stop() {}, result: Promise.reject(new Error('Reconocimiento de voz no disponible en este navegador.')) };
  }
  const rec = new C();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = true;
  let finalText = '';
  let interim = '';
  let confidence = 0;
  let n = 0;
  const result = new Promise<{ transcript: string; confidence: number }>((resolve, reject) => {
    let failed = false;
    rec.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalText += (finalText ? ' ' : '') + r[0].transcript.trim();
          confidence += r[0].confidence || 0;
          n++;
        } else interim += r[0].transcript;
      }
      onInterim?.((finalText + ' ' + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' && finalText) return;
      failed = true;
      reject(new Error(recognitionError(e.error)));
    };
    rec.onend = () => {
      if (failed) return;
      const text = (finalText + ' ' + interim).trim();
      if (!text) reject(new Error(recognitionError('no-speech')));
      else resolve({ transcript: text, confidence: n ? confidence / n : 0 });
    };
  });
  try {
    rec.start();
  } catch (err) {
    return { stop() {}, result: Promise.reject(err instanceof Error ? err : new Error(String(err))) };
  }
  return { stop: () => rec.stop(), result };
}
