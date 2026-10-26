import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Sintetizador falso: cada frase «suena» 1 s; registra cuántas se lanzaron y si se solaparon. */
function installFakeSynth() {
  const log: string[] = [];
  let playing: { u: FakeUtterance; timer: ReturnType<typeof setTimeout> } | null = null;
  let overlaps = 0;
  class FakeUtterance {
    text: string;
    voice: unknown = null;
    lang = '';
    rate = 1;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(t: string) {
      this.text = t;
    }
  }
  const synth = {
    get speaking() {
      return !!playing;
    },
    pending: false,
    getVoices: () => [{ voiceURI: 'g', name: 'Google US English', lang: 'en-US' }],
    addEventListener() {},
    speak(u: FakeUtterance) {
      if (playing) overlaps++;
      log.push(u.text);
      const timer = setTimeout(() => {
        playing = null;
        u.onend?.();
      }, 1000);
      playing = { u, timer };
      setTimeout(() => u.onstart?.(), 10);
    },
    cancel() {
      if (!playing) return;
      const p = playing;
      clearTimeout(p.timer);
      playing = null;
      p.u.onerror?.({ error: 'interrupted' });
    },
  };
  vi.stubGlobal('window', { speechSynthesis: synth });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return { log, overlaps: () => overlaps };
}

describe('síntesis de voz sin audio doble', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('un doble toque sobre la misma frase la reproduce una sola vez', async () => {
    const fake = installFakeSynth();
    const { speak } = await import('../src/speech/tts');
    const a = speak('Nice to meet you');
    const b = speak('Nice to meet you');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(fake.log).toEqual(['Nice to meet you']);
  });

  it('una frase nueva corta la anterior en vez de sonar encima', async () => {
    const fake = installFakeSynth();
    const { speakResult } = await import('../src/speech/tts');
    const first = speakResult('Hello');
    await vi.advanceTimersByTimeAsync(300);
    const second = speakResult('Goodbye');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await first).toBe('interrupted');
    expect(await second).toBe('ok');
    expect(fake.overlaps()).toBe(0);
    expect(fake.log).toEqual(['Hello', 'Goodbye']);
  });

  it('una frase termina cuando termina el audio, no antes', async () => {
    installFakeSynth();
    const { speakResult } = await import('../src/speech/tts');
    let done = false;
    const p = speakResult('One two three').then((r) => {
      done = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toBe('ok');
  });
});
