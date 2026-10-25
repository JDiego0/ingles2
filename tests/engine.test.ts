import { describe, expect, it } from 'vitest';
import { LESSONS, MODULES, chunkById } from '../src/content/course';
import { CONVERSATIONS } from '../src/content/conversations';
import { START_BY_ESTIMATE } from '../src/content/diagnostic';
import { buildLessonPlan, pickWarmup, summarize, victoryId } from '../src/engine/lessonPlan';
import { maxDepth, nextNode } from '../src/engine/conversation';
import { estimateFromBands } from '../src/engine/diagnostic';
import { clozeExercise, meaningExercise, usesChunk } from '../src/engine/generate';
import { checkAnswer } from '../src/engine/answer';
import { courseProgress, estimateLevel, flexibleStreak } from '../src/engine/stats';
import { addAssessment, introduceChunks } from '../src/engine/progress';
import { createInitialState } from '../src/storage/store';
import { DAY } from '../src/engine/srs';
import { dayKey } from '../src/utils/date';
import type { Grade } from '../src/types/progress';

describe('motor de lecciones', () => {
  const first = LESSONS[0].lesson;

  it('genera las 6 fases en orden y termina con victoria y resumen', () => {
    const plan = buildLessonPlan(first, []);
    const phases = plan.map((s) => s.phase);
    expect(new Set(phases)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    for (let i = 1; i < phases.length; i++) expect(phases[i]).toBeGreaterThanOrEqual(phases[i - 1]);
    expect(plan.at(-1)?.kind).toBe('summary');
    expect(plan.some((s) => s.kind === 'victory')).toBe(true);
  });

  it('cada lección produce recuperación activa sin opción múltiple dominante', () => {
    for (const { lesson } of LESSONS) {
      const plan = buildLessonPlan(lesson, []);
      const recall = plan.filter((s) => s.kind === 'exercise' && s.phase === 3);
      expect(recall.length, lesson.id).toBeGreaterThanOrEqual(lesson.newChunks.length * 2);
      const choices = recall.filter((s) => s.kind === 'exercise' && s.ex.kind === 'choice').length;
      expect(choices / recall.length, lesson.id).toBeLessThan(0.3);
      const ids = plan.flatMap((s) => (s.kind === 'exercise' ? [s.ex.id] : []));
      expect(new Set(ids).size, `${lesson.id}: ids repetidos en el plan`).toBe(ids.length);
    }
  });

  it('el plan es reproducible para retomar una lección', () => {
    const a = buildLessonPlan(LESSONS[5].lesson, ['hi-im', 'im-from']);
    const b = buildLessonPlan(LESSONS[5].lesson, ['hi-im', 'im-from']);
    expect(a).toEqual(b);
  });

  it('el calentamiento prioriza repasos vencidos y no incluye chunks nuevos', () => {
    const lesson = LESSONS[2].lesson;
    let s = createInitialState(0);
    s = introduceChunks(s, ['im-from', 'hi-im'], 0);
    const warm = pickWarmup(lesson, s.chunks, 10 * DAY);
    expect(warm.slice(0, 2).sort()).toEqual(['hi-im', 'im-from']);
    expect(warm.some((id) => lesson.newChunks.includes(id))).toBe(false);
  });

  it('resume qué se recuperó y qué no', () => {
    const plan = buildLessonPlan(first, []);
    const results: Record<string, { g: Grade; s: number }> = {};
    const [c1, c2] = first.newChunks;
    for (const s of plan) {
      if (s.kind !== 'exercise' || s.phase < 3) continue;
      if (s.ex.chunks?.includes(c1)) results[s.ex.id] = { g: 'unaided', s: 1 };
      else if (s.ex.chunks?.includes(c2)) results[s.ex.id] = { g: 'fail', s: 0 };
    }
    const sum = summarize(first, plan, { results });
    expect(sum.recalled).toContain(c1);
    expect(sum.missed).toContain(c2);
    expect(victoryId(first.id)).toBe(`${first.id}.victory`);
  });
});

describe('ejercicios generados', () => {
  it('el ejemplo de cada chunk se acepta en «significado» y en «completar»', () => {
    for (const c of chunkById.values()) {
      const m = meaningExercise(c, 't');
      expect(checkAnswer(c.example.en, m.accept, m.keys, m.anyOf).result, c.id).toBe('correct');
      const cl = clozeExercise(c, 't');
      expect(cl, c.id).not.toBeNull();
      expect(checkAnswer(c.example.en, cl!.accept).result, c.id).toBe('correct');
      expect(usesChunk(c.example.en, c), c.id).toBe(true);
    }
  });
});

describe('conversación ramificada', () => {
  it('elige la rama según palabras clave', () => {
    const conv = CONVERSATIONS.find((c) => c.id === 'meet-someone')!;
    const n2 = conv.nodes.find((n) => n.id === 'n2')!;
    expect(nextNode(n2, "I'm from Medellín").next).toBe('n3c');
    expect(nextNode(n2, "I'm from Peru").next).toBe('n3');
    expect(maxDepth(conv)).toBeGreaterThanOrEqual(5);
  });

  it('cubre al menos diez situaciones', () => {
    expect(CONVERSATIONS.length).toBeGreaterThanOrEqual(10);
  });
});

describe('diagnóstico, nivel y racha', () => {
  it('estima por bandas', () => {
    expect(estimateFromBands({ A1: 0.2, A2: 0, B1: 0, B2: 0 })).toBe('A0');
    expect(estimateFromBands({ A1: 0.9, A2: 0.3, B1: 0, B2: 0 })).toBe('A1+');
    expect(estimateFromBands({ A1: 1, A2: 0.9, B1: 0.8, B2: 0.2 })).toBe('B1');
  });

  it('cada estimación recomienda un módulo existente', () => {
    for (const v of Object.values(START_BY_ESTIMATE)) expect(MODULES.some((m) => m.id === v.module)).toBe(true);
  });

  it('el nivel solo sube al aprobar todos los módulos de una etapa', () => {
    let s = createInitialState(0);
    expect(estimateLevel(s).label).toBe('A1');
    const stageA = MODULES.filter((m) => m.stage === 'A');
    for (const m of stageA.slice(0, -1)) s = addAssessment(s, { t: 1, kind: 'module', ref: m.id, score: 0.9, bySkill: {}, passed: true });
    expect(estimateLevel(s).label).toBe('A1');
    s = addAssessment(s, { t: 1, kind: 'module', ref: stageA.at(-1)!.id, score: 0.9, bySkill: {}, passed: true });
    expect(estimateLevel(s).label).toContain('A2');
    expect(courseProgress(s)).toBeGreaterThan(0);
  });

  it('la racha tolera un día de descanso', () => {
    const now = new Date(2026, 5, 10, 12).getTime();
    const days: Record<string, { seconds: number; items: number; correct: number }> = {};
    for (const d of [1, 2, 4, 5]) days[dayKey(now - d * DAY)] = { seconds: 600, items: 10, correct: 8 };
    expect(flexibleStreak({ days }, now).streak).toBe(4);
    days[dayKey(now - 8 * DAY)] = { seconds: 600, items: 10, correct: 8 };
    expect(flexibleStreak({ days }, now).streak).toBe(4);
  });
});
