import type { Cefr, Skill } from './content';

/**
 * Grado de independencia demostrado en un intento.
 * recognized < hinted < unaided < spontaneous. Solo los dos últimos acercan al dominio.
 */
export type Grade = 'fail' | 'recognized' | 'hinted' | 'unaided' | 'spontaneous';

export type ChunkState = 'new' | 'learning' | 'review' | 'mastered';

export interface ChunkProgress {
  id: string;
  state: ChunkState;
  /** Índice en la escala de intervalos (0 = mismo día … 5 = 30 días). */
  step: number;
  /** Multiplicador ajustado según el rendimiento (0.7–1.6). */
  ease: number;
  introducedAt: number;
  lastReview: number | null;
  nextReview: number;
  counts: {
    recognized: number;
    hinted: number;
    unaided: number;
    spontaneous: number;
    fail: number;
  };
  /** Contextos distintos en los que se usó sin ayuda (lección, conversación, producción…). */
  contexts: string[];
  /** Últimos errores relevantes (respuesta dada). */
  errors: { t: number; given: string }[];
}

export interface Attempt {
  t: number;
  /** Ejercicio o referencia. */
  ref: string;
  skills: Skill[];
  /** 0–1. */
  score: number;
  grade: Grade;
  given?: string;
}

export interface DayLog {
  seconds: number;
  items: number;
  correct: number;
}

export interface LessonRecord {
  completedAt: number;
  /** Resultado de la evaluación final de la lección (0–1). */
  score: number;
  recalled: string[];
  hinted: string[];
  missed: string[];
  times: number;
}

export interface AssessmentRecord {
  t: number;
  kind: 'unit' | 'module' | 'cumulative';
  ref: string;
  score: number;
  /** Puntuaciones por competencia (0–1). */
  bySkill: Partial<Record<Skill, number>>;
  passed: boolean;
}

export interface DiagnosticRecord {
  t: number;
  estimate: Cefr | 'A0' | 'A1+' | 'A2+';
  bySkill: Partial<Record<Skill, number>>;
  strengths: string[];
  weaknesses: string[];
  startLesson: string;
  /** Respuesta abierta de presentación personal (evidencia «Antes podía»). */
  sample?: string;
}

export interface ProductionSample {
  t: number;
  ref: string;
  prompt: string;
  text: string;
  words: number;
  /** Etiqueta de capacidad («presentación personal», «narrar una experiencia»…). */
  canDo?: string;
  mode: 'text' | 'voice';
}

export interface ErrorRecord {
  key: string;
  count: number;
  lastAt: number;
  example: string;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  voiceURI: string | null;
  /** true cuando ya se pasó a la voz natural (una vez se reinicia la voz elegida antes). */
  naturalVoice?: boolean;
  rate: number;
  /** auto: el inglés de las instrucciones aumenta con el nivel. */
  instructions: 'auto' | 'es' | 'en';
  dailyGoalMin: number;
  autoplay: boolean;
  /** false: se responde hablando, eligiendo u ordenando bloques; el teclado queda como opción secundaria. */
  keyboard: boolean;
  /** Reconocimiento de voz: modelo en el teléfono o el servicio del navegador (Chrome/Google). */
  stt: 'local' | 'browser';
  /** Sonidos de acierto, error y micrófono. */
  sounds: boolean;
  /** Nombres y palabras que dices a menudo (tu ciudad, tu empresa…), separados por comas: el micrófono los reconoce mejor. */
  speechWords?: string;
}

export interface LessonSession {
  lessonId: string;
  phase: number;
  step: number;
  startedAt: number;
  /** Chunks elegidos para el calentamiento (para reconstruir el mismo plan al retomar). */
  warmup: string[];
  results: Record<string, { g: Grade; s: number }>;
}

export interface ProgressState {
  version: 1;
  createdAt: number;
  name: string;
  settings: Settings;
  onboarded: boolean;
  diagnostics: DiagnosticRecord[];
  lessons: Record<string, LessonRecord>;
  assessments: AssessmentRecord[];
  chunks: Record<string, ChunkProgress>;
  attempts: Attempt[];
  errors: Record<string, ErrorRecord>;
  days: Record<string, DayLog>;
  samples: ProductionSample[];
  conversations: Record<string, { t: number; turns: number; independent: number }[]>;
  /** Lección en curso para retomarla al reabrir. */
  session: LessonSession | null;
  /** Módulos desbloqueados por el diagnóstico. */
  placement: string[];
  achievements: Record<string, number>;
}
