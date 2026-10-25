/**
 * Contexto de React con el estado de progreso y las acciones que lo modifican.
 * Guarda automáticamente en localStorage (con retardo corto y al ocultar la app).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Exercise } from '../types/content';
import type { AssessmentRecord, DiagnosticRecord, Grade, LessonRecord, LessonSession, ProgressState, Settings } from '../types/progress';
import * as P from '../engine/progress';
import { detectErrors } from '../engine/errors';
import { usesChunk } from '../engine/generate';
import { wordCount } from '../engine/answer';
import { chunkById } from '../content/course';
import { createInitialState, loadState, saveState, STORAGE_KEY } from '../storage/store';
import type { ExerciseResult } from '../components/exercises/types';

export interface Actions {
  /** Registra el resultado de un ejercicio: intento, chunks, errores y muestras de producción. */
  recordExercise(ex: Exercise, r: ExerciseResult, ctx: string): void;
  /** Registra el uso libre de chunks en un texto (conversación, victoria). Devuelve los chunks detectados. */
  recordFreeText(ref: string, text: string, opts: { targets?: string[]; helped: boolean; ctx: string; prompt: string; mode: 'text' | 'voice'; skills?: Exercise['skills'] }): string[];
  introduce(ids: string[]): void;
  setSession(s: LessonSession | null): void;
  completeLesson(id: string, rec: Omit<LessonRecord, 'times' | 'completedAt'>): void;
  addAssessment(rec: AssessmentRecord): void;
  addDiagnostic(rec: DiagnosticRecord, placement: string[]): void;
  recordConversation(id: string, rec: { t: number; turns: number; independent: number }): void;
  addStudySeconds(s: number): void;
  updateSettings(patch: Partial<Settings>): void;
  setName(name: string): void;
  setOnboarded(): void;
  replaceState(s: ProgressState): void;
  reset(): void;
}

interface Ctx {
  state: ProgressState;
  act: Actions;
  saveFailed: boolean;
}

const ProgressCtx = createContext<Ctx | null>(null);

/** Chunks (introducidos o objetivo) que aparecen en un texto libre. */
export function detectChunks(text: string, introduced: string[], targets: string[] = []): string[] {
  const ids = new Set([...targets, ...introduced]);
  return [...ids].filter((id) => {
    const c = chunkById.get(id);
    return !!c && usesChunk(text, c);
  });
}

export function ProgressProvider({ initial, children }: { initial: ProgressState; children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(initial);
  const [saveFailed, setSaveFailed] = useState(false);
  const latest = useRef(state);
  latest.current = state;
  /** Hay cambios de ESTA pestaña sin guardar. Evita que una pestaña antigua sobrescriba a otra. */
  const dirty = useRef(false);
  /** El último cambio vino de otra pestaña: no hace falta volver a guardarlo. */
  const fromOtherTab = useRef(false);
  const first = useRef(true);

  const flushNow = useCallback(() => {
    if (!dirty.current) return;
    const ok = saveState(latest.current);
    if (ok) dirty.current = false;
    setSaveFailed(!ok);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    dirty.current = true;
    const id = setTimeout(flushNow, 300);
    return () => clearTimeout(id);
  }, [state, flushNow]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    // Si otra pestaña guarda progreso, esta pestaña lo adopta (en lugar de pisarlo después).
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue || dirty.current) return;
      const r = loadState();
      if (r.ok && !r.fresh) {
        fromOtherTab.current = true;
        setState(r.state);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('storage', onStorage);
    };
  }, [flushNow]);

  const recordFreeText = useCallback<Actions['recordFreeText']>((ref, text, o) => {
    const now = Date.now();
    const found = detectChunks(text, Object.keys(latest.current.chunks), o.targets);
    const grade: Grade = o.helped ? 'hinted' : 'spontaneous';
    setState((s) => {
      let n = P.recordAttempt(
        s,
        {
          ref,
          skills: o.skills ?? (o.mode === 'voice' ? ['speaking', 'fluency'] : ['writing', 'fluency']),
          score: found.length ? 1 : 0.6,
          grade: found.length ? grade : 'hinted',
          given: text,
          chunks: found.map((id) => ({ id, grade })),
          ctx: o.ctx,
        },
        now,
      );
      n = P.addErrors(n, detectErrors(text), now);
      if (wordCount(text) >= 5) n = P.addSample(n, { t: now, ref, prompt: o.prompt, text, words: wordCount(text), mode: o.mode });
      return n;
    });
    return found;
  }, []);

  const act = useMemo<Actions>(
    () => ({
      recordExercise(ex, r, ctx) {
        const now = Date.now();
        setState((s) => {
          let chunks: { id: string; grade: Grade }[] = [];
          if (ex.kind === 'open') {
            const helped = r.hints > 0 || r.revealed;
            chunks = detectChunks(r.given, Object.keys(s.chunks), ex.targets).map((id) => ({ id, grade: helped ? 'hinted' : 'spontaneous' }));
          } else if (ex.chunks?.length) {
            chunks = ex.chunks.map((id) => ({ id, grade: r.grade }));
          }
          const skills = ex.kind === 'open' && r.mode === 'voice' ? [...new Set([...ex.skills.filter((k) => k !== 'writing'), 'speaking' as const])] : ex.skills;
          let n = P.recordAttempt(s, { ref: ex.id, skills, score: r.score, grade: r.grade, given: r.given, chunks, ctx }, now);
          if (ex.kind === 'open' || (ex.kind === 'type' && ex.anyOf)) n = P.addErrors(n, detectErrors(r.given), now);
          if (ex.kind === 'open' && wordCount(r.given) >= 5) {
            const prompt = typeof ex.prompt === 'string' ? ex.prompt : ex.prompt.es;
            n = P.addSample(n, { t: now, ref: ex.id, prompt: ex.question ?? prompt, text: r.given, words: wordCount(r.given), mode: r.mode === 'voice' ? 'voice' : 'text' });
          }
          return n;
        });
      },
      recordFreeText,
      introduce: (ids) => setState((s) => P.introduceChunks(s, ids, Date.now())),
      setSession: (session) => setState((s) => P.setSession(s, session)),
      completeLesson: (id, rec) => setState((s) => P.completeLesson(s, id, rec, Date.now())),
      addAssessment: (rec) => setState((s) => P.addAssessment(s, rec)),
      addDiagnostic: (rec, placement) => setState((s) => P.addDiagnostic(s, rec, placement)),
      recordConversation: (id, rec) => setState((s) => P.recordConversation(s, id, rec)),
      addStudySeconds: (sec) => setState((s) => P.addStudySeconds(s, sec, Date.now())),
      updateSettings: (patch) => setState((s) => P.updateSettings(s, patch)),
      setName: (name) => setState((s) => ({ ...s, name: name.slice(0, 40) })),
      setOnboarded: () => setState((s) => ({ ...s, onboarded: true })),
      replaceState: (next) => setState(next),
      reset: () => setState(createInitialState()),
    }),
    [recordFreeText],
  );

  const value = useMemo(() => ({ state, act, saveFailed }), [state, act, saveFailed]);
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress(): Ctx {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error('useProgress debe usarse dentro de ProgressProvider');
  return ctx;
}
