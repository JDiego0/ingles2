import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/storage/store';
import { addAssessment, completeLesson } from '../src/engine/progress';
import {
  checkpointUnlocked,
  lessonUnlocked,
  moduleAssessmentUnlocked,
  moduleUnlocked,
  nextStep,
} from '../src/engine/unlock';
import { MODULES } from '../src/content/course';
import type { ProgressState } from '../src/types/progress';

const done = (s: ProgressState, id: string) => completeLesson(s, id, { score: 0.8, recalled: [], hinted: [], missed: [] }, 1);
const unitTaken = (s: ProgressState, id: string) => addAssessment(s, { t: 1, kind: 'unit', ref: id, score: 0.4, bySkill: {}, passed: false });

describe('desbloqueo de la ruta', () => {
  const first = MODULES[0];
  const [u1, u2] = first.units;

  it('al empezar solo está disponible la primera lección', () => {
    const s = createInitialState();
    expect(lessonUnlocked(s, u1.lessons[0].id)).toBe(true);
    expect(lessonUnlocked(s, u1.lessons[1].id)).toBe(false);
    expect(nextStep(s)).toMatchObject({ kind: 'lesson', id: u1.lessons[0].id });
  });

  it('las lecciones se abren en orden y la unidad siguiente exige la evaluación de unidad', () => {
    let s = createInitialState();
    for (const l of u1.lessons) s = done(s, l.id);
    expect(checkpointUnlocked(s, u1.id)).toBe(true);
    expect(lessonUnlocked(s, u2.lessons[0].id)).toBe(false);
    expect(nextStep(s)).toMatchObject({ kind: 'unit', id: u1.id });
    s = unitTaken(s, u1.id);
    expect(lessonUnlocked(s, u2.lessons[0].id)).toBe(true);
  });

  it('la evaluación de módulo se abre al terminar todas las unidades', () => {
    let s = createInitialState();
    for (const u of first.units) {
      for (const l of u.lessons) s = done(s, l.id);
      expect(moduleAssessmentUnlocked(s, first.id)).toBe(false);
      s = unitTaken(s, u.id);
    }
    expect(moduleAssessmentUnlocked(s, first.id)).toBe(true);
    expect(nextStep(s)).toMatchObject({ kind: 'module', id: first.id });
  });

  it('el módulo siguiente exige aprobar la evaluación del anterior', () => {
    const second = MODULES[1];
    if (!second) return;
    let s = createInitialState();
    expect(moduleUnlocked(s, second)).toBe(false);
    s = addAssessment(s, { t: 1, kind: 'module', ref: first.id, score: 0.5, bySkill: {}, passed: false });
    expect(moduleUnlocked(s, second)).toBe(false);
    s = addAssessment(s, { t: 2, kind: 'module', ref: first.id, score: 0.8, bySkill: {}, passed: true });
    expect(moduleUnlocked(s, second)).toBe(true);
  });

  it('el diagnóstico puede desbloquear un módulo posterior', () => {
    const second = MODULES[1];
    if (!second) return;
    const s = { ...createInitialState(), placement: [second.id] };
    expect(moduleUnlocked(s, second)).toBe(true);
    expect(lessonUnlocked(s, second.units[0].lessons[0].id)).toBe(true);
  });
});
