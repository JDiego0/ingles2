/**
 * Reconocimiento de voz en el dispositivo (Whisper Base en inglés, licencia MIT) con transformers.js.
 * Corre en un worker para no congelar la interfaz. El modelo se descarga una vez y el
 * navegador lo guarda en su caché.
 *
 * Whisper acepta un «texto anterior» (prompt): se le pasa el vocabulario del tema que se está
 * practicando y así escribe bien nombres como «Medellín» o palabras dichas con acento.
 *
 * Velocidad: la parte pesada (el codificador, que analiza siempre 30 s de audio) corre en la
 * tarjeta gráfica si el navegador tiene WebGPU; si no, en el procesador con varios núcleos
 * (el service worker activa el aislamiento que lo permite). El decodificador, ligero, va en el procesador.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline, type Tensor } from '@huggingface/transformers';

export const STT_MODEL = 'onnx-community/whisper-base.en';

env.allowLocalModels = false;

export type SttBackend = 'webgpu' | 'wasm';
export type WorkerIn = { type: 'load'; gpu?: boolean } | { type: 'transcribe'; id: number; audio: Float32Array; prompt?: string };
export type WorkerOut =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; backend: SttBackend; threads: number }
  | { type: 'error'; message: string; id?: number }
  | { type: 'result'; id: number; text: string };

const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

const threads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)) : 1;
const onnx = env.backends.onnx as { wasm?: { numThreads?: number } };
if (onnx.wasm) onnx.wasm.numThreads = threads;

async function gpuAvailable(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

interface Loaded {
  p: AutomaticSpeechRecognitionPipeline;
  backend: SttBackend;
}

let asr: Promise<Loaded> | null = null;

function create(backend: SttBackend, onProgress: (p: { status: string; file?: string; loaded?: number; total?: number }) => void) {
  return pipeline('automatic-speech-recognition', STT_MODEL, {
    // El codificador cuantizado pierde bastante precisión; el decodificador no.
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
    device: backend === 'webgpu' ? { encoder_model: 'webgpu', decoder_model_merged: 'wasm' } : 'wasm',
    progress_callback: onProgress,
  } as Record<string, unknown>) as Promise<AutomaticSpeechRecognitionPipeline>;
}

function load(useGpu = true) {
  if (asr) return asr;
  const files = new Map<string, { loaded: number; total: number }>();
  const onProgress = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== 'progress' || !p.file || !p.total) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    post({ type: 'progress', loaded, total });
  };
  asr = (async (): Promise<Loaded> => {
    if (useGpu && (await gpuAvailable())) {
      let p: AutomaticSpeechRecognitionPipeline | null = null;
      try {
        p = await create('webgpu', onProgress);
        // Precalentar: la primera pasada compila los programas de la tarjeta gráfica.
        await run(p, new Float32Array(16000));
        return { p, backend: 'webgpu' };
      } catch {
        // WebGPU incompleto en este teléfono: se usa el procesador.
        await p?.dispose().catch(() => undefined);
      }
    }
    const p = await create('wasm', onProgress);
    await run(p, new Float32Array(16000));
    return { p, backend: 'wasm' };
  })();
  asr.then(
    (l) => post({ type: 'ready', backend: l.backend, threads }),
    (e: unknown) => {
      asr = null;
      post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    },
  );
  return asr;
}

/** Ids de los tokens especiales (de generation_config.json; valores de whisper-*.en por si faltan). */
function specialIds(p: AutomaticSpeechRecognitionPipeline) {
  const g = (p.model as unknown as { generation_config?: Record<string, number> }).generation_config ?? {};
  return { prev: g.prev_sot_token_id ?? 50360, sot: g.decoder_start_token_id ?? 50257, noTs: g.no_timestamps_token_id ?? 50362 };
}

async function run(p: AutomaticSpeechRecognitionPipeline, audio: Float32Array, prompt?: string): Promise<string> {
  const seconds = audio.length / 16000;
  const { input_features } = (await p.processor(audio)) as { input_features: Tensor };
  const { prev, sot, noTs } = specialIds(p);
  // <|startofprev|> nombres y frases del tema <|startoftranscript|> <|notimestamps|>; Whisper admite hasta ~220 tokens de prompt.
  const promptIds = prompt ? p.tokenizer.encode(` ${prompt.trim()}`, { add_special_tokens: false }).slice(-200) : [];
  const init = promptIds.length ? [prev, ...promptIds, sot, noTs] : [sot, noTs];
  const out = (await p.model.generate({
    inputs: input_features,
    decoder_input_ids: init,
    // Límite de palabras según la duración: evita que el modelo «invente» texto repetido.
    max_new_tokens: Math.ceil(seconds * 8) + 10,
  } as Record<string, unknown>)) as Tensor;
  const ids = (out.tolist() as bigint[][])[0].slice(init.length);
  return ids.length ? p.tokenizer.decode(ids, { skip_special_tokens: true }).trim() : '';
}

/** Las transcripciones van de una en una: el modelo no admite dos pasadas a la vez. */
let queue: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === 'load') {
    load(m.gpu !== false).catch(() => undefined);
    return;
  }
  queue = queue.then(async () => {
    try {
      const { p } = await load();
      let text = await run(p, m.audio, m.prompt);
      // Si con las frases del tema no sale nada, se repite sin ellas. (No se compara con el prompt:
      // decir justo la frase esperada es lo normal; el silencio ya se descarta antes de llegar aquí.)
      if (m.prompt && !text) text = await run(p, m.audio);
      post({ type: 'result', id: m.id, text });
    } catch (err) {
      post({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
    }
  });
};
