/**
 * Motor de lecciones: convierte una lección del contenido en una secuencia de pasos
 * organizada en las 6 fases del método.
 */
import type { Chunk, Exercise, Lesson } from '../types/content';
import type { ChunkProgress, Grade, LessonSession } from '../types/progress';
import { chunkById, chunksBefore } from '../content/course';
import {
  askExercise,
  clozeExercise,
  errorCheckExercise,
  meaningExercise,
  rebuildExercise,
  substitutionExercise,
} from './generate';
import { masteryScore } from './srs';
import { seededShuffle } from '../utils/random';

export interface PhaseInfo {
  title: string;
  titleEn: string;
  minutes: number;
  intro: string;
  introEn: string;
}

export const PHASES: PhaseInfo[] = [
  { title: 'Calentamiento', titleEn: 'Warm-up', minutes: 4, intro: 'Recupera de memoria lo que ya estudiaste. Intenta responder antes de pedir pistas.', introEn: 'Recall what you studied before. Try to answer before asking for hints.' },
  { title: 'Comprensión', titleEn: 'Context', minutes: 5, intro: 'Escucha una situación real. Primero entiende la idea general; después revisa los detalles.', introEn: 'Listen to a real situation. First get the general idea; then check the details.' },
  { title: 'Expresiones nuevas', titleEn: 'New chunks', minutes: 5, intro: 'Aprende pocas expresiones, bien: significado, sonido, ejemplo, cómo reutilizarlas y el error típico.', introEn: 'Learn a few expressions well: meaning, sound, example, how to reuse them and the typical mistake.' },
  { title: 'Recuperación activa', titleEn: 'Active recall', minutes: 5, intro: 'Ahora sin ver las respuestas. Equivocarte aquí es parte del aprendizaje.', introEn: 'Now without seeing the answers. Making mistakes here is part of learning.' },
  { title: 'Producción libre', titleEn: 'Free production', minutes: 6, intro: 'Habla o escribe con tus propias palabras. No hay respuesta modelo visible.', introEn: 'Speak or write in your own words. There is no visible model answer.' },
  { title: 'Evaluación y cierre', titleEn: 'Check & wrap-up', minutes: 5, intro: 'Preguntas nuevas para comprobar lo aprendido, y tu pequeña victoria del día.', introEn: 'New questions to check what you learned, and your small victory of the day.' },
];

/** Contextos de uso (para saber si un chunk se usó en situaciones distintas). */
export type ActivityContext = 'warmup' | 'check' | 'recall' | 'production' | 'assessment' | 'victory' | 'review' | 'conversation' | 'context';

export type Step =
  | { kind: 'exercise'; phase: number; ex: Exercise; ctx: ActivityContext }
  | { kind: 'context'; phase: number }
  | { kind: 'grammar'; phase: number }
  | { kind: 'teach'; phase: number; chunkId: string }
  | { kind: 'summary'; phase: number }
  | { kind: 'victory'; phase: number };

/** Elige 3–5 chunks para el calentamiento: primero los vencidos, después los más débiles de lecciones previas. */
export function pickWarmup(lesson: Lesson, chunks: Record<string, ChunkProgress>, now: number): string[] {
  const exclude = new Set(lesson.newChunks);
  const due = Object.values(chunks)
    .filter((p) => p.nextReview <= now && !exclude.has(p.id) && chunkById.has(p.id))
    .sort((a, b) => a.nextReview - b.nextReview)
    .map((p) => p.id);
  // Entre los no vencidos, los más débiles primero y, a igualdad, los más recientes.
  const previous = [...chunksBefore(lesson.id)]
    .reverse()
    .filter((id) => !exclude.has(id) && !due.includes(id) && chunkById.has(id))
    .sort((a, b) => masteryScore(chunks[a]) - masteryScore(chunks[b]));
  return [...due, ...previous].slice(0, 4);
}

const get = (id: string): Chunk | undefined => chunkById.get(id);

