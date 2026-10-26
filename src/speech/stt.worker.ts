/**
 * Reconocimiento de voz en el dispositivo (Whisper Base en inglés, licencia MIT) con transformers.js.
 * Corre en un worker para no congelar la interfaz. El modelo se descarga una vez y el
 * navegador lo guarda en su caché.
 *
 * Whisper acepta un «texto anterior» (prompt): se le pasa el vocabulario del tema que se está
 * practicando y así escribe bien nombres como «Medellín» o palabras dichas con acento.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline, type Tensor } from '@huggingface/transformers';

export const STT_MODEL = 'onnx-community/whisper-base.en';

env.allowLocalModels = false;

export type WorkerIn = { type: 'load' } | { type: 'transcribe'; id: number; audio: Float32Array; prompt?: string };
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
    // El codificador cuantizado pierde bastante precisión; el decodificador no.
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
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

/** Ids de los tokens especiales (de generation_config.json; valores de whisper-*.en por si faltan). */
function specialIds(p: AutomaticSpeechRecognitionPipeline) {
  const g = (p.model as unknown as { generation_config?: Record<string, number> }).generation_config ?? {};
  return { prev: g.prev_sot_token_id ?? 50360, sot: g.decoder_start_token_id ?? 50257, noTs: g.no_timestamps_token_id ?? 50362 };
}

async function run(p: AutomaticSpeechRecognitionPipeline, audio: Float32Array, prompt?: string): Promise<string> {
  const seconds = audio.length / 16000;
  const { input_features } = (await p.processor(audio)) as { input_features: Tensor };
  const { prev, sot, noTs } = specialIds(p);
  // <|startofprev|> vocabulario <|startoftranscript|> <|notimestamps|>; el prompt se limita a ~120 tokens.
  const promptIds = prompt ? p.tokenizer.encode(` ${prompt.trim()}`, { add_special_tokens: false }).slice(-120) : [];
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

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === 'load') {
    load().catch(() => undefined);
    return;
  }
  try {
    const p = await load();
    let text = await run(p, m.audio, m.prompt);
    // Si con el vocabulario no sale nada o solo repite un trozo de la lista (pasa con audio poco claro), se repite sin él.
    const echo = text.split(/\s+/).length >= 3 && m.prompt?.toLowerCase().includes(text.toLowerCase().replace(/[.]+$/, ''));
    if (m.prompt && (!text || echo)) text = await run(p, m.audio);
    post({ type: 'result', id: m.id, text });
  } catch (err) {
    post({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
  }
};
