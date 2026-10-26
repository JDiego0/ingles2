/**
 * Reconocimiento de voz en el dispositivo: se graba con un solo micrófono abierto hasta
 * pulsar «Listo» (sin los cortes, pitidos ni parpadeos del reconocimiento de Chrome en Android)
 * y luego el modelo de stt.worker.ts transcribe la grabación. Funciona sin conexión una vez
 * descargado el modelo.
 */
import { recognitionError, type RecognitionOutcome } from './recognition';
import type { SttBackend, WorkerIn, WorkerOut } from './stt.worker';

const RATE = 16000;
// v2: Whisper (antes Moonshine). Con otra clave, se vuelve a pedir permiso para la descarga nueva.
const DOWNLOADED_KEY = 'english-journey:stt-model-v2';
const GPU_KEY = 'english-journey:stt-gpu';

export function localSttSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof OfflineAudioContext !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** true si el modelo ya se descargó alguna vez en este navegador (cargarlo no gasta datos). */
export function sttModelDownloaded(): boolean {
  try {
    return localStorage.getItem(DOWNLOADED_KEY) === '1';
  } catch {
    return false;
  }
}

export interface SttStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  /** 0–1 durante la descarga. */
  progress: number;
  /** MB totales del modelo, cuando se conocen. */
  totalMb: number;
  error?: string;
  /** Dónde corre: tarjeta gráfica (WebGPU) o procesador, y con cuántos núcleos. */
  backend?: SttBackend;
  threads?: number;
  /** Segundos que tardó la última transcripción y duración de lo grabado. */
  lastSeconds?: number;
  lastAudioSeconds?: number;
}

let status: SttStatus = { state: 'idle', progress: 0, totalMb: 0 };
const listeners = new Set<(s: SttStatus) => void>();
function setStatus(s: Partial<SttStatus>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l(status));
}
export const sttStatus = () => status;
export function onSttStatus(l: (s: SttStatus) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>();

/** false si se desactivó la tarjeta gráfica en Ajustes (por si en algún teléfono funciona mal). */
export function sttGpuEnabled(): boolean {
  try {
    return localStorage.getItem(GPU_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Cambia el uso de la tarjeta gráfica; el modelo se vuelve a cargar con el nuevo ajuste. */
export function setSttGpu(enabled: boolean) {
  try {
    localStorage.setItem(GPU_KEY, enabled ? '1' : '0');
  } catch {
    /* sin almacenamiento: vale solo para esta sesión */
  }
  if (worker) {
    worker.terminate();
    worker = null;
    pending.forEach((p) => p.reject(new Error('Reconocedor reiniciado.')));
    pending.clear();
    setStatus({ state: 'idle', backend: undefined, threads: undefined });
    loadStt();
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    const m = e.data;
    if (m.type === 'progress') setStatus({ state: 'loading', progress: m.total ? m.loaded / m.total : 0, totalMb: Math.round(m.total / 1e6) });
    else if (m.type === 'ready') {
      try {
        localStorage.setItem(DOWNLOADED_KEY, '1');
      } catch {
        /* sin almacenamiento: solo se pierde el aviso de «ya descargado» */
      }
      setStatus({ state: 'ready', progress: 1, backend: m.backend, threads: m.threads });
    } else if (m.type === 'result') {
      pending.get(m.id)?.resolve(m.text);
      pending.delete(m.id);
    } else if (m.type === 'error') {
      if (m.id !== undefined) {
        pending.get(m.id)?.reject(new Error(m.message));
        pending.delete(m.id);
      } else {
        setStatus({ state: 'error', error: m.message });
        pending.forEach((p) => p.reject(new Error(m.message)));
        pending.clear();
      }
    }
  };
  worker.onerror = () => {
    setStatus({ state: 'error', error: 'No se pudo iniciar el reconocimiento de voz.' });
    worker = null;
  };
  return worker;
}

/** Empieza a descargar/cargar el modelo (si no estaba ya cargándose). */
export function loadStt() {
  if (status.state === 'loading' || status.state === 'ready') return;
  setStatus({ state: 'loading', progress: 0, error: undefined });
  getWorker().postMessage({ type: 'load', gpu: sttGpuEnabled() } satisfies WorkerIn);
}

function transcribe(audio: Float32Array, prompt?: string): Promise<string> {
  loadStt();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'transcribe', id, audio, prompt } satisfies WorkerIn, [audio.buffer]);
  });
}

/** Volumen (RMS) de cada tramo de 20 ms. */
function frameLevels(x: Float32Array, frame = RATE / 50): number[] {
  const out: number[] = [];
  for (let i = 0; i < x.length; i += frame) {
    let s = 0;
    const end = Math.min(x.length, i + frame);
    for (let j = i; j < end; j++) s += x[j] * x[j];
    out.push(Math.sqrt(s / Math.max(1, end - i)));
  }
  return out;
}

/**
 * Quita el silencio del principio y del final y parte las grabaciones largas en trozos
 * de hasta 20 s, cortando en la pausa más clara. null si no se oyó voz.
 */
