import { describe, expect, it } from 'vitest';
import { checkAnswer, containsPhrase, diffWords, expandTemplate, firstLetters, normalize, wordOverlap } from '../src/engine/answer';

describe('normalize', () => {
  it('ignora mayúsculas, puntuación y apóstrofos tipográficos', () => {
    expect(normalize("  I’m FROM Colombia!! ")).toBe('i am from colombia');
  });
  it('expande contracciones frecuentes', () => {
    expect(normalize("I don't know")).toBe(normalize('I do not know'));
    expect(normalize("She doesn't work")).toBe('she does not work');
    expect(normalize("I can't")).toBe(normalize('I cannot'));
    expect(normalize("We're late")).toBe('we are late');
    expect(normalize("I'd like a coffee")).toBe('i would like a coffee');
    expect(normalize("She's been there")).toBe('she has been there');
    expect(normalize("It's warm")).toBe('it is warm');
  });
  it('mantiene posesivos', () => {
    expect(normalize("Maria's laptop")).toBe("maria's laptop");
  });
  it('unifica números escritos y en cifras', () => {
    expect(normalize("I'm twenty-eight")).toBe(normalize("I'm 28"));
    expect(normalize('at seven a.m.')).toBe('at 7 am');
  });
});

describe('expandTemplate', () => {
  it('expande alternativas y opcionales', () => {
    expect(expandTemplate('I {want|need} to go(, please)').sort()).toEqual(
      ['I need to go', 'I need to go, please', 'I want to go', 'I want to go, please'].sort(),
    );
  });
});

describe('checkAnswer', () => {
  it('acepta variantes con contracción y sin puntuación', () => {
    expect(checkAnswer('i am from colombia', ["I'm from Colombia."]).result).toBe('correct');
    expect(checkAnswer("What's your name", ['What is your name?']).result).toBe('correct');
  });
  it('acepta comodines', () => {
    expect(checkAnswer("I'm from Peru", ["I'm from *"]).result).toBe('correct');
    expect(checkAnswer("I'm from", ["I'm from *"]).result).not.toBe('correct');
    expect(checkAnswer("I'm 31", ["I'm #"]).result).toBe('correct');
  });
  it('marca erratas pequeñas como «close»', () => {
    expect(checkAnswer('Nice to meat you', ['Nice to meet you.']).result).toBe('close');
  });
  it('rechaza respuestas incorrectas', () => {
    expect(checkAnswer('I have 28 years', ["I'm 28(.)"]).result).toBe('wrong');
  });
  it('acepta por claves y por anyOf', () => {
    expect(checkAnswer('Hello Ana! I am Diego, nice to meet you', ['Hi Ana, I\'m *. Nice to meet you.'], ['nice to meet you']).result).toBe('correct');
    expect(checkAnswer('Sorry, could you say that again?', ['Could you repeat that?'], undefined, ['repeat that', 'say that again']).result).toBe('correct');
  });
});

describe('containsPhrase', () => {
  it('respeta límites de palabra y comodines', () => {
    expect(containsPhrase('What does deadline mean?', 'what does * mean')).toBe(true);
    expect(containsPhrase('I am from Cali', "I'm from")).toBe(true);
    expect(containsPhrase('I mfrom', "I'm from")).toBe(false);
    expect(containsPhrase("I'm twenty-eight years old", "I'm # years old")).toBe(true);
  });
});

describe('ayudas', () => {
  it('genera pistas de primeras letras', () => {
    expect(firstLetters("I'm from Colombia")).toBe("I'm f___ C_______");
  });
  it('calcula diferencias palabra a palabra', () => {
    const d = diffWords('I from Colombia', "I'm from Colombia");
    expect(d.some((w) => w.status === 'missing')).toBe(true);
  });
  it('mide coincidencia de transcripción', () => {
    expect(wordOverlap('could you repeat that please', 'Could you repeat that, please?')).toBe(1);
    expect(wordOverlap('could you', 'Could you repeat that')).toBe(0.5);
  });
});