export function buildLessonPlan(lesson: Lesson, warmup: string[]): Step[] {
  const steps: Step[] = [];
  const P = lesson.id;
  const fresh = lesson.newChunks.map(get).filter((c): c is Chunk => !!c);

  // Fase 1 · Calentamiento
  const warm = warmup.map(get).filter((c): c is Chunk => !!c);
  if (warm.length) {
    warm.forEach((c, i) => {
      const ex = i % 3 === 0 ? meaningExercise(c, `${P}.w`) : i % 3 === 1 ? askExercise(c, `${P}.w`) : clozeExercise(c, `${P}.w`) ?? meaningExercise(c, `${P}.w`);
      steps.push({ kind: 'exercise', phase: 0, ex, ctx: 'warmup' });
    });
  } else {
    steps.push({
      kind: 'exercise',
      phase: 0,
      ctx: 'warmup',
      ex: {
        kind: 'open',
        id: `${P}.w.start`,
        prompt: 'Antes de empezar: escribe o di en inglés todo lo que ya sepas para saludar o presentarte. No importa si no es perfecto.',
        minWords: 2,
        model: "Hello! Hi! My name is… I'm…",
        skills: ['writing'],
      },
    });
  }

  // Fase 2 · Comprensión contextual
  steps.push({ kind: 'context', phase: 1 });

  // Fase 3 · Chunks nuevos
  if (lesson.grammar) steps.push({ kind: 'grammar', phase: 2 });
  fresh.forEach((c, i) => {
    steps.push({ kind: 'teach', phase: 2, chunkId: c.id });
    const check = errorCheckExercise(c, `${P}.t`, i % 2 === 1);
    if (check) steps.push({ kind: 'exercise', phase: 2, ex: check, ctx: 'check' });
  });

  // Fase 4 · Recuperación activa (las pistas visibles van desapareciendo)
  const recall: Exercise[] = [];
  const shuffled = seededShuffle(fresh, P);
  for (const c of shuffled) recall.push(meaningExercise(c, `${P}.r`));
  shuffled.forEach((c, i) => {
    const alt = i % 2 === 0 ? clozeExercise(c, `${P}.r`) ?? rebuildExercise(c, `${P}.r`) : rebuildExercise(c, `${P}.r`) ?? clozeExercise(c, `${P}.r`);
    if (alt) recall.push(alt);
  });
  recall.push(...(lesson.practice ?? []));
  for (const c of seededShuffle(fresh, P + 'ask')) recall.push(askExercise(c, `${P}.r`));
  const older = chunksBefore(P).slice(-8);
  if (older.length) {
    const c = get(seededShuffle(older, P)[0]);
    if (c) recall.push(askExercise(c, `${P}.old`));
  }
  for (const ex of recall) steps.push({ kind: 'exercise', phase: 3, ex, ctx: 'recall' });

  // Fase 5 · Producción libre
  const subs = seededShuffle(fresh, P + 'sub').slice(0, 2);
  for (const c of subs) steps.push({ kind: 'exercise', phase: 4, ex: substitutionExercise(c, `${P}.p`), ctx: 'production' });
  for (const ex of lesson.production) steps.push({ kind: 'exercise', phase: 4, ex, ctx: 'production' });

  // Fase 6 · Evaluación y cierre
  for (const ex of lesson.assessment) steps.push({ kind: 'exercise', phase: 5, ex, ctx: 'assessment' });
  steps.push({ kind: 'victory', phase: 5 });
  steps.push({ kind: 'summary', phase: 5 });
  return steps;
}

export function victoryId(lessonId: string) {
  return `${lessonId}.victory`;
}

export interface LessonSummary {
  recalled: string[];
  hinted: string[];
  missed: string[];
  /** Media de la fase de evaluación (0–1). */
  score: number;
}

/** Resume la sesión: qué chunks se recuperaron, cuáles con pista y cuáles no. */
export function summarize(lesson: Lesson, steps: Step[], session: Pick<LessonSession, 'results'>): LessonSummary {
  const last = new Map<string, Grade>();
  for (const s of steps) {
    if (s.kind !== 'exercise' || s.phase < 3) continue;
    const r = session.results[s.ex.id];
    if (!r) continue;
    for (const id of s.ex.chunks ?? []) if (lesson.newChunks.includes(id)) last.set(id, r.g);
  }
  const v = session.results[victoryId(lesson.id)];
  if (v) for (const id of lesson.victory.targets) if (lesson.newChunks.includes(id) && v.g !== 'fail') last.set(id, v.g);

  const recalled: string[] = [];
  const hinted: string[] = [];
  const missed: string[] = [];
  for (const id of lesson.newChunks) {
    const g = last.get(id);
    if (g === 'unaided' || g === 'spontaneous') recalled.push(id);
    else if (g === 'hinted' || g === 'recognized') hinted.push(id);
    else missed.push(id);
  }
  const scores = lesson.assessment.map((e) => session.results[e.id]?.s ?? 0);
  const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return { recalled, hinted, missed, score };
}
