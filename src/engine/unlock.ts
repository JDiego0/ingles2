/**
 * Prerrequisitos y desbloqueo.
 * - Un módulo se abre cuando sus prerrequisitos tienen la evaluación de módulo aprobada
 *   (o el diagnóstico lo desbloqueó).
 * - Dentro de un módulo, las lecciones se abren en orden. Para pasar a la unidad siguiente
 *   hay que haber hecho la evaluación de la unidad (aprobarla no es obligatorio, pero sí intentarla).
 * - La evaluación del módulo se abre cuando todas las unidades tienen su evaluación hecha.
 */
import type { Module } from '../types/content';
import type { ProgressState } from '../types/progress';
import { MODULES, moduleById } from '../content/course';

export const PASS_MARK = 0.6;

type P = Pick<ProgressState, 'lessons' | 'assessments' | 'placement'>;

export function lessonDone(p: P, id: string): boolean {
  return !!p.lessons[id];
}

export function checkpointTaken(p: P, unitId: string): boolean {
  return p.assessments.some((a) => a.kind === 'unit' && a.ref === unitId);
}

export function bestScore(p: P, kind: 'unit' | 'module', ref: string): number | null {
  const list = p.assessments.filter((a) => a.kind === kind && a.ref === ref);
  return list.length ? Math.max(...list.map((a) => a.score)) : null;
}

export function modulePassed(p: P, moduleId: string): boolean {
  return p.assessments.some((a) => a.kind === 'module' && a.ref === moduleId && a.passed);
}

export function moduleUnlocked(p: P, m: Module): boolean {
  if (p.placement.includes(m.id)) return true;
  return m.prereq.every((id) => modulePassed(p, id) || (p.placement.includes(id) && moduleCompletedLessons(p, id)));
}

/** Para módulos desbloqueados por diagnóstico: se consideran superados si se terminaron sus lecciones. */
function moduleCompletedLessons(p: P, moduleId: string): boolean {
  const m = moduleById.get(moduleId);
  if (!m) return false;
  return m.units.every((u) => u.lessons.every((l) => lessonDone(p, l.id)));
}

export function lessonUnlocked(p: P, lessonId: string): boolean {
  for (const m of MODULES) {
    for (let ui = 0; ui < m.units.length; ui++) {
      const u = m.units[ui];
      const li = u.lessons.findIndex((l) => l.id === lessonId);
      if (li === -1) continue;
      if (!moduleUnlocked(p, m)) return false;
      if (li > 0) return lessonDone(p, u.lessons[li - 1].id);
      if (ui === 0) return true;
      const prev = m.units[ui - 1];
      return prev.lessons.every((l) => lessonDone(p, l.id)) && checkpointTaken(p, prev.id);
    }
  }
  return false;
}

export function checkpointUnlocked(p: P, unitId: string): boolean {
  for (const m of MODULES) {
    const u = m.units.find((x) => x.id === unitId);
    if (u) return moduleUnlocked(p, m) && u.lessons.every((l) => lessonDone(p, l.id));
  }
  return false;
}

export function moduleAssessmentUnlocked(p: P, moduleId: string): boolean {
  const m = moduleById.get(moduleId);
  if (!m || !moduleUnlocked(p, m)) return false;
  return m.units.every((u) => u.lessons.every((l) => lessonDone(p, l.id)) && checkpointTaken(p, u.id));
}

export type ModuleStatus = 'locked' | 'available' | 'current' | 'completed';

export function moduleStatus(p: P, m: Module): ModuleStatus {
  if (modulePassed(p, m.id)) return 'completed';
  if (!moduleUnlocked(p, m)) return 'locked';
  const started = m.units.some((u) => u.lessons.some((l) => lessonDone(p, l.id)));
  return started ? 'current' : 'available';
}

export type NextStep =
  | { kind: 'lesson'; id: string; moduleId: string }
  | { kind: 'unit'; id: string; moduleId: string }
  | { kind: 'module'; id: string; moduleId: string }
  | { kind: 'done' };

/** Siguiente paso recomendado en la ruta. */
export function nextStep(p: P): NextStep {
  for (const m of MODULES) {
    if (modulePassed(p, m.id)) continue;
    if (!moduleUnlocked(p, m)) continue;
    for (const u of m.units) {
      for (const l of u.lessons) {
        if (!lessonDone(p, l.id)) return { kind: 'lesson', id: l.id, moduleId: m.id };
      }
      if (!checkpointTaken(p, u.id)) return { kind: 'unit', id: u.id, moduleId: m.id };
    }
    return { kind: 'module', id: m.id, moduleId: m.id };
  }
  return { kind: 'done' };
}

/** Módulo actual: el del siguiente paso, o el último si se terminó todo. */
export function currentModule(p: P): Module {
  const n = nextStep(p);
  if (n.kind !== 'done') return moduleById.get(n.moduleId)!;
  return MODULES[MODULES.length - 1];
}
