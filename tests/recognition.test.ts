import { describe, expect, it } from 'vitest';
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
