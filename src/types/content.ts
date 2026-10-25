/** Tipos del contenido educativo. El contenido vive en src/content y no depende de la UI. */

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2';
export type StageId = 'A' | 'B' | 'C' | 'D';

export type Skill =
  | 'listening'
  | 'reading'
  | 'speaking'
  | 'writing'
  | 'vocabulary'
  | 'grammar'
  | 'fluency';

export type ChunkCategory =
  | 'social'
  | 'personal'
  | 'routine'
  | 'needs'
  | 'likes'
  | 'ability'
  | 'places'
  | 'shopping'
  | 'clarify'
  | 'past'
  | 'plans'
  | 'experience'
  | 'opinion'
  | 'requests'
  | 'feelings'
  | 'connectors'
  | 'work'
  | 'tech'
  | 'meetings'
  | 'interview'
  | 'email'
  | 'hypothesis'
  | 'argument'
  | 'collocation'
  | 'phrasal'
  | 'travel'
  | 'health';

export interface Bilingual {
  en: string;
  es: string;
}

export interface CommonError {
  wrong: string;
  right: string;
  why: string;
}

/**
 * Una expresión que se aprende como unidad.
 * `core` es la parte fija que debe aparecer en una respuesta para contar como uso del chunk.
 * Se compara normalizado (sin mayúsculas, puntuación ni diferencias de contracciones).
 */
export interface Chunk {
  id: string;
  en: string;
  es: string;
  level: Cefr;
  cat: ChunkCategory;
  core: string;
  /** Otras formas válidas de la parte fija (por ejemplo, sin contracción o con sinónimo). */
  alt?: string[];
  example: Bilingual;
  /** Frases con componentes intercambiables (práctica de sustitución). */
  variants: string[];
  errors: CommonError[];
  /** Pregunta en inglés que obliga a recuperar la expresión. */
  ask: string;
  /** Tarea de producción libre (en español al inicio, en inglés en niveles altos). */
  task: string;
  /** Cuándo se usa y cuándo no; registro. */
  note?: string;
}

export type Instr = string | Bilingual;

/** Ejercicios. Todos los textos de respuesta aceptan la sintaxis de plantilla de engine/answer. */
export type Exercise =
  | TypeExercise
  | ChoiceExercise
  | OrderExercise
  | ListenExercise
  | OpenExercise
  | SpeakExercise;

interface ExerciseBase {
  id: string;
  skills: Skill[];
  /** Chunks que este ejercicio pone a prueba (para la repetición espaciada). */
  chunks?: string[];
}

/** Escribir (o decir) una respuesta concreta. Varias respuestas válidas. */
export interface TypeExercise extends ExerciseBase {
  kind: 'type';
  prompt: Instr;
  /** Texto de contexto opcional (por ejemplo, una frase con hueco «___»). */
  context?: string;
  accept: string[];
  /** Si todas estas piezas aparecen, la respuesta también se acepta (respuestas semiabiertas). */
  keys?: string[];
  /** Si aparece cualquiera de estas expresiones, la respuesta se acepta (uso de un chunk). */
  anyOf?: string[];
  hint?: string;
  explain?: string;
}

/** Reconocimiento. Se usa poco y nunca cuenta como dominio. */
export interface ChoiceExercise extends ExerciseBase {
  kind: 'choice';
  prompt: Instr;
  context?: string;
  options: string[];
  answer: number;
  explain?: string;
  /** Si es true, el contexto se escucha en lugar de leerse. */
  audio?: boolean;
}

/** Reconstrucción de una frase con palabras desordenadas. */
export interface OrderExercise extends ExerciseBase {
  kind: 'order';
  prompt: Instr;
  sentence: string;
  /** Otros órdenes válidos. */
  accept?: string[];
  /** Si es true, primero se escucha la frase (reconstrucción tras escuchar). */
  audio?: boolean;
}

/** Dictado: escuchar y escribir. Si no hay síntesis de voz, se muestra una alternativa. */
export interface ListenExercise extends ExerciseBase {
  kind: 'listen';
  prompt: Instr;
  text: string;
  accept?: string[];
  /** Ejercicio alternativo cuando no hay voz: se muestra la frase con huecos. */
  fallbackGap?: string;
}

