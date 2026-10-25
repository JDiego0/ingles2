/**
 * Métricas derivadas del progreso. Todo se calcula a partir de evidencias
 * (intentos, evaluaciones, producción), nunca de pantallas visitadas.
 */
import type { Skill } from '../types/content';
import type { ProgressState } from '../types/progress';
import { CHUNKS, LESSONS, MODULES, chunkById, lessonById } from '../content/course';
import { STAGES } from '../content/descriptors';
import { dueChunks, stateCounts } from './srs';
import { modulePassed, nextStep } from './unlock';
import { ruleLabel, ruleWhy } from './errors';
import { DAY } from './srs';
import { dayKey, lastDays, weekKey } from '../utils/date';

export const SKILL_LABEL: Record<Skill, string> = {
  listening: 'Comprensión auditiva',
  reading: 'Lectura',
  speaking: 'Expresión oral',
  writing: 'Escritura',
  vocabulary: 'Vocabulario y chunks',
  grammar: 'Gramática aplicada',
  fluency: 'Fluidez e interacción',
};

export const ALL_SKILLS: Skill[] = ['listening', 'reading', 'speaking', 'writing', 'vocabulary', 'grammar', 'fluency'];

export interface SkillStat {
  skill: Skill;
  /** Rendimiento reciente 0–1 (media ponderada de los últimos intentos). */
  score: number;
  /** Número de evidencias. */
  evidence: number;
}

/** Rendimiento por competencia con los últimos 40 intentos de cada una (los recientes pesan más). */
export function skillStats(state: Pick<ProgressState, 'attempts'>): SkillStat[] {
  return ALL_SKILLS.map((skill) => {
    const list = state.attempts.filter((a) => a.skills.includes(skill) && a.grade !== 'recognized').slice(-40);
    if (!list.length) return { skill, score: 0, evidence: 0 };
    let sum = 0;
    let wsum = 0;
    list.forEach((a, i) => {
      const w = 1 + i / list.length;
      sum += a.score * w;
      wsum += w;
    });
    return { skill, score: sum / wsum, evidence: list.length };
  });
}

/**
 * Progreso general del curso (0–1) basado en aprendizaje demostrado:
 * 40 % lecciones superadas (evaluación ≥ 60 %), 30 % chunks retenidos (en repaso o dominados),
 * 30 % evaluaciones de módulo aprobadas.
 */
export function courseProgress(state: ProgressState): number {
  const lessonsPassed = LESSONS.filter((l) => (state.lessons[l.lesson.id]?.score ?? 0) >= 0.6).length;
  const retained = Object.values(state.chunks).filter((c) => c.state === 'review' || c.state === 'mastered').length;
  const modulesPassed = MODULES.filter((m) => modulePassed(state, m.id)).length;
  const lp = LESSONS.length ? lessonsPassed / LESSONS.length : 0;
  const cp = CHUNKS.length ? retained / CHUNKS.length : 0;
  const mp = MODULES.length ? modulesPassed / MODULES.length : 0;
  return 0.4 * lp + 0.3 * cp + 0.3 * mp;
}

/** Racha flexible: un día de descanso entre días de estudio no la rompe. */
export function flexibleStreak(state: Pick<ProgressState, 'days'>, now = Date.now()): { streak: number; activeThisWeek: number } {
  const studied = (k: string) => {
    const d = state.days[k];
    return !!d && (d.seconds >= 300 || d.items >= 10);
  };
  let streak = 0;
  let gap = 0;
  for (let i = 0; i < 400; i++) {
    const k = dayKey(now - i * DAY);
    if (studied(k)) {
      streak++;
      gap = 0;
    } else if (i === 0) {
      continue; // hoy todavía puede estudiar
    } else {
      gap++;
      if (gap > 1) break;
    }
  }
  const activeThisWeek = lastDays(7, now).filter(studied).length;
  return { streak, activeThisWeek };
}

export function todaySeconds(state: Pick<ProgressState, 'days'>, now = Date.now()): number {
  return state.days[dayKey(now)]?.seconds ?? 0;
}

export function last7(state: Pick<ProgressState, 'days'>, now = Date.now()) {
  return lastDays(7, now).map((k) => ({ key: k, seconds: state.days[k]?.seconds ?? 0, items: state.days[k]?.items ?? 0 }));
}

