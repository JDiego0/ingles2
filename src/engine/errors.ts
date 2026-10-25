/**
 * Detector de errores frecuentes de hispanohablantes en textos libres.
 * Es heurístico: solo señala patrones muy comunes y nunca afirma que el resto sea correcto.
 */

export interface ErrorRule {
  key: string;
  label: string;
  pattern: RegExp;
  why: string;
  fix: (m: RegExpMatchArray) => string;
  /** Mayor peso = más importante para la comunicación. */
  weight: number;
}

const V3 = '(have|go|work|like|want|need|live|study|do|make|play|watch|think|know|use|speak|get|eat|write|read|come|say|take|love|prefer|start|finish|try|feel|look|wake|drink|drive|teach|leave|help)';
const NOT_AFTER = '(?<!\\b(does|did|can|could|will|would|should|must|might|may|to|doesn\'t|didn\'t|let|make|help|and)\\s)';
const IRREGULAR_PAST = '(went|saw|ate|had|came|got|made|took|bought|did|was|were|wrote|spoke|knew|thought|found|gave|left|met|told|said|felt|ran|drove|slept|began|chose|forgot|lost|paid|sent|spent|understood|woke)';

export const ERROR_RULES: ErrorRule[] = [
  {
    key: 'age-have',
    label: 'Edad con «have»',
    pattern: /\bi (have|has) (\d+|[a-z]+-?[a-z]*) years\b/i,
    why: 'En inglés la edad se dice con «be», no con «have».',
    fix: (m) => `I'm ${m[2]} (years old)`,
    weight: 3,
  },
  {
    key: 'agree-be',
    label: '«I am agree»',
    pattern: /\b(i am|i'm|we are|we're) (agree|disagree)\b/i,
    why: '«Agree» ya es un verbo: no lleva «am».',
    fix: (m) => `${m[1].startsWith('w') ? 'we' : 'I'} ${m[2]}`,
    weight: 3,
  },
  {
    key: 'depend-of',
    label: '«depend of»',
    pattern: /\b(depends?|depending) of\b/i,
    why: 'Se dice «depend on», no «depend of».',
    fix: (m) => `${m[1]} on`,
    weight: 2,
  },
  {
    key: 'explain-me',
    label: '«explain me»',
    pattern: /\bexplain (me|us|him|her|them)\b/i,
    why: '«Explain» necesita «to»: explain something to me / explain to me.',
    fix: (m) => `explain to ${m[1]}`,
    weight: 2,
  },
  {
    key: 'since-duration',
    label: '«since» + duración',
    pattern: /\bsince (\d+|two|three|four|five|six|ten|many|a few) (years|months|weeks|days|hours)\b/i,
    why: 'Con duraciones se usa «for»; «since» va con un punto de inicio (since 2020).',
    fix: (m) => `for ${m[1]} ${m[2]}`,
    weight: 2,
  },
  {
    key: 'missing-it',
    label: 'Falta el sujeto «it»',
    pattern: /(^|[.!?]\s+)(is|was) (very|so|really|too|important|necessary|possible|impossible|difficult|hard|easy|good|bad|raining|sunny|cold|hot|late|early|true|interesting|nice|great|better|my|a)\b/i,
    why: 'En inglés toda oración necesita sujeto. «Es importante» → «It is important».',
    fix: (m) => `It ${m[2].toLowerCase()} ${m[3]}`,
    weight: 3,
  },
  {
    key: 'people-is',
    label: '«people is»',
    pattern: /\b(people is|everybody are|everyone are)\b/i,
    why: '«People» es plural (people are); «everybody/everyone» es singular (everybody is).',
    fix: (m) => (m[1].toLowerCase().startsWith('people') ? 'people are' : m[1].replace(/are$/i, 'is')),
    weight: 2,
  },
  {
    key: 'third-person-s',
    label: 'Falta la -s de tercera persona',
    pattern: new RegExp(`${NOT_AFTER}\\b(he|she|it|my (?:mother|father|brother|sister|friend|boss|wife|husband|son|daughter|team|company))\\s+(?:always |usually |often |never |sometimes |also |really )?${V3}\\b`, 'i'),
    why: 'Con he/she/it (o una persona) el verbo en presente lleva -s: she works, he has.',
    fix: (m) => `${m[2]} ${thirdPerson(m[3])}`,
    weight: 2,
  },
  {
    key: 'he-dont',
    label: '«he don\'t»',
    pattern: /\b(he|she|it) (don't|do not)\b/i,
    why: 'Con he/she/it se usa «doesn\'t».',
    fix: (m) => `${m[1]} doesn't`,
    weight: 2,
  },
  {
    key: 'did-past',
    label: 'Pasado después de «did»',
    pattern: new RegExp(`\\b(did|didn't|did not)\\s+(you |he |she |they |we |i |it )?${IRREGULAR_PAST}\\b`, 'i'),
    why: 'Después de «did/didn\'t» el verbo va en forma base: Did you go? I didn\'t see.',
    fix: (m) => `${m[1]} ${m[2] ?? ''}${baseOf(m[3])}`.replace(/\s+/g, ' '),
    weight: 3,
  },
  {
    key: 'be-plus-verb',
    label: '«I am» + verbo',
    pattern: /\b(i am|i'm|you are|we are|they are) (live|work|study|like|want|need|have|know|think|go)\b/i,
    why: 'No mezcles «be» con otro verbo en presente simple: «I live», no «I am live».',
    fix: (m) => `${m[1].split(/\s|'/)[0]} ${m[2]}`,
    weight: 3,
  },
  {
    key: 'modal-to',
    label: 'Modal + «to»',
    pattern: /\b(can|must|should|could|might|will) to (\w+)/i,
    why: 'Después de can/must/should/could no va «to»: I can help.',
    fix: (m) => `${m[1]} ${m[2]}`,
    weight: 2,
  },
  {
    key: 'more-er',
    label: 'Comparativo doble o con «more»',
    pattern: /\bmore (better|worse|easier|bigger|faster|cheaper|easy|big|cheap|fast|small|good|bad|long|short|old|young|hard|nice|happy|busy|large)\b/i,
    why: 'Los adjetivos cortos forman el comparativo con -er (easier, bigger) y good → better.',
    fix: (m) => comparative(m[1]),
    weight: 2,
  },
  {
    key: 'what-means',
    label: '«What means…?»',
    pattern: /\bwhat means\b/i,
    why: 'La pregunta correcta es «What does … mean?».',
    fix: () => 'What does … mean?',
    weight: 2,
  },
  {
    key: 'how-called',
    label: '«How is it called?»',
    pattern: /\bhow (is|it's|is it) called\b/i,
    why: 'En inglés se pregunta «What is it called?».',
    fix: () => 'What is it called?',
    weight: 1,
  },
  {
    key: 'want-that',
    label: '«want that you…»',
    pattern: /\bwant that (you|he|she|they|we|him|her|them)\b/i,
    why: 'Se usa «want + persona + to»: I want you to help me.',
    fix: (m) => `want ${objectOf(m[1])} to …`,
    weight: 2,
  },
  {
    key: 'listen-music',
    label: '«listen music»',
    pattern: /\blisten(s|ing|ed)? (music|the radio|podcasts?|me|him|her|you)\b/i,
    why: '«Listen» necesita «to»: listen to music.',
    fix: (m) => `listen${m[1] ?? ''} to ${m[2]}`,
    weight: 1,
  },
  {
    key: 'make-question',
    label: '«make a question»',
    pattern: /\bmake (a|some|many|one) questions?\b/i,
    why: 'Las preguntas se «ask»: ask a question.',
    fix: (m) => `ask ${m[1]} question`,
    weight: 1,
  },
  {
    key: 'do-mistake',
    label: '«do a mistake»',
    pattern: /\b(do|did|doing) (a|many|some) mistakes?\b/i,
    why: 'Los errores se «make»: make a mistake.',
    fix: (m) => `${m[1].startsWith('did') ? 'made' : 'make'} ${m[2]} mistake`,
    weight: 1,
  },
  {
    key: 'say-me',
    label: '«say me»',
    pattern: /\bsay (me|him|her|us|them)\b/i,
    why: 'Con persona se usa «tell»: tell me.',
    fix: (m) => `tell ${m[1]}`,
    weight: 1,
  },
  {
    key: 'discuss-about',
    label: '«discuss about»',
    pattern: /\bdiscuss(ed|ing)? about\b/i,
    why: '«Discuss» no lleva «about»: discuss the plan.',
    fix: (m) => `discuss${m[1] ?? ''}`,
    weight: 1,
  },
  {
    key: 'arrive-to',
    label: '«arrive to»',
    pattern: /\barriv(e|ed|es|ing) to\b/i,
    why: 'Se dice «arrive at» (lugar concreto) o «arrive in» (ciudad/país).',
    fix: (m) => `arriv${m[1]} at/in`,
    weight: 1,
  },
  {
    key: 'married-with',
    label: '«married with»',
    pattern: /\bmarried with\b/i,
    why: 'Se dice «married to».',
    fix: () => 'married to',
    weight: 1,
  },
  {
    key: 'day-in',
    label: 'Preposición con días',
    pattern: /\bin (monday|tuesday|wednesday|thursday|friday|saturday|sunday|the weekend)s?\b/i,
    why: 'Con días se usa «on»: on Monday, on the weekend (EE. UU.).',
    fix: (m) => `on ${m[1]}`,
    weight: 1,
  },
  {
    key: 'uncountable-s',
    label: 'Incontable en plural',
    pattern: /\b(informations|advices|softwares|equipments|homeworks|furnitures|feedbacks|knowledges|researches)\b/i,
    why: 'Estas palabras son incontables en inglés: information, advice, software.',
    fix: (m) => m[1].replace(/s$/i, ''),
    weight: 1,
  },
  {
    key: 'it-depend',
    label: '«it depend»',
    pattern: /\bit('s| is)? depend\b/i,
    why: 'Se dice «it depends».',
    fix: () => 'it depends',
    weight: 1,
  },
  {
    key: 'no-negation',
    label: 'Negación con «no»',
    pattern: /\b(i|you|we|they) no (like|have|know|want|need|understand|speak|work|live|can)\b/i,
    why: 'El verbo se niega con «don\'t»: I don\'t like.',
    fix: (m) => `${m[1]} don't ${m[2]}`,
    weight: 3,
  },
  {
    key: 'the-general',
    label: '«the» con ideas generales',
    pattern: /(^|[.!?]\s+)the (life|people|society|nature|music|technology|love|money|education) (is|are)\b/i,
    why: 'Para hablar en general no se usa «the»: Life is hard. Technology is useful.',
    fix: (m) => `${m[2][0].toUpperCase()}${m[2].slice(1)} ${m[3]}`,
    weight: 1,
  },
];

function thirdPerson(v: string): string {
  const w = v.toLowerCase();
  if (w === 'have') return 'has';
  if (w === 'do') return 'does';
  if (w === 'go') return 'goes';
  if (/(s|sh|ch|x|o)$/.test(w)) return w + 'es';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
  return w + 's';
}

const PAST_BASE: Record<string, string> = {
  went: 'go', saw: 'see', ate: 'eat', had: 'have', came: 'come', got: 'get', made: 'make',
  took: 'take', bought: 'buy', did: 'do', was: 'be', were: 'be', wrote: 'write', spoke: 'speak',
  knew: 'know', thought: 'think', found: 'find', gave: 'give', left: 'leave', met: 'meet',
  told: 'tell', said: 'say', felt: 'feel', ran: 'run', drove: 'drive', slept: 'sleep', began: 'begin',
  chose: 'choose', forgot: 'forget', lost: 'lose', paid: 'pay', sent: 'send', spent: 'spend',
  understood: 'understand', woke: 'wake',
};
const baseOf = (v: string) => PAST_BASE[v.toLowerCase()] ?? v;

const COMPARATIVE: Record<string, string> = {
  better: 'better', worse: 'worse', easier: 'easier', bigger: 'bigger', faster: 'faster', cheaper: 'cheaper',
  easy: 'easier', big: 'bigger', cheap: 'cheaper', fast: 'faster', small: 'smaller', good: 'better',
  bad: 'worse', long: 'longer', short: 'shorter', old: 'older', young: 'younger', hard: 'harder',
  nice: 'nicer', happy: 'happier', busy: 'busier', large: 'larger',
};
const comparative = (a: string) => COMPARATIVE[a.toLowerCase()] ?? a;

const OBJECT: Record<string, string> = { you: 'you', he: 'him', she: 'her', they: 'them', we: 'us' };
const objectOf = (p: string) => OBJECT[p.toLowerCase()] ?? p;

export interface DetectedError {
  key: string;
  label: string;
  found: string;
  fix: string;
  why: string;
  weight: number;
}

export function detectErrors(text: string): DetectedError[] {
  const src = text.replace(/[‘’]/g, "'");
  const found: DetectedError[] = [];
  for (const rule of ERROR_RULES) {
    const m = src.match(rule.pattern);
    if (!m) continue;
    found.push({ key: rule.key, label: rule.label, found: m[0].trim(), fix: rule.fix(m), why: rule.why, weight: rule.weight });
  }
  return found;
}

/** Los dos o tres errores más importantes de una lista (sin repetir tipo). */
export function topErrors(errors: DetectedError[], max = 3): DetectedError[] {
  const seen = new Set<string>();
  return [...errors]
    .sort((a, b) => b.weight - a.weight)
    .filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)))
    .slice(0, max);
}

export function ruleLabel(key: string): string {
  return ERROR_RULES.find((r) => r.key === key)?.label ?? key;
}

export function ruleWhy(key: string): string {
  return ERROR_RULES.find((r) => r.key === key)?.why ?? '';
}
