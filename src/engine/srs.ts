import type { ChunkProgress, ChunkState, Grade } from '../types/progress';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Calendario base en días: mismo día, 1, 3, 7, 14, 30, después 60 y 120. */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
const SAME_DAY_DELAY = 3 * HOUR;
const RETRY_DELAY = 10 * MINUTE;

export function newChunkProgress(id: string, now: number): ChunkProgress {
  return {
    id,
    state: 'learning',
    step: 0,
    ease: 1,
    introducedAt: now,
    lastReview: null,
    nextReview: now + SAME_DAY_DELAY,
    counts: { recognized: 0, hinted: 0, unaided: 0, spontaneous: 0, fail: 0 },
    contexts: [],
    errors: [],
  };
}

export function intervalMs(step: number, ease: number): number {
  if (step <= 0) return SAME_DAY_DELAY;
  const days = INTERVALS[Math.min(step, INTERVALS.length - 1)];
  return Math.round(days * (step >= 2 ? ease : 1) * DAY);
}

/** Un repaso solo hace avanzar el calendario si el elemento ya «tocaba» (evita inflar el progreso). */
export function isDue(p: ChunkProgress, now: number): boolean {
  return p.nextReview <= now + 30 * MINUTE;
}

/**
 * Aplica un intento a un chunk.
 * - Recordar sin ayuda o espontáneamente hace avanzar el intervalo.
 * - Con pista: se mantiene y se programa más cerca.
 * - Reconocer (opción múltiple) nunca supera el paso 1.
 * - Fallo: retrocede y se programa un nuevo intento en minutos.
 */
export function applyGrade(prev: ChunkProgress, grade: Grade, now: number, context?: string, given?: string): ChunkProgress {
  const p: ChunkProgress = {
    ...prev,
    counts: { ...prev.counts, [grade]: prev.counts[grade] + 1 },
    contexts: [...prev.contexts],
    errors: [...prev.errors],
  };
  const due = isDue(prev, now);

  if ((grade === 'unaided' || grade === 'spontaneous') && context && !p.contexts.includes(context)) {
    p.contexts = [...p.contexts, context].slice(-8);
  }

  switch (grade) {
    case 'spontaneous':
    case 'unaided': {
      if (due) {
        p.step = Math.min(prev.step + 1, INTERVALS.length - 1);
        p.ease = clampEase(prev.ease + (grade === 'spontaneous' ? 0.1 : 0.05));
        p.nextReview = now + intervalMs(p.step, p.ease);
        p.lastReview = now;
      }
      break;
    }
    case 'hinted': {
      p.ease = clampEase(prev.ease - 0.05);
      if (due) {
        p.lastReview = now;
        p.nextReview = now + Math.max(12 * HOUR, intervalMs(prev.step, p.ease) / 2);
      }
      break;
    }
    case 'recognized': {
      if (due) {
        p.step = Math.min(prev.step, 1);
        p.lastReview = now;
        p.nextReview = now + (p.step === 0 ? 12 * HOUR : DAY);
      }
      break;
    }
    case 'fail': {
      p.step = Math.max(0, prev.step - 2);
      p.ease = clampEase(prev.ease - 0.15);
      p.lastReview = now;
      p.nextReview = now + RETRY_DELAY;
      if (given) p.errors = [...p.errors, { t: now, given: given.slice(0, 120) }].slice(-5);
      break;
    }
  }
  p.state = deriveState(p);
  return p;
}

function clampEase(e: number): number {
  return Math.round(Math.min(1.6, Math.max(0.7, e)) * 100) / 100;
}

/**
 * Dominado provisionalmente solo con evidencia de producción:
 * intervalo ≥ 14 días, al menos 3 producciones sin ayuda, 1 espontánea y 2 contextos distintos.
 */
export function deriveState(p: ChunkProgress): ChunkState {
  const produced = p.counts.unaided + p.counts.spontaneous;
  if (p.step >= 4 && produced >= 3 && p.counts.spontaneous >= 1 && p.contexts.length >= 2) return 'mastered';
  if (p.step >= 2) return 'review';
  return 'learning';
}

/** Puntuación de dominio 0–100 ponderada hacia la producción espontánea. */
export function masteryScore(p: ChunkProgress | undefined): number {
  if (!p) return 0;
  const c = p.counts;
  const any = c.recognized + c.hinted + c.unaided + c.spontaneous;
  const recog = any > 0 ? 10 : 0;
  const hint = (Math.min(c.hinted + c.unaided + c.spontaneous, 2) / 2) * 15;
  const unaided = (Math.min(c.unaided + c.spontaneous, 3) / 3) * 30;
  const spont = (Math.min(c.spontaneous, 2) / 2) * 25 + (Math.min(p.contexts.length, 3) / 3) * 20;
  let total = recog + hint + unaided + spont;
  // Sin retención demostrada a lo largo de días, el dominio no puede ser alto.
  if (p.step < 2) total = Math.min(total, 55);
  else if (p.step < 4) total = Math.min(total, 85);
  return Math.round(total);
}

export type IndependenceLevel = 0 | 1 | 2 | 3 | 4;

/** 0 nada · 1 reconoce · 2 recuerda con pista · 3 produce sin ayuda · 4 usa en contexto nuevo. */
export function independence(p: ChunkProgress | undefined): IndependenceLevel {
  if (!p) return 0;
  if (p.counts.spontaneous > 0 && p.contexts.length >= 2) return 4;
  if (p.counts.unaided + p.counts.spontaneous > 0) return 3;
  if (p.counts.hinted > 0) return 2;
  if (p.counts.recognized > 0) return 1;
  return 0;
}

export const INDEPENDENCE_LABEL: Record<IndependenceLevel, string> = {
  0: 'Sin practicar',
  1: 'La reconoces',
  2: 'La recuerdas con pista',
  3: 'La produces sin ayuda',
  4: 'La usas en contextos nuevos',
};

/** Determina el grado de un intento a partir de cómo se respondió. */
export function gradeFrom(opts: {
  correct: boolean;
  hints: number;
  revealed: boolean;
  recognition?: boolean;
  spontaneous?: boolean;
}): Grade {
  if (opts.revealed || !opts.correct) return 'fail';
  if (opts.recognition) return 'recognized';
  if (opts.hints > 0) return 'hinted';
  return opts.spontaneous ? 'spontaneous' : 'unaided';
}

export function dueChunks(chunks: Record<string, ChunkProgress>, now: number): ChunkProgress[] {
  return Object.values(chunks)
    .filter((p) => p.nextReview <= now)
    .sort((a, b) => a.step - b.step || a.nextReview - b.nextReview);
}

export function stateCounts(chunks: Record<string, ChunkProgress>) {
  const out = { learning: 0, review: 0, mastered: 0 };
  for (const p of Object.values(chunks)) {
    if (p.state === 'learning') out.learning++;
    else if (p.state === 'review') out.review++;
    else if (p.state === 'mastered') out.mastered++;
  }
  return out;
}