/** Producción libre, por escrito o por voz. Se evalúa con criterios, no con una respuesta única. */
export interface OpenExercise extends ExerciseBase {
  kind: 'open';
  prompt: Instr;
  /** Pregunta en inglés que se lee/escucha. */
  question?: string;
  minWords: number;
  /** Debe aparecer al menos uno de estos chunks (por id). */
  targets?: string[];
  /** Ideas para desbloquearse (pistas). */
  ideas?: string[];
  /** Estructura incompleta para la segunda pista. */
  frame?: string;
  model: string;
  /** Criterios de autoevaluación que se muestran al final. */
  criteria?: string[];
}

/** Repetir en voz alta una frase modelo (shadowing). */
export interface SpeakExercise extends ExerciseBase {
  kind: 'speak';
  prompt: Instr;
  text: string;
  focus?: string;
}

export interface DialogueLine {
  who: string;
  en: string;
  es: string;
}

export interface ContextBlock {
  title: string;
  setting: string;
  lines: DialogueLine[];
  /** Preguntas de comprensión general (primero sin transcripción). */
  gist: Exercise[];
  /** Expresiones a resaltar después de la comprensión general. */
  highlights?: string[];
}

export interface GrammarNote {
  title: string;
  points: string[];
  examples: Bilingual[];
}

export interface Lesson {
  id: string;
  title: string;
  titleEn: string;
  /** Lo que podrás hacer al terminar («Puedo…»). */
  goal: string;
  minutes: number;
  /** Descriptores MCER trabajados (ids de content/descriptors). */
  descriptors: string[];
  context: ContextBlock;
  newChunks: string[];
  grammar?: GrammarNote;
  /** Ejercicios propios de la lección para la fase de recuperación activa (además de los generados). */
  practice?: Exercise[];
  production: OpenExercise[];
  /** Preguntas nuevas para la evaluación final de la lección. */
  assessment: Exercise[];
  /** Pequeña victoria comunicativa final, sin guion. */
  victory: { prompt: string; targets: string[]; model: string };
}

export interface Unit {
  id: string;
  title: string;
  lessons: Lesson[];
  /** Evaluación corta al terminar la unidad. */
  checkpoint: Exercise[];
}

export interface Module {
  id: string;
  stage: StageId;
  level: Cefr;
  title: string;
  titleEn: string;
  summary: string;
  canDo: string[];
  /** Módulos que deben aprobarse antes. */
  prereq: string[];
  units: Unit[];
  /** Evaluación acumulativa del módulo. */
  assessment: Exercise[];
  /** Chunks adicionales del módulo para ampliar en la biblioteca. */
  extraChunks?: string[];
}

export interface Stage {
  id: StageId;
  title: string;
  level: string;
  description: string;
}

export interface Descriptor {
  id: string;
  level: Cefr;
  skill: Skill;
  text: string;
}

/** Diálogos ramificados para el modo conversación. No es IA generativa. */
export interface ConversationNode {
  id: string;
  /** Lo que dice el interlocutor. */
  say: string;
  sayEs: string;
  /** Pistas progresivas si el estudiante se bloquea. */
  hint: string;
  frame: string;
  model: string;
  /** Ramas según palabras clave en la respuesta. La primera que coincida gana. */
  branches?: { match: string[]; next: string; react?: string }[];
  /** Siguiente nodo por defecto (si ninguna rama coincide). Sin next = fin. */
  next?: string;
  /** Mínimo de palabras esperado para esta respuesta. */
  minWords?: number;
  targets?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  level: Cefr;
  situation: string;
  partner: string;
  goal: string;
  start: string;
  nodes: ConversationNode[];
  /** Módulo a partir del cual se recomienda. */
  module: string;
}

export interface MinimalPairSet {
  id: string;
  title: string;
  sound: string;
  tip: string;
  pairs: [string, string][];
  sentences: string[];
}
