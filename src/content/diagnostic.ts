/**
 * Prueba diagnóstica breve (5–10 minutos). Es una estimación orientativa, no una certificación.
 */
import type { Exercise } from '../types/content';
import { choice, listen, open, order, type } from './helpers';

export type DiagArea = 'vocabulary' | 'reading' | 'grammar' | 'listening' | 'production';

export interface DiagItem {
  ex: Exercise;
  area: DiagArea;
  band: 'A1' | 'A2' | 'B1' | 'B2';
}

export const AREA_LABEL: Record<DiagArea, string> = {
  vocabulary: 'Vocabulario frecuente',
  reading: 'Comprensión de frases y textos',
  grammar: 'Construcción de oraciones y gramática',
  listening: 'Comprensión auditiva',
  production: 'Producción sin opciones',
};

const d = (ex: Exercise, area: DiagArea, band: DiagItem['band']): DiagItem => ({ ex: { ...ex, id: `diag.${ex.id}` }, area, band });

export const DIAGNOSTIC: DiagItem[] = [
  d(type('v1', '¿Cómo se dice «trabajo» (empleo) en inglés? Una palabra.', ['job', 'work', 'a job'], { skills: ['vocabulary'] }), 'vocabulary', 'A1'),
  d(type('v2', 'Escribe en inglés: «Necesito ayuda.»', ['I need help(.)', 'I need some help(.)'], { skills: ['vocabulary', 'writing'] }), 'vocabulary', 'A1'),
  d(choice('r1', 'Lee: «Hi, I\'m Ana. I\'m a nurse. I work at night and I sleep in the morning.» ¿Cuándo duerme Ana?', ['Por la mañana', 'Por la noche', 'Por la tarde'], 0), 'reading', 'A1'),
  d(type('g1', 'Completa con el verbo «work»: «She ___ in a bank.»', ['works', 'She works in a bank(.)'], { context: 'She ___ in a bank.', skills: ['grammar'] }), 'grammar', 'A1'),
  d(order('g2', 'Ordena la pregunta.', 'Where do you live?'), 'grammar', 'A1'),
  d(listen('l1', 'Escucha y escribe la frase.', 'I usually get up at seven.', { accept: ['I usually get up at {seven|7}(.)'], fallbackGap: 'I usually ___ up at seven.' }), 'listening', 'A1'),
  d(open('p1', 'Preséntate en inglés con 2 o 3 frases: nombre, de dónde eres y a qué te dedicas. Sin traductor: lo que sepas.', {
    question: 'Tell me about yourself.',
    minWords: 10,
    model: "Hi, I'm Diego. I'm from Colombia. I work as a developer.",
    skills: ['writing', 'fluency'],
  }), 'production', 'A1'),
  d(type('g3', 'Completa en pasado con «go»: «Yesterday I ___ to the doctor.»', ['went', 'Yesterday I went to the doctor(.)'], { context: 'Yesterday I ___ to the doctor.', skills: ['grammar'] }), 'grammar', 'A2'),
  d(choice('l2', 'Escucha. ¿Qué pide la persona?', ['Que le envíes un archivo antes del almuerzo', 'Que almuercen juntos', 'Que llames a un cliente'], 0, { audio: true, context: 'Can you send me the file before lunch?' }), 'listening', 'A2'),
  d(choice('r2', 'Lee: «Last week our server stopped working. We didn\'t lose any data, but the team worked all weekend to fix it.» ¿Qué es verdad?', ['El equipo trabajó el fin de semana', 'Perdieron datos', 'El servidor funciona mal todavía'], 0), 'reading', 'A2'),
  d(open('p2', 'Responde sin opciones: What did you do last weekend?', {
    question: 'What did you do last weekend?',
    minWords: 8,
    model: 'Last weekend I visited my family and I watched a movie.',
    skills: ['writing', 'grammar'],
  }), 'production', 'A2'),
  d(type('v3', 'Completa con una palabra: «It depends ___ the project.»', ['on', 'It depends on the project(.)'], { context: 'It depends ___ the project.', skills: ['vocabulary', 'grammar'] }), 'vocabulary', 'B1'),
  d(choice('g4', 'Elige: «If I ___ more time, I would learn Japanese.»', ['had', 'have', 'will have'], 0, { skills: ['grammar'] }), 'grammar', 'B1'),
  d(open('p3', 'Responde con 2 o 3 frases: Why do you want to improve your English?', {
    question: 'Why do you want to improve your English?',
    minWords: 15,
    model: 'I want to improve my English because I want to work for an international company. Also, most documentation is in English.',
    skills: ['writing', 'fluency'],
  }), 'production', 'B1'),
  d(choice('r3', 'Lee: «Although the new release fixed most bugs, users still complained about performance, which suggests the team should have prioritized optimization.» ¿Qué se sugiere?', ['Debieron priorizar el rendimiento', 'La versión no corrigió errores', 'Los usuarios estaban satisfechos'], 0), 'reading', 'B2'),
];

/** Recomendación de inicio según la estimación. */
export const START_BY_ESTIMATE: Record<string, { module: string; text: string }> = {
  A0: { module: 'a1', text: 'Empieza desde el principio: construiremos una base sólida y rápida.' },
  A1: { module: 'a1', text: 'Empieza por el módulo 1: lo recorrerás rápido y consolidarás lo que ya sabes.' },
  'A1+': { module: 'a2', text: 'Puedes empezar en el módulo 2. El módulo 1 queda abierto por si quieres repasarlo.' },
  A2: { module: 'a3', text: 'Puedes empezar en el módulo 3. Los anteriores quedan abiertos para repasar.' },
  'A2+': { module: 'a5', text: 'Tienes buena base. Empieza al final de la etapa A para asegurar la producción oral.' },
  B1: { module: 'a5', text: 'Tienes buena base. Empieza al final de la etapa A y avanza rápido hacia A2 y B1.' },
  B2: { module: 'a5', text: 'Tienes buena base. Empieza al final de la etapa A y avanza rápido.' },
};
