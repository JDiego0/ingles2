import type { DiagnosticRecord } from '../types/progress';

export type Estimate = DiagnosticRecord['estimate'];

/** Estimación por bandas: hay que superar la banda inferior para subir. Es orientativa. */
export function estimateFromBands(b: Record<'A1' | 'A2' | 'B1' | 'B2', number>): Estimate {
  if (b.A1 < 0.4) return 'A0';
  if (b.A1 < 0.75) return 'A1';
  if (b.A2 < 0.5) return 'A1+';
  if (b.A2 < 0.75) return 'A2';
  if (b.B1 < 0.5) return 'A2+';
  if (b.B2 < 0.6) return 'B1';
  return 'B2';
}