export interface WeekRow {
  week: string;
  minutes: number;
  bySkill: Partial<Record<Skill, number>>;
}

/** Minutos y rendimiento por competencia de las últimas `n` semanas. */
export function weekly(state: ProgressState, n = 8, now = Date.now()): WeekRow[] {
  const weeks = Array.from({ length: n }, (_, i) => weekKey(now - (n - 1 - i) * 7 * DAY));
  const rows = new Map(weeks.map((w) => [w, { week: w, minutes: 0, sums: {} as Record<string, [number, number]> }]));
  for (const [k, d] of Object.entries(state.days)) {
    const [y, m, day] = k.split('-').map(Number);
    const row = rows.get(weekKey(new Date(y, m - 1, day).getTime()));
    if (row) row.minutes += d.seconds / 60;
  }
  for (const a of state.attempts) {
    const row = rows.get(weekKey(a.t));
    if (!row || a.grade === 'recognized') continue;
    for (const s of a.skills) {
      const cur = row.sums[s] ?? [0, 0];
      row.sums[s] = [cur[0] + a.score, cur[1] + 1];
    }
  }
  return [...rows.values()].map((r) => ({
    week: r.week,
    minutes: Math.round(r.minutes),
    bySkill: Object.fromEntries(Object.entries(r.sums).map(([s, [sum, cnt]]) => [s, sum / cnt])) as Partial<Record<Skill, number>>,
  }));
}

export interface LevelEstimate {
  label: string;
  detail: string;
}

/**
 * Estimación orientativa del nivel. Parte del diagnóstico y solo sube cuando
 * se aprueban TODAS las evaluaciones de módulo de una etapa.
 */
export function estimateLevel(state: ProgressState): LevelEstimate {
  const diag = state.diagnostics[state.diagnostics.length - 1];
  let label: string = diag?.estimate ?? 'A1';
  let detail = diag ? 'Según tu diagnóstico inicial.' : 'Sin diagnóstico todavía: punto de partida supuesto.';
  const order = ['A1', 'A2', 'B1', 'B2'];
  for (const stage of STAGES) {
    const mods = MODULES.filter((m) => m.stage === stage.id);
    if (mods.length && mods.every((m) => modulePassed(state, m.id))) {
      const next = order[order.indexOf(stage.level) + 1];
      label = next ? `${stage.level} → ${next}` : `${stage.level}`;
      detail = `Aprobaste todas las evaluaciones de la etapa ${stage.level} (${stage.title}).`;
    }
  }
  return { label, detail };
}

export interface Recommendation {
  title: string;
  text: string;
  action: { label: string; href: string };
}

/** Recomendación personalizada según repasos pendientes, errores frecuentes y competencias débiles. */
export function recommend(state: ProgressState, now = Date.now()): Recommendation {
  const due = dueChunks(state.chunks, now).length;
  const recentErrors = Object.values(state.errors)
    .filter((e) => now - e.lastAt < 14 * DAY)
    .sort((a, b) => b.count - a.count);
  if (due >= 8) {
    return {
      title: `${due} expresiones esperan repaso`,
      text: 'Recuperarlas hoy cuesta menos que volver a aprenderlas. Un repaso corto de 5 minutos primero.',
      action: { label: 'Repasar ahora', href: '#/repaso' },
    };
  }
  if (recentErrors[0] && recentErrors[0].count >= 2) {
    const e = recentErrors[0];
    return {
      title: `Error frecuente: ${ruleLabel(e.key)}`,
      text: `${ruleWhy(e.key)} Lo has cometido ${e.count} veces (por ejemplo: «${e.example}»). Practica en una conversación prestando atención a esto.`,
      action: { label: 'Practicar conversación', href: '#/conversar' },
    };
  }
  const skills = skillStats(state).filter((s) => s.evidence >= 5).sort((a, b) => a.score - b.score);
  if (skills[0] && skills[0].score < 0.55) {
    const s = skills[0];
    const href = s.skill === 'listening' || s.skill === 'speaking' ? '#/pronunciacion' : s.skill === 'fluency' ? '#/conversar' : '#/repaso';
    return {
      title: `Refuerza: ${SKILL_LABEL[s.skill].toLowerCase()}`,
      text: `Es tu competencia con menor rendimiento reciente (${Math.round(s.score * 100)} %).`,
      action: { label: 'Practicar', href },
    };
  }
  if (due > 0) {
    return {
      title: `${due} repasos pendientes`,
      text: 'Haz el repaso al empezar o al terminar tu lección de hoy.',
      action: { label: 'Repasar', href: '#/repaso' },
    };
  }
  const n = nextStep(state);
  return {
    title: 'Vas al día',
    text: 'No tienes repasos pendientes. Sigue con tu ruta.',
    action: { label: 'Continuar', href: n.kind === 'lesson' ? `#/leccion/${n.id}` : '#/ruta' },
  };
}

