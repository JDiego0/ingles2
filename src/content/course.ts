/**
 * Índice del curso. Para ampliar el contenido basta con crear un archivo en ./modules
 * que exporte `chunks` y `mod`, y añadirlo a la lista MODULE_FILES (en orden de la ruta).
 */
import type { Chunk, Exercise, Lesson, Module, Unit } from '../types/content';
import * as a1 from './modules/a1';
import * as a2 from './modules/a2';
import * as a3 from './modules/a3';
import * as a4 from './modules/a4';
import * as a5 from './modules/a5';
import * as b1 from './modules/b1';
import * as b2 from './modules/b2';
import * as b3 from './modules/b3';

const MODULE_FILES: { chunks: Chunk[]; mod: Module }[] = [a1, a2, a3, a4, a5, b1, b2, b3];

export const MODULES: Module[] = MODULE_FILES.map((f) => f.mod);
export const CHUNKS: Chunk[] = MODULE_FILES.flatMap((f) => f.chunks);

export const chunkById = new Map(CHUNKS.map((c) => [c.id, c]));
export const moduleById = new Map(MODULES.map((m) => [m.id, m]));

export interface LessonRef {
  lesson: Lesson;
  unit: Unit;
  module: Module;
  /** Posición global en la ruta (0…n-1). */
  index: number;
}

export const LESSONS: LessonRef[] = MODULES.flatMap((module) =>
  module.units.flatMap((unit) => unit.lessons.map((lesson) => ({ lesson, unit, module }))),
).map((ref, index) => ({ ...ref, index }));

export const lessonById = new Map(LESSONS.map((r) => [r.lesson.id, r]));

export const unitById = new Map(MODULES.flatMap((m) => m.units.map((u) => [u.id, { unit: u, module: m }] as const)));

/** Módulo en el que se introduce cada chunk (por lección o como extra). */
export const chunkHome = new Map<string, { module: Module; lesson?: Lesson }>();
for (const { lesson, module } of LESSONS) {
  for (const id of lesson.newChunks) if (!chunkHome.has(id)) chunkHome.set(id, { module, lesson });
}
for (const m of MODULES) for (const id of m.extraChunks ?? []) if (!chunkHome.has(id)) chunkHome.set(id, { module: m });

export function allExercises(): Exercise[] {
  const list: Exercise[] = [];
  for (const m of MODULES) {
    list.push(...m.assessment);
    for (const u of m.units) {
      list.push(...u.checkpoint);
      for (const l of u.lessons) {
        list.push(...l.context.gist, ...(l.practice ?? []), ...l.production, ...l.assessment);
      }
    }
  }
  return list;
}

/** Chunks enseñados en las lecciones anteriores a la indicada (para repasos y calentamiento). */
export function chunksBefore(lessonId: string): string[] {
  const ref = lessonById.get(lessonId);
  if (!ref) return [];
  return LESSONS.slice(0, ref.index).flatMap((r) => r.lesson.newChunks);
}
