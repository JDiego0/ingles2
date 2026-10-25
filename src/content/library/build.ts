/**
 * Constructor compacto para lotes de la biblioteca (chunks extra de cada módulo).
 * Orden: id, inglés, español, categoría, núcleo, alternativas, [ejemplo en, es], variantes,
 * [error, corrección, explicación], pregunta de recuperación, tarea, nota opcional.
 */
import type { Cefr, Chunk, ChunkCategory } from '../../types/content';

export interface LibraryBatch {
  module: string;
  chunks: Chunk[];
}

export const lib =
  (level: Cefr) =>
  (
    id: string,
    en: string,
    es: string,
    cat: ChunkCategory,
    core: string,
    alt: string[],
    ex: [string, string],
    variants: string[],
    err: [string, string, string],
    ask: string,
    task: string,
    note?: string,
  ): Chunk => ({
    id,
    en,
    es,
    level,
    cat,
    core,
    alt,
    example: { en: ex[0], es: ex[1] },
    variants,
    errors: [{ wrong: err[0], right: err[1], why: err[2] }],
    ask,
    task,
    ...(note ? { note } : {}),
  });