export function chunkCounts(state: ProgressState) {
  const c = stateCounts(state.chunks);
  return { ...c, total: CHUNKS.length, due: dueChunks(state.chunks, Date.now()).length };
}

export interface Achievement {
  id: string;
  title: string;
  text: string;
  earned: boolean;
}

/** Logros basados en competencias reales (no en iniciar sesión). */
export function achievements(state: ProgressState): Achievement[] {
  const produced = Object.values(state.chunks).filter((c) => c.counts.unaided + c.counts.spontaneous > 0).length;
  const spontaneous = Object.values(state.chunks).filter((c) => c.counts.spontaneous > 0).length;
  const mastered = Object.values(state.chunks).filter((c) => c.state === 'mastered').length;
  const convs = Object.values(state.conversations).flat();
  const independentConv = convs.some((c) => c.turns >= 4 && c.independent >= c.turns - 1);
  const longText = state.samples.some((s) => s.words >= 40);
  const voice = state.samples.some((s) => s.mode === 'voice');
  const victory = Object.keys(state.lessons).length > 0;
  const modulesPassed = MODULES.filter((m) => modulePassed(state, m.id)).length;
  return [
    { id: 'first-victory', title: 'Primera victoria', text: 'Expresaste algo útil en inglés sin guion al final de una lección.', earned: victory },
    { id: 'produce-10', title: '10 expresiones propias', text: 'Produjiste 10 expresiones distintas sin ayuda.', earned: produced >= 10 },
    { id: 'spontaneous-25', title: 'Uso espontáneo', text: 'Usaste 25 expresiones por iniciativa propia en producción libre o conversación.', earned: spontaneous >= 25 },
    { id: 'first-mastered', title: 'Primera expresión dominada', text: 'Una expresión superó la prueba del tiempo y del uso en contextos distintos.', earned: mastered >= 1 },
    { id: 'conversation', title: 'Conversación independiente', text: 'Completaste una conversación casi sin pistas.', earned: independentConv },
    { id: 'voice', title: 'Primera respuesta hablada', text: 'Respondiste una producción libre con tu voz.', earned: voice },
    { id: 'long-text', title: 'Párrafo propio', text: 'Escribiste un texto de 40 palabras o más.', earned: longText },
    { id: 'module', title: 'Módulo aprobado', text: 'Aprobaste una evaluación acumulativa de módulo.', earned: modulesPassed >= 1 },
  ];
}

export interface BeforeAfter {
  canDo: string;
  before: string;
  now: string;
  evidence?: string;
}

/** «Antes podía / Ahora puedo» con evidencias concretas tomadas de tus producciones. */
export function beforeAfter(state: ProgressState): BeforeAfter[] {
  const out: BeforeAfter[] = [];
  const diag = state.diagnostics[0];
  for (const m of MODULES) {
    if (!modulePassed(state, m.id)) continue;
    const sample = [...state.samples].reverse().find((s) => s.ref.startsWith(m.id + '.') || s.ref.startsWith(m.id + '-'));
    out.push({
      canDo: m.canDo[0],
      before: diag ? `En el diagnóstico tu estimación era ${diag.estimate}.` : 'Antes de este módulo no lo practicabas.',
      now: m.canDo.join(' '),
      evidence: sample?.text,
    });
  }
  return out;
}

export function lessonTitle(id: string): string {
  return lessonById.get(id)?.lesson.title ?? id;
}

export function chunkLabel(id: string): string {
  return chunkById.get(id)?.en ?? id;
}
