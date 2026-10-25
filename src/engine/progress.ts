/**
 * Operaciones puras sobre el estado de progreso. La UI las usa a través de ProgressContext;
 * las pruebas pueden llamarlas directamente.
 */
import type { Skill } from '../types/content';
import type {
  AssessmentRecord,
  DiagnosticRecord,
  Grade,
  LessonRecord,
  LessonSession,
  ProductionSample,
  ProgressState,
  Settings,
} from '../types/progress';
import type { DetectedError } from './errors';
import { applyGrade, newChunkProgress } from './srs';
import { dayKey } from '../utils/date';

const MAX_ATTEMPTS = 4000;
const MAX_SAMPLES = 300;

export interface AttemptInput {
  ref: string;
  skills: Skill[];
  score: number;
  grade: Grade;
  given?: string;
  /** Chunks afectados con su grado (puede diferir del grado global, p. ej. en producción libre). */
  chunks?: { id: string; grade: Grade }[];
  ctx?: string;
}

export function introduceChunks(state: ProgressState, ids: string[], now: number): ProgressState {
  const missing = ids.filter((id) => !state.chunks[id]);
  if (!missing.length) return state;
  const chunks = { ...state.chunks };
  for (const id of missing) chunks[id] = newChunkProgress(id, now);
  return { ...state, chunks };
}

export function recordAttempt(state: ProgressState, a: AttemptInput, now: number): ProgressState {
  const key = dayKey(now);
  const day = state.days[key] ?? { seconds: 0, items: 0, correct: 0 };
  let chunks = state.chunks;
  if (a.chunks?.length) {
    chunks = { ...chunks };
    for (const c of a.chunks) {
      const prev = chunks[c.id] ?? newChunkProgress(c.id, now);
      chunks[c.id] = applyGrade(prev, c.grade, now, a.ctx, c.grade === 'fail' ? a.given : undefined);
    }
  }
  const attempts = [...state.attempts, { t: now, ref: a.ref, skills: a.skills, score: a.score, grade: a.grade, given: a.given?.slice(0, 300) }];
  return {
    ...state,
    chunks,
    attempts: attempts.length > MAX_ATTEMPTS ? attempts.slice(-MAX_ATTEMPTS) : attempts,
    days: { ...state.days, [key]: { ...day, items: day.items + 1, correct: day.correct + (a.score >= 0.7 ? 1 : 0) } },
  };
}

export function addErrors(state: ProgressState, found: DetectedError[], now: number): ProgressState {
  if (!found.length) return state;
  const errors = { ...state.errors };
  for (const e of found) {
    const prev = errors[e.key];
    errors[e.key] = { key: e.key, count: (prev?.count ?? 0) + 1, lastAt: now, example: e.found };
  }
  return { ...state, errors };
}

export function addStudySeconds(state: ProgressState, seconds: number, now: number): ProgressState {
  if (seconds <= 0) return state;
  const key = dayKey(now);
  const day = state.days[key] ?? { seconds: 0, items: 0, correct: 0 };
  return { ...state, days: { ...state.days, [key]: { ...day, seconds: day.seconds + seconds } } };
}

export function completeLesson(
  state: ProgressState,
  lessonId: string,
  rec: Omit<LessonRecord, 'times' | 'completedAt'>,
  now: number,
): ProgressState {
  const prev = state.lessons[lessonId];
  return {
    ...state,
    session: null,
    lessons: { ...state.lessons, [lessonId]: { ...rec, completedAt: now, times: (prev?.times ?? 0) + 1, score: Math.max(rec.score, prev?.score ?? 0) } },
  };
}

export function addAssessment(state: ProgressState, rec: AssessmentRecord): ProgressState {
  return { ...state, assessments: [...state.assessments, rec] };
}

export function addDiagnostic(state: ProgressState, rec: DiagnosticRecord, placement: string[]): ProgressState {
  return {
    ...state,
    diagnostics: [...state.diagnostics, rec],
    placement: [...new Set([...state.placement, ...placement])],
    onboarded: true,
  };
}

export function addSample(state: ProgressState, sample: ProductionSample): ProgressState {
  const samples = [...state.samples, sample];
  return { ...state, samples: samples.length > MAX_SAMPLES ? samples.slice(-MAX_SAMPLES) : samples };
}

export function recordConversation(state: ProgressState, id: string, rec: { t: number; turns: number; independent: number }): ProgressState {
  return { ...state, conversations: { ...state.conversations, [id]: [...(state.conversations[id] ?? []), rec].slice(-20) } };
}

export function setSession(state: ProgressState, session: LessonSession | null): ProgressState {
  return { ...state, session };
}

export function updateSettings(state: ProgressState, patch: Partial<Settings>): ProgressState {
  return { ...state, settings: { ...state.settings, ...patch } };
}
