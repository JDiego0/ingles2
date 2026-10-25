/**
 * Funciones de autoría para escribir contenido de forma compacta.
 * Los ids de ejercicios se prefijan con el id de la lección/unidad/módulo al construirlos,
 * así que dentro de cada bloque basta con ids locales cortos (p1, a1…).
 */
import type {
  Chunk,
  ChoiceExercise,
  ContextBlock,
  Exercise,
  Instr,
  Lesson,
  ListenExercise,
  Module,
  OpenExercise,
  OrderExercise,
  Skill,
  SpeakExercise,
  TypeExercise,
  Unit,
} from '../types/content';

type ChunkInput = Omit<Chunk, 'example' | 'errors'> & {
  ex: [string, string];
  err: [string, string, string][];
};

export const chunk = ({ ex, err, ...rest }: ChunkInput): Chunk => ({
  ...rest,
  example: { en: ex[0], es: ex[1] },
  errors: err.map(([wrong, right, why]) => ({ wrong, right, why })),
});

interface Opts {
  skills?: Skill[];
  chunks?: string[];
}

export const type = (
  id: string,
  prompt: Instr,
  accept: string[],
  o: Opts & { context?: string; keys?: string[]; hint?: string; explain?: string } = {},
): TypeExercise => ({ kind: 'type', id, prompt, accept, skills: o.skills ?? ['writing', 'vocabulary'], ...o });

export const choice = (
  id: string,
  prompt: Instr,
  options: string[],
  answer: number,
  o: Opts & { context?: string; explain?: string; audio?: boolean } = {},
): ChoiceExercise => ({ kind: 'choice', id, prompt, options, answer, skills: o.skills ?? (o.audio ? ['listening'] : ['reading']), ...o });

export const order = (
  id: string,
  prompt: Instr,
  sentence: string,
  o: Opts & { accept?: string[]; audio?: boolean } = {},
): OrderExercise => ({ kind: 'order', id, prompt, sentence, skills: o.skills ?? (o.audio ? ['listening', 'grammar'] : ['grammar']), ...o });

export const listen = (
  id: string,
  prompt: Instr,
  text: string,
  o: Opts & { accept?: string[]; fallbackGap?: string } = {},
): ListenExercise => ({ kind: 'listen', id, prompt, text, skills: o.skills ?? ['listening'], ...o });

export const open = (
  id: string,
  prompt: Instr,
  o: Opts & Omit<OpenExercise, 'kind' | 'id' | 'prompt' | 'skills' | 'minWords' | 'chunks'> & { minWords?: number },
): OpenExercise => ({ kind: 'open', id, prompt, minWords: o.minWords ?? 8, skills: o.skills ?? ['writing', 'fluency'], ...o });

export const speak = (id: string, prompt: Instr, text: string, o: Opts & { focus?: string } = {}): SpeakExercise => ({
  kind: 'speak',
  id,
  prompt,
  text,
  skills: o.skills ?? ['speaking'],
  ...o,
});

const prefix = <T extends Exercise>(p: string, list: T[] | undefined): T[] =>
  (list ?? []).map((e) => ({ ...e, id: `${p}.${e.id}` }));

/** Diálogo compacto: cada línea es [quién, inglés, español]. */
export const dialogue = (
  title: string,
  setting: string,
  lines: [string, string, string][],
  gist: Exercise[],
  highlights?: string[],
): ContextBlock => ({ title, setting, lines: lines.map(([who, en, es]) => ({ who, en, es })), gist, highlights });

export const lesson = (l: Omit<Lesson, 'minutes'> & { minutes?: number }): Lesson => ({
  ...l,
  minutes: l.minutes ?? 30,
  context: { ...l.context, gist: prefix(l.id, l.context.gist) },
  practice: prefix(l.id, l.practice),
  production: prefix(l.id, l.production),
  assessment: prefix(l.id, l.assessment),
});

export const unit = (u: Unit): Unit => ({ ...u, checkpoint: prefix(u.id, u.checkpoint) });

export const module = (m: Module): Module => ({ ...m, assessment: prefix(m.id, m.assessment) });
