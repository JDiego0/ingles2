/**
 * Transición progresiva del español al inglés en las instrucciones.
 * En modo automático: etapa A en español, etapa B bilingüe, etapas C y D en inglés
 * (con la opción de ver la traducción).
 */
import type { Instr, StageId } from '../types/content';
import type { Settings } from '../types/progress';

export type InstrMode = 'es' | 'bi' | 'en';

export function instrMode(settings: Pick<Settings, 'instructions'>, stage: StageId | undefined): InstrMode {
  if (settings.instructions === 'es') return 'es';
  if (settings.instructions === 'en') return 'en';
  if (!stage || stage === 'A') return 'es';
  if (stage === 'B') return 'bi';
  return 'en';
}

export interface InstrText {
  main: string;
  secondary?: string;
  lang: 'es' | 'en';
}

export function instrText(instr: Instr, mode: InstrMode): InstrText {
  if (typeof instr === 'string') return { main: instr, lang: 'es' };
  if (mode === 'es') return { main: instr.es, lang: 'es' };
  if (mode === 'bi') return { main: instr.en, secondary: instr.es, lang: 'en' };
  return { main: instr.en, secondary: instr.es, lang: 'en' };
}
