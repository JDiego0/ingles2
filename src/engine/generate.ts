/**
 * Ejercicios generados automáticamente a partir de un chunk.
 * Permiten repasar cualquier expresión de la biblioteca sin escribir ejercicios a mano.
 */
import type { Chunk, ChoiceExercise, OrderExercise, TypeExercise } from '../types/content';
import { containsPhrase, wordCount } from './answer';

export const chunkPhrases = (c: Chunk): string[] => [c.core, ...(c.alt ?? [])];

export const usesChunk = (text: string, c: Chunk): boolean => chunkPhrases(c).some((p) => containsPhrase(text, p));

/** Forma de visualización del chunk con «…» convertida a plantilla. */
const asTemplate = (en: string) => en.replace(/…|\.\.\./g, '*').replace(/\s+/g, ' ').trim();

/** Del significado en español a la expresión en inglés. */
export function meaningExercise(c: Chunk, prefix: string): TypeExercise {
  return {
    kind: 'type',
    id: `${prefix}.meaning.${c.id}`,
    prompt: `¿Cómo dices en inglés: «${c.es}»?`,
    accept: [asTemplate(c.en), c.example.en],
    anyOf: chunkPhrases(c),
    skills: ['vocabulary', 'writing'],
    chunks: [c.id],
  };
}

/** Pregunta o situación que exige la expresión. */
export function askExercise(c: Chunk, prefix: string): TypeExercise {
  return {
    kind: 'type',
    id: `${prefix}.ask.${c.id}`,
    prompt: c.ask,
    accept: [c.example.en],
    anyOf: chunkPhrases(c),
    skills: ['fluency', 'writing'],
    chunks: [c.id],
    explain: `Usa «${c.en}» en tu respuesta.`,
  };
}

const escapeRe = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** Busca en el ejemplo el fragmento que corresponde al chunk (respetando el texto original). */
export function findChunkInExample(c: Chunk): string | null {
  const text = c.example.en;
  for (const phrase of chunkPhrases(c)) {
    const parts = phrase.split(/(\*|#)/).map((p) => (p === '*' ? '[^.?!]+?' : p === '#' ? '[\\w-]+' : escapeRe(p.trim()).replace(/'/g, "['’]")));
    const src = parts.filter(Boolean).join('\\s*');
    const m = text.match(new RegExp(src.replace(/ /g, '\\s+'), 'i'));
    if (m && m[0].trim()) return m[0];
  }
  return null;
}

/** Completar la frase de ejemplo (el chunk se oculta). */
export function clozeExercise(c: Chunk, prefix: string): TypeExercise | null {
  const piece = findChunkInExample(c);
  if (!piece) return null;
  const blanks = piece.split(/\s+/).map(() => '___').join(' ');
  return {
    kind: 'type',
    id: `${prefix}.cloze.${c.id}`,
    prompt: `Completa la frase. Significa: «${c.example.es}»`,
    context: c.example.en.replace(piece, blanks),
    accept: [piece, c.example.en],
    skills: ['vocabulary', 'grammar'],
    chunks: [c.id],
  };
}

/** Escuchar el ejemplo y reconstruirlo. */
export function rebuildExercise(c: Chunk, prefix: string): OrderExercise | null {
  const n = wordCount(c.example.en);
  if (n < 3 || n > 12) return null;
  return {
    kind: 'order',
    id: `${prefix}.rebuild.${c.id}`,
    prompt: 'Escucha y reconstruye la frase.',
    sentence: c.example.en,
    audio: true,
    skills: ['listening', 'grammar'],
    chunks: [c.id],
  };
}

/** Sustitución: crear una frase propia con la estructura. */
export function substitutionExercise(c: Chunk, prefix: string): TypeExercise {
  return {
    kind: 'type',
    id: `${prefix}.sub.${c.id}`,
    prompt: `Crea una frase TUYA con «${c.en}». Cambia las otras palabras.`,
    accept: [c.example.en],
    anyOf: chunkPhrases(c),
    skills: ['writing', 'grammar'],
    chunks: [c.id],
    explain: c.task,
  };
}

/** Comprobación de comprensión: elegir la versión correcta frente al error típico. */
export function errorCheckExercise(c: Chunk, prefix: string, flip: boolean): ChoiceExercise | null {
  const e = c.errors[0];
  if (!e) return null;
  return {
    kind: 'choice',
    id: `${prefix}.check.${c.id}`,
    prompt: '¿Cuál suena natural en inglés?',
    options: flip ? [e.wrong, e.right] : [e.right, e.wrong],
    answer: flip ? 1 : 0,
    explain: e.why,
    skills: ['grammar', 'reading'],
    chunks: [c.id],
  };
}

/** Si la respuesta es muy corta para una frase propia. */
export const tooShortForSentence = (text: string) => wordCount(text) < 3;
