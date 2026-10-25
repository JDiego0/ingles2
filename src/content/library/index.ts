/**
 * Biblioteca ampliada: lotes de expresiones extra por módulo.
 * No se enseñan en las lecciones; se exploran en la Biblioteca y se pueden añadir a los repasos.
 */
import type { LibraryBatch } from './build';
import { STAGE_A_LIBRARY } from './stageA';
import { STAGE_B_LIBRARY } from './stageB';
import { STAGE_C_LIBRARY } from './stageC';
import { STAGE_D_LIBRARY } from './stageD';

export const LIBRARY: LibraryBatch[] = [...STAGE_A_LIBRARY, ...STAGE_B_LIBRARY, ...STAGE_C_LIBRARY, ...STAGE_D_LIBRARY];
