import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidatesFrom, collapseRepeats, mergePieces } from '../src/speech/recognition';
import { pickMatching } from '../src/components/exercises/AnswerFlow';
import { bankFor } from '../src/components/exercises/WordBank';

const result = (isFinal: boolean, ...alts: string[]) => Object.assign(alts.map((transcript) => ({ transcript, confidence: 0.9 })), { isFinal });

describe('reconocimiento de voz: sin palabras duplicadas', () => {
  it('quita repeticiones consecutivas', () => {
    expect(collapseRepeats('hello hello hello my name is Diego')).toBe('hello my name is Diego');
    expect(collapseRepeats('my name is my name is Diego')).toBe('my name is Diego');
    expect(collapseRepeats('I work in Bogotá')).toBe('I work in Bogotá');
  });

  it('fusiona los resultados acumulativos de Chrome para Android', () => {
    expect(mergePieces(['hello', 'hello my', 'hello my name', 'hello my name is Diego'])).toBe('hello my name is Diego');
    expect(mergePieces(['hello my name is Diego', 'hello my name is Diego'])).toBe('hello my name is Diego');
    expect(mergePieces(['hello my name', 'name is Diego'])).toBe('hello my name is Diego');
    expect(mergePieces(['I live in Medellín', 'and I work from home'])).toBe('I live in Medellín and I work from home');
  });

  it('reconstruye el texto completo de la lista de resultados', () => {
    const list = [result(true, 'hello'), result(true, 'hello my name'), result(false, 'hello my name is Diego', 'hello my name is the ego')];
    expect(candidatesFrom(list)).toEqual(['hello my name is Diego', 'hello my name is the ego']);
  });

  it('elige la interpretación que coincide con la respuesta esperada', () => {
    const alts = ['hello my name is the ego', 'hello my name is Diego'];
    expect(pickMatching(alts, ['{Hello|Hi}, my name is *'])).toBe('hello my name is the ego');
    expect(pickMatching(['I have twenty eight years', 'I am twenty eight years old'], ["I'm # years old"])).toBe('I am twenty eight years old');
    expect(pickMatching(['nothing alike'], ['Nice to meet you'])).toBeUndefined();
  });
});

describe('bloques de palabras', () => {
  it('contiene todas las palabras de la frase y como mucho dos distractores', () => {
    const target = 'She is from Colombia';
    const bank = bankFor(target, 'x');
    for (const w of target.split(' ')) expect(bank).toContain(w);
    expect(bank.length).toBeLessThanOrEqual(target.split(' ').length + 2);
    expect(bank).toContain('are');
  });
});

describe('micrófono de Chrome: una sola sesión, sin reinicios', () => {
  /** Reconocedor falso: cada sesión «oye» el siguiente guion y termina sola (silencio). */
  function fakeRecognizer(scripts: string[][]) {
    const sessions: FakeRec[] = [];
    class FakeRec {
      lang = '';
      interimResults = false;
      maxAlternatives = 1;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      ended = false;
      start() {
        sessions.push(this);
        const steps = scripts[sessions.length - 1] ?? [];
        const res: ReturnType<typeof result>[] = [];
        steps.forEach((t, i) =>
          setTimeout(() => {
            // Como Chrome Android: cada resultado repite el texto anterior.
            res.push(result(true, t));
            this.onresult?.({ resultIndex: res.length - 1, results: [...res] });
          }, 100 * (i + 1)),
        );
        if (!steps.length) setTimeout(() => this.onerror?.({ error: 'no-speech' }), 50);
        // Silencio: el navegador corta la sesión.
        setTimeout(() => this.end(), 100 * steps.length + 300);
      }
      end() {
        if (this.ended) return;
        this.ended = true;
        this.onend?.();
      }
      stop() {
        setTimeout(() => this.end(), 20);
      }
      abort() {
        this.end();
      }
    }
    vi.stubGlobal('window', { webkitSpeechRecognition: FakeRec });
    return sessions;
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('al cortar por silencio entrega lo oído sin duplicar y no vuelve a abrir el micrófono', async () => {
    // Cada reinicio encendía y apagaba el micrófono en Android (icono intermitente y pitidos).
    const sessions = fakeRecognizer([['I live', 'I live in Medellín'], ['and I work']]);
    const { startRecognition } = await import('../src/speech/recognition');
    const interim: string[] = [];
    const h = startRecognition((t) => interim.push(t));
    await vi.advanceTimersByTimeAsync(2500);
    const r = await h.result;
    expect(r.transcript).toBe('I live in Medellín');
    expect(sessions.length).toBe(1);
  });

  it('sin hablar nada, termina con un aviso en vez de escuchar para siempre', async () => {
    fakeRecognizer([[], [], [], [], [], []]);
    const { startRecognition } = await import('../src/speech/recognition');
    const h = startRecognition();
    const settled = h.result.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await settled).toMatch(/No te escuché/);
  });
});
