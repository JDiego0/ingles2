/**
 * Almacenamiento local del progreso (localStorage).
 * Todo se guarda en una sola clave versionada. Antes de cargar o importar se valida la forma
 * de los datos; si están dañados, la app muestra una pantalla de recuperación.
 */
import type { ProgressState, Settings } from '../types/progress';

export const STORAGE_KEY = 'english-journey:v1';
export const BACKUP_APP_ID = 'english-journey';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  voiceURI: null,
  rate: 0.9,
  instructions: 'auto',
  dailyGoalMin: 30,
  autoplay: true,
};

export function createInitialState(now = Date.now()): ProgressState {
  return {
    version: 1,
    createdAt: now,
    name: '',
    settings: { ...DEFAULT_SETTINGS },
    onboarded: false,
    diagnostics: [],
    lessons: {},
    assessments: [],
    chunks: {},
    attempts: [],
    errors: {},
    days: {},
    samples: [],
    conversations: {},
    session: null,
    placement: [],
    achievements: {},
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valida la estructura. Devuelve una lista de problemas (vacía si es válido). */
export function validateState(data: unknown): string[] {
  const problems: string[] = [];
  if (!isObj(data)) return ['Los datos no son un objeto.'];
  if (data.version !== 1) problems.push('Versión de datos desconocida.');
  if (!isNum(data.createdAt)) problems.push('Falta la fecha de creación.');
  if (!isObj(data.settings)) problems.push('Faltan los ajustes.');
  for (const key of ['lessons', 'chunks', 'errors', 'days', 'conversations', 'achievements']) {
    if (!isObj(data[key])) problems.push(`El campo «${key}» no es válido.`);
  }
  for (const key of ['diagnostics', 'assessments', 'attempts', 'samples', 'placement']) {
    if (!Array.isArray(data[key])) problems.push(`El campo «${key}» no es una lista.`);
  }
  if (isObj(data.chunks)) {
    for (const [id, c] of Object.entries(data.chunks)) {
      if (!isObj(c) || !isNum(c.step) || !isNum(c.nextReview) || !isObj(c.counts)) {
        problems.push(`El progreso del chunk «${id}» está dañado.`);
        break;
      }
    }
  }
  if (isObj(data.days)) {
    for (const [k, d] of Object.entries(data.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isObj(d) || !isNum(d.seconds)) {
        problems.push('El historial de días está dañado.');
        break;
      }
    }
  }
  return problems;
}

/** Completa campos que falten (datos de versiones anteriores de la app) sin perder nada. */
export function migrate(data: ProgressState): ProgressState {
  const base = createInitialState(data.createdAt);
  const merged = { ...base, ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
  if (merged.session && !Array.isArray(merged.session.warmup)) merged.session = null;
  return merged;
}

export type LoadResult =
  | { ok: true; state: ProgressState; fresh: boolean }
  | { ok: false; raw: string; problems: string[] };

export function loadState(storage: Pick<Storage, 'getItem'> | null = safeStorage()): LoadResult {
  if (!storage) return { ok: true, state: createInitialState(), fresh: true };
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ok: true, state: createInitialState(), fresh: true };
  }
  if (!raw) return { ok: true, state: createInitialState(), fresh: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, raw, problems: ['El archivo de progreso no es JSON válido.'] };
  }
  const problems = validateState(parsed);
  if (problems.length) return { ok: false, raw, problems };
  return { ok: true, state: migrate(parsed as ProgressState), fresh: false };
}

export function saveState(state: ProgressState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__ej_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

export interface Backup {
  app: typeof BACKUP_APP_ID;
  exportedAt: string;
  state: ProgressState;
}

export function exportBackup(state: ProgressState, now = new Date()): string {
  const backup: Backup = { app: BACKUP_APP_ID, exportedAt: now.toISOString(), state: { ...state, session: null } };
  return JSON.stringify(backup, null, 1);
}

export type ImportResult = { ok: true; state: ProgressState; exportedAt: string } | { ok: false; error: string };

export function parseBackup(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' };
  }
  if (!isObj(data) || data.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Este archivo no es una copia de seguridad de English Journey.' };
  }
  const problems = validateState(data.state);
  if (problems.length) return { ok: false, error: 'La copia está incompleta o dañada: ' + problems.join(' ') };
  return { ok: true, state: migrate(data.state as ProgressState), exportedAt: String(data.exportedAt ?? '') };
}
