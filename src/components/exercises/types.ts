import type { Exercise } from '../../types/content';
import type { Grade } from '../../types/progress';
import type { InstrMode } from '../../engine/instructions';

export interface ExerciseResult {
  /** 0–1. */
  score: number;
  grade: Grade;
  given: string;
  hints: number;
  revealed: boolean;
  mode: 'text' | 'voice' | 'choice' | 'self';
}

export interface ExerciseProps<E extends Exercise = Exercise> {
  ex: E;
  mode: InstrMode;
  onDone: (r: ExerciseResult) => void;
  /** Texto del botón final («Continuar», «Siguiente»…). */
  doneLabel?: string;
}

/** Puntuación según la ayuda usada. */
export function scoreFor(hints: number, revealed: boolean, close = false): number {
  if (revealed) return 0;
  if (hints >= 2) return 0.4;
  if (hints === 1) return 0.6;
  return close ? 0.9 : 1;
}
