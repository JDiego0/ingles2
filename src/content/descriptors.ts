import type { Descriptor, Stage } from '../types/content';

export const STAGES: Stage[] = [
  { id: 'A', title: 'Fundamentos', level: 'A1', description: 'Presentarte, hablar de tu día, tus gustos, la ciudad y tu trabajo con frases cortas.' },
  { id: 'B', title: 'Desarrollo', level: 'A2', description: 'Contar lo que pasó, hablar de planes, comparar, opinar y resolver situaciones cotidianas.' },
  { id: 'C', title: 'Consolidación', level: 'B1', description: 'Narrar con detalle, dar consejos, manejar malentendidos y comunicarte en el trabajo.' },
  { id: 'D', title: 'Independencia', level: 'B2', description: 'Argumentar con matices, explicar problemas técnicos, participar en reuniones y entrevistas.' },
];

/**
 * Descriptores orientativos inspirados en el MCER (redactados en español, no son citas oficiales).
 * Sirven para mostrar qué capacidades se trabajan en cada lección.
 */
export const DESCRIPTORS: Descriptor[] = [
  // A1
  { id: 'A1-SPK-INTRO', level: 'A1', skill: 'speaking', text: 'Presentarte y responder preguntas sencillas sobre ti (nombre, origen, trabajo).' },
  { id: 'A1-INT-CLARIFY', level: 'A1', skill: 'fluency', text: 'Pedir que repitan o hablen más despacio cuando no entiendes.' },
  { id: 'A1-LIS-SLOW', level: 'A1', skill: 'listening', text: 'Entender frases muy básicas sobre ti y tu entorno si se dicen despacio.' },
  { id: 'A1-SPK-ROUTINE', level: 'A1', skill: 'speaking', text: 'Describir tu rutina diaria con frases simples.' },
  { id: 'A1-INT-QUESTIONS', level: 'A1', skill: 'fluency', text: 'Hacer y responder preguntas sencillas sobre temas cotidianos.' },
  { id: 'A1-WRI-PERSONAL', level: 'A1', skill: 'writing', text: 'Escribir frases sencillas sobre ti, tu familia y tus gustos.' },
  { id: 'A1-REA-SHORT', level: 'A1', skill: 'reading', text: 'Entender mensajes y textos muy cortos con vocabulario frecuente.' },
  { id: 'A1-INT-TRANSACTION', level: 'A1', skill: 'fluency', text: 'Pedir comida, preguntar precios y pedir direcciones con frases básicas.' },
  { id: 'A1-SPK-TECH', level: 'A1', skill: 'speaking', text: 'Decir qué herramientas usas y qué estás aprendiendo.' },
  { id: 'A1-INT-HELP', level: 'A1', skill: 'fluency', text: 'Explicar un problema sencillo y pedir ayuda.' },
  // A2
  { id: 'A2-SPK-PAST', level: 'A2', skill: 'speaking', text: 'Describir actividades pasadas y experiencias personales con frases conectadas.' },
  { id: 'A2-SPK-STORY', level: 'A2', skill: 'speaking', text: 'Contar una historia breve con conectores simples (first, then, after that).' },
  { id: 'A2-SPK-PLANS', level: 'A2', skill: 'speaking', text: 'Hablar de planes, intenciones y decisiones.' },
  { id: 'A2-INT-ARRANGE', level: 'A2', skill: 'fluency', text: 'Hacer invitaciones, aceptarlas o rechazarlas y acordar planes.' },
  { id: 'A2-SPK-COMPARE', level: 'A2', skill: 'speaking', text: 'Comparar cosas y expresar preferencias con razones simples.' },
  { id: 'A2-SPK-EXPERIENCE', level: 'A2', skill: 'speaking', text: 'Hablar de experiencias de vida (Have you ever…?).' },
  { id: 'A2-INT-SOCIAL', level: 'A2', skill: 'fluency', text: 'Agradecer, disculparte y hacer peticiones educadas.' },
  { id: 'A2-INT-PHONE', level: 'A2', skill: 'fluency', text: 'Manejar llamadas y mensajes cortos y previsibles.' },
  { id: 'A2-WRI-MESSAGE', level: 'A2', skill: 'writing', text: 'Escribir mensajes cortos y notas relacionadas con necesidades inmediatas.' },
  { id: 'A2-LIS-MAIN', level: 'A2', skill: 'listening', text: 'Captar la idea principal de mensajes y diálogos cortos y claros.' },
  { id: 'A2-SPK-WORK', level: 'A2', skill: 'speaking', text: 'Informar del progreso de tu trabajo y describir un problema sencillo.' },
  { id: 'A2-INT-TRAVEL', level: 'A2', skill: 'fluency', text: 'Resolver problemas frecuentes en viajes y explicar síntomas básicos.' },
  // B1
  { id: 'B1-SPK-NARRATE', level: 'B1', skill: 'speaking', text: 'Narrar una experiencia con detalle, describiendo sentimientos y reacciones.' },
  { id: 'B1-SPK-GOALS', level: 'B1', skill: 'speaking', text: 'Explicar objetivos, decisiones y sus razones.' },
  { id: 'B1-SPK-HYPOTHESIS', level: 'B1', skill: 'speaking', text: 'Hablar de condiciones reales e hipotéticas.' },
  { id: 'B1-INT-ADVICE', level: 'B1', skill: 'fluency', text: 'Dar y pedir consejos; expresar obligación y posibilidad.' },
  { id: 'B1-INT-OPINION', level: 'B1', skill: 'fluency', text: 'Expresar acuerdo y desacuerdo con educación y dar razones.' },
  { id: 'B1-INT-REPAIR', level: 'B1', skill: 'fluency', text: 'Comprobar la comprensión y resolver malentendidos.' },
  { id: 'B1-INT-SPONTANEOUS', level: 'B1', skill: 'fluency', text: 'Mantener una conversación sobre temas conocidos sin preparación.' },
  { id: 'B1-WRI-EMAIL', level: 'B1', skill: 'writing', text: 'Escribir correos claros para pedir información o explicar algo.' },
  { id: 'B1-SPK-INTERVIEW', level: 'B1', skill: 'speaking', text: 'Presentar tu experiencia profesional y responder preguntas de entrevista.' },
  { id: 'B1-INT-MEETING', level: 'B1', skill: 'fluency', text: 'Participar en reuniones: intervenir, pedir aclaraciones y resumir.' },
  { id: 'B1-REA-TECH', level: 'B1', skill: 'reading', text: 'Entender textos técnicos y descripciones de procesos (voz pasiva).' },
  { id: 'B1-LIS-REPORT', level: 'B1', skill: 'listening', text: 'Entender y transmitir lo que otra persona dijo.' },
  // B2
  { id: 'B2-SPK-ARGUE', level: 'B2', skill: 'speaking', text: 'Desarrollar un argumento con ventajas, desventajas y matices.' },
  { id: 'B2-SPK-PROBABILITY', level: 'B2', skill: 'speaking', text: 'Expresar grados de probabilidad, certeza y duda.' },
  { id: 'B2-SPK-REGRET', level: 'B2', skill: 'speaking', text: 'Especular sobre el pasado y expresar arrepentimiento (modales en pasado).' },
  { id: 'B2-SPK-TECH', level: 'B2', skill: 'speaking', text: 'Explicar problemas técnicos, sus causas y posibles soluciones.' },
  { id: 'B2-INT-MEETING', level: 'B2', skill: 'fluency', text: 'Intervenir con naturalidad en reuniones y retomar temas.' },
  { id: 'B2-SPK-PRESENT', level: 'B2', skill: 'speaking', text: 'Hacer presentaciones estructuradas de proyectos.' },
  { id: 'B2-VOC-NATURAL', level: 'B2', skill: 'vocabulary', text: 'Usar phrasal verbs y collocations frecuentes con naturalidad.' },
  { id: 'B2-INT-REGISTER', level: 'B2', skill: 'fluency', text: 'Adaptar el registro (formal / informal) a la situación.' },
  { id: 'B2-SPK-INTERVIEW', level: 'B2', skill: 'speaking', text: 'Responder entrevistas con ejemplos concretos y reflexión.' },
  { id: 'B2-REA-SUMMARY', level: 'B2', skill: 'reading', text: 'Resumir y transmitir las ideas principales de un texto o conversación.' },
];

export const descriptorById = new Map(DESCRIPTORS.map((d) => [d.id, d]));
