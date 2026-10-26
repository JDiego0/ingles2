/**
 * Reconocimiento de voz en el dispositivo (Moonshine Base, licencia MIT) con transformers.js.
 * Corre en un worker para no congelar la interfaz. El modelo se descarga una vez y el
 * navegador lo guarda en su caché.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

export const STT_MODEL = 'onnx-community/moonshine-base-ONNX';

env.allowLocalModels = false;

export type WorkerIn = { type: 'load' } | { type: 'transcribe'; id: number; audio: Float32Array };
export type WorkerOut =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'error'; message: string; id?: number }
  | { type: 'result'; id: number; text: string };

const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function load() {
  if (asr) return asr;
  const files = new Map<string, { loaded: number; total: number }>();
  asr = pipeline('automatic-speech-recognition', STT_MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      post({ type: 'progress', loaded, total });
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
  asr.then(
    () => post({ type: 'ready' }),
    (e: unknown) => {
      asr = null;
      post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    },
  );
  return asr;
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === 'load') {
    load().catch(() => undefined);
    return;
  }
  try {
    const p = await load();
    const seconds = m.audio.length / 16000;
    // Límite de palabras según la duración: evita que el modelo «invente» texto repetido.
    const out = await p(m.audio, { max_new_tokens: Math.ceil(seconds * 8) + 10 } as Record<string, unknown>);
    const text = (Array.isArray(out) ? out[0] : out).text;
    post({ type: 'result', id: m.id, text: text.trim() });
  } catch (err) {
    post({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
  }
};
