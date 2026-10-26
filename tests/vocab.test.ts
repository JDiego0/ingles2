import { describe, expect, it } from 'vitest';
import { COMMON_PROPER, correctTranscript, promptFor, termsFrom } from '../src/speech/vocab';
import { LESSONS, chunkById } from '../src/content/course';

const terms = termsFrom(['I live in Medellín, in a quiet neighborhood.', 'I work as a software engineer.'], ['Diego'], COMMON_PROPER);

describe('voz: ayudas del tema', () => {
  it('saca nombres propios y palabras del tema de las frases', () => {
    const byText = new Map(terms.map((t) => [t.text, t]));
    expect(byText.get('Medellín')?.proper).toBe(true);
    expect(byText.get('neighborhood')?.proper).toBe(false);
    expect(byText.get('software')).toBeTruthy();
    expect(byText.has('live')).toBe(true);
    expect([...byText.keys()]).not.toContain('I');
  });

  it('quita la notación de las respuestas aceptadas', () => {
    const t = termsFrom(["{I'm|I am} from (beautiful) Cartagena"]).map((x) => x.text);
    expect(t).toContain('Cartagena');
    expect(t.join(' ')).not.toMatch(/[{}|()]/);
  });

  it('el texto para el modelo: nombres primero y frases del tema, la esperada al final', () => {
    const p = promptFor(terms, ['I live in a quiet neighborhood.', "{I'm|I am} a software engineer (now)", 'I live in a quiet neighborhood.']);
    expect(p.indexOf('Medellín')).toBeGreaterThan(p.indexOf('Cartagena'));
    expect(p.indexOf('Diego')).toBeLessThan(p.indexOf('I live'));
    expect(p.endsWith('I live in a quiet neighborhood.')).toBe(true);
    expect(p).toContain("I'm a software engineer now.");
    expect(p.match(/quiet/g)).toHaveLength(1);
    expect(p).not.toMatch(/[{}|()]/);
    expect(promptFor(terms, Array(200).fill(0).map((_, i) => `Sentence number ${i}.`)).length).toBeLessThanOrEqual(900);
  });

  it('arrastra lo que suena parecido al nombre esperado', () => {
    expect(correctTranscript('I live in Medellin.', terms)).toBe('I live in Medellín.');
    expect(correctTranscript('I live in medicine', terms)).toBe('I live in Medellín');
    expect(correctTranscript('I live in Madeline with my family', terms)).toBe('I live in Medellín with my family');
    expect(correctTranscript('I live in met a gene', terms)).toBe('I live in Medellín');
    expect(correctTranscript('I am from bogota', terms)).toBe('I am from Bogotá');
    expect(correctTranscript('My name is the ego', terms)).toBe('My name is Diego');
  });

  it('corrige palabras del tema mal entendidas', () => {
    expect(correctTranscript('a quiet neighbor hood', terms)).toBe('a quiet neighborhood');
    expect(correctTranscript('a quiet naber hood', terms)).toBe('a quiet neighborhood');
  });

  it('no cambia lo que ya está bien ni palabras comunes poco parecidas', () => {
    expect(correctTranscript('I live in a big house', terms)).toBe('I live in a big house');
    expect(correctTranscript('I like my job', terms)).toBe('I like my job');
    expect(correctTranscript('I think so', termsFrom(['the thing is'])).toLowerCase()).toBe('i think so');
    expect(correctTranscript('', terms)).toBe('');
  });
});

describe('voz: no estropea frases correctas', () => {
  it('con el vocabulario de cada lección, casi ninguna frase correcta de otras lecciones cambia', () => {
    const sentences = LESSONS.flatMap(({ lesson }) => lesson.newChunks.map((id) => chunkById.get(id)!.example.en));
    let changed = 0;
    let total = 0;
    for (const { lesson } of LESSONS) {
      const texts = lesson.newChunks.flatMap((id) => [chunkById.get(id)!.en, chunkById.get(id)!.example.en]).concat(lesson.victory.model);
      const t = termsFrom(texts, ['Diego'], COMMON_PROPER);
      for (let k = 0; k < 15; k++) {
        const s = sentences[(k * 37 + lesson.id.length * 11) % sentences.length];
        total++;
        if (correctTranscript(s, t) !== s) changed++;
      }
    }
    expect(changed / total).toBeLessThan(0.01);
  });
});