export function prepareAudio(x: Float32Array): Float32Array[] | null {
  const frame = RATE / 50;
  const lv = frameLevels(x, frame);
  const peak = Math.max(0, ...lv);
  if (peak < 0.01) return null;
  const thr = Math.max(0.005, peak * 0.08);
  const first = lv.findIndex((v) => v > thr);
  let last = lv.length - 1;
  while (last > first && lv[last] <= thr) last--;
  const pad = 15; // 300 ms
  const a = Math.max(0, first - pad) * frame;
  const b = Math.min(lv.length, last + pad + 1) * frame;
  const voiced = x.slice(a, Math.min(b, x.length));
  if (voiced.length < RATE * 0.25) return null;
  const chunks: Float32Array[] = [];
  const max = 20 * RATE;
  let start = 0;
  while (voiced.length - start > max) {
    // La pausa más silenciosa entre los segundos 12 y 20 del trozo.
    const from = Math.floor((start + 12 * RATE) / frame);
    const to = Math.floor((start + max) / frame);
    const lv2 = frameLevels(voiced.subarray(from * frame, to * frame), frame);
    const cut = (from + lv2.indexOf(Math.min(...lv2))) * frame;
    chunks.push(voiced.slice(start, cut));
    start = cut;
  }
  chunks.push(voiced.slice(start));
  return chunks;
}

async function decode(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  // Un contexto a 16 kHz convierte la grabación a la frecuencia que espera el modelo.
  const ctx = new OfflineAudioContext(1, RATE, RATE);
  const audio = await ctx.decodeAudioData(buf);
  return audio.getChannelData(0);
}

export interface LocalRecognitionHandle {
  /** Deja de grabar y transcribe. */
  stop(): void;
  /** Deja de grabar sin transcribir. */
  cancel(): void;
  result: Promise<RecognitionOutcome>;
}

/**
 * Graba hasta `stop()` (máx. 3 min) y transcribe. `onLevel` recibe el volumen (0–1) mientras
 * se graba; `onPhase` avisa cuando empieza a transcribir; `prompt` es el vocabulario del tema.
 */
export function startLocalRecognition(
  opts: { onLevel?: (v: number) => void; onPhase?: (p: 'recording' | 'transcribing') => void; prompt?: string } = {},
): LocalRecognitionHandle {
  loadStt();
  let stopRequested = false;
  let cancelled = false;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let meter: AudioContext | null = null;
  let raf = 0;
  let limit: ReturnType<typeof setTimeout> | undefined;

  const release = () => {
    cancelAnimationFrame(raf);
    clearTimeout(limit);
    stream?.getTracks().forEach((t) => t.stop());
    meter?.close().catch(() => undefined);
    meter = null;
  };

  const result = (async (): Promise<RecognitionOutcome> => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      throw new Error(recognitionError(name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : 'audio-capture'));
    }
    if (stopRequested || cancelled) {
      release();
      throw new Error(recognitionError('aborted'));
    }
    if (opts.onLevel) {
      try {
        meter = new AudioContext();
        const an = meter.createAnalyser();
        an.fftSize = 512;
        meter.createMediaStreamSource(stream).connect(an);
        const data = new Float32Array(an.fftSize);
        const tick = () => {
          an.getFloatTimeDomainData(data);
          let s = 0;
          for (const v of data) s += v * v;
          opts.onLevel?.(Math.min(1, Math.sqrt(s / data.length) * 6));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* sin medidor de volumen */
      }
    }
    const rec = new MediaRecorder(stream);
    recorder = rec;
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data);
    };
    const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.start(1000);
    opts.onPhase?.('recording');
    limit = setTimeout(() => rec.state !== 'inactive' && rec.stop(), 3 * 60_000);
    await stopped;
    release();
    if (cancelled) throw new Error(recognitionError('aborted'));
    opts.onPhase?.('transcribing');
    const pcm = await decode(new Blob(parts, { type: rec.mimeType || 'audio/webm' }));
    const chunks = prepareAudio(pcm);
    if (!chunks) throw new Error(recognitionError('no-speech'));
    const texts: string[] = [];
    const started = performance.now();
    for (const c of chunks) texts.push(await transcribe(c, opts.prompt));
    setStatus({
      lastSeconds: Math.round((performance.now() - started) / 100) / 10,
      lastAudioSeconds: Math.round(chunks.reduce((n, c) => n + c.length, 0) / RATE),
    });
    const transcript = cleanTranscript(texts.join(' '));
    if (!transcript) throw new Error(recognitionError('no-speech'));
    return { transcript, alternatives: [transcript] };
  })();
  result.catch(() => undefined).finally(release);

  return {
    stop() {
      stopRequested = true;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    },
    cancel() {
      cancelled = true;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      else release();
    },
    result,
  };
}

/** Quita marcas que a veces produce el modelo con ruido («[BLANK_AUDIO]», «(music)»…). */
export function cleanTranscript(t: string): string {
  return t
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
