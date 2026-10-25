import { describe, expect, it } from 'vitest';
import { applyGrade, DAY, HOUR, gradeFrom, independence, masteryScore, newChunkProgress } from '../src/engine/srs';
import type { ChunkProgress, Grade } from '../src/types/progress';

const T0 = new Date(2026, 0, 1, 9).getTime();

/** Simula repasos realizados justo cuando tocan. */
function reviewSequence(grades: Grade[], ctxs: string[] = []): ChunkProgress {
  let p = newChunkProgress('x', T0);
  grades.forEach((g, i) => {
    p = applyGrade(p, g, p.nextReview, ctxs[i] ?? 'review');
  });
  return p;
}

describe('repetición espaciada', () => {
  it('el primer repaso es el mismo día', () => {
    const p = newChunkProgress('x', T0);
    expect(p.nextReview - T0).toBeLessThan(DAY);
    expect(p.nextReview).toBeGreaterThan(T0);
  });

  it('sigue el calendario 1, 3, 7, 14 días al recordar sin ayuda', () => {
    let p = newChunkProgress('x', T0);
    const expected = [1, 3, 7, 14, 30];
    for (const days of expected) {
      const at = p.nextReview;
      p = applyGrade(p, 'unaided', at, 'review');
      const interval = (p.nextReview - at) / DAY;
      expect(interval).toBeGreaterThanOrEqual(days * 0.95);
      expect(interval).toBeLessThanOrEqual(days * 1.6);
    }
  });

  it('un repaso anticipado no hace avanzar el intervalo', () => {
    const p0 = newChunkProgress('x', T0);
    const p1 = applyGrade(p0, 'unaided', T0 + 5 * 60_000, 'recall');
    expect(p1.step).toBe(0);
    expect(p1.counts.unaided).toBe(1);
  });

  it('un fallo retrocede y programa un intento cercano', () => {
    const p = reviewSequence(['unaided', 'unaided', 'unaided']);
    const at = p.nextReview;
    const failed = applyGrade(p, 'fail', at, 'review', 'wrong answer');
    expect(failed.step).toBe(p.step - 2);
    expect(failed.nextReview - at).toBeLessThan(HOUR);
    expect(failed.errors.at(-1)?.given).toBe('wrong answer');
  });

  it('la opción múltiple nunca supera el paso 1', () => {
    const p = reviewSequence(['recognized', 'recognized', 'recognized', 'recognized', 'recognized']);
    expect(p.step).toBeLessThanOrEqual(1);
    expect(p.state).toBe('learning');
  });

  it('solo se domina con producción espontánea en contextos distintos', () => {
    const onlyUnaided = reviewSequence(['unaided', 'unaided', 'unaided', 'unaided', 'unaided']);
    expect(onlyUnaided.state).not.toBe('mastered');
    const mixed = reviewSequence(['unaided', 'spontaneous', 'unaided', 'spontaneous', 'unaided'], ['recall', 'production', 'review', 'conversation', 'review']);
    expect(mixed.state).toBe('mastered');
  });

  it('el dominio queda limitado sin retención en el tiempo', () => {
    let p = newChunkProgress('x', T0);
    for (let i = 0; i < 6; i++) p = applyGrade(p, 'spontaneous', T0 + i * 1000, `c${i}`);
    expect(p.step).toBe(0);
    expect(masteryScore(p)).toBeLessThanOrEqual(55);
    expect(independence(p)).toBe(4);
  });

  it('calcula el grado del intento', () => {
    expect(gradeFrom({ correct: true, hints: 0, revealed: false })).toBe('unaided');
    expect(gradeFrom({ correct: true, hints: 1, revealed: false })).toBe('hinted');
    expect(gradeFrom({ correct: true, hints: 0, revealed: true })).toBe('fail');
    expect(gradeFrom({ correct: true, hints: 0, revealed: false, recognition: true })).toBe('recognized');
    expect(gradeFrom({ correct: true, hints: 0, revealed: false, spontaneous: true })).toBe('spontaneous');
  });
});
