import { describe, expect, it } from 'vitest';
import { detectErrors, topErrors } from '../src/engine/errors';

const keys = (t: string) => detectErrors(t).map((e) => e.key);

describe('detector de errores frecuentes', () => {
  it('detecta errores típicos de hispanohablantes', () => {
    expect(keys('I have 28 years.')).toContain('age-have');
    expect(keys('I am agree with you.')).toContain('agree-be');
    expect(keys('It depends of the project.')).toContain('depend-of');
    expect(keys('Can you explain me the task?')).toContain('explain-me');
    expect(keys('I work here since 3 years.')).toContain('since-duration');
    expect(keys('Is very important.')).toContain('missing-it');
    expect(keys('She work in a bank.')).toContain('third-person-s');
    expect(keys('Did you went to the meeting?')).toContain('did-past');
    expect(keys('I am live in Medellín.')).toContain('be-plus-verb');
    expect(keys('I can to help you.')).toContain('modal-to');
    expect(keys('Java is more easy.')).toContain('more-er');
    expect(keys('I no like coffee.')).toContain('no-negation');
  });

  it('no marca frases correctas', () => {
    const ok = [
      "I'm 28 years old.",
      'I agree with you.',
      'It depends on the project.',
      'Can you explain the task to me?',
      'Does she work in a bank?',
      'She can work from home.',
      'I want to help her.',
      'Did you go to the meeting?',
      "I live in Medellín and I work as a developer.",
      'Is it important?',
      'He usually works from home.',
      "I don't like coffee.",
    ];
    for (const s of ok) expect(keys(s), s).toEqual([]);
  });

  it('propone una corrección', () => {
    const [e] = detectErrors('Did you went to the meeting?');
    expect(e.fix.toLowerCase()).toContain('go');
  });

  it('selecciona los errores más importantes sin repetir', () => {
    const errs = detectErrors('I have 28 years. I am agree. She work here. I no like it.');
    const top = topErrors(errs, 3);
    expect(top).toHaveLength(3);
    expect(new Set(top.map((e) => e.key)).size).toBe(3);
  });
});
