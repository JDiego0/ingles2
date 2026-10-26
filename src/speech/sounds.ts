/**
 * Sonidos de la app (acierto, error, micrófono), sintetizados con Web Audio:
 * no hay archivos que descargar y suenan igual en todos los dispositivos.
 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundsEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!ctx) ctx = new C();
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

interface Note {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Frecuencia final (deslizamiento). */
  to?: number;
}

function play(notes: Note[]) {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.01;
  const master = c.createGain();
  master.gain.value = 0.22;
  master.connect(c.destination);
  for (const n of notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = n.type ?? 'sine';
    o.frequency.setValueAtTime(n.freq, t0 + n.at);
    if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.dur);
    // Ataque corto y caída suave: suena a campanita, no a pitido.
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(n.gain ?? 1, t0 + n.at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    o.connect(g).connect(master);
    o.start(t0 + n.at);
    o.stop(t0 + n.at + n.dur + 0.05);
  }
}

/** Dos notas ascendentes (do–sol) con un brillo de octava. */
export function soundSuccess() {
  play([
    { freq: 523.25, at: 0, dur: 0.35 },
    { freq: 1046.5, at: 0, dur: 0.2, gain: 0.25 },
    { freq: 783.99, at: 0.11, dur: 0.5 },
    { freq: 1567.98, at: 0.11, dur: 0.3, gain: 0.2 },
  ]);
}

/** Respuesta casi correcta: una sola nota amable. */
export function soundClose() {
  play([{ freq: 659.25, at: 0, dur: 0.35 }, { freq: 1318.5, at: 0, dur: 0.2, gain: 0.2 }]);
}

/** Dos notas graves y cortas, descendentes: avisa sin regañar. */
export function soundError() {
  play([
    { freq: 311.13, at: 0, dur: 0.16, type: 'triangle', gain: 0.9 },
    { freq: 233.08, at: 0.13, dur: 0.28, type: 'triangle', gain: 0.9, to: 220 },
  ]);
}

export function soundMicOn() {
  play([{ freq: 880, at: 0, dur: 0.09, gain: 0.5, to: 1175 }]);
}

export function soundMicOff() {
  play([{ freq: 1175, at: 0, dur: 0.09, gain: 0.5, to: 784 }]);
}
