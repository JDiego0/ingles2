/**
 * Validación flexible de respuestas.
 *
 * Plantillas aceptadas en las respuestas del contenido:
 *   {a|b}  alternativas        → "I {want|would like} to learn"
 *   (x)    segmento opcional   → "Could you repeat that(, please)?"
 *   *      cualquier texto     → "I'm from *"
 *   #      un número           → "I'm # years old"
 * Las comparaciones ignoran mayúsculas, puntuación, apóstrofos tipográficos y
 * diferencias entre formas contraídas y completas (I'm = I am, don't = do not).
 */

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
  fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
  thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90', hundred: '100',
};

const NEGATIONS: Record<string, string> = {
  "can't": 'can not', cannot: 'can not', "won't": 'will not', "shan't": 'shall not',
  "ain't": 'is not', "don't": 'do not', "doesn't": 'does not', "didn't": 'did not',
  "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not',
  "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not', "wouldn't": 'would not',
  "couldn't": 'could not', "shouldn't": 'should not', "mustn't": 'must not', "needn't": 'need not',
  "let's": 'let us', "o'clock": 'oclock', gonna: 'going to', wanna: 'want to', gotta: 'have got to',
  'ok': 'okay',
};

/** Palabras tras las que 's significa is/has (y no posesivo). */
const S_SUBJECTS = new Set(['he', 'she', 'it', 'that', 'what', 'where', 'who', 'there', 'here', 'how', 'this', 'everything', 'nothing', 'something', 'everyone', 'when', 'why']);

function expandToken(tok: string, next: string | undefined): string {
  if (NEGATIONS[tok]) return NEGATIONS[tok];
  const m = tok.match(/^([a-z]+)'(m|re|ve|ll|d|s)$/);
  if (!m) return tok;
  const [, base, suf] = m;
  switch (suf) {
    case 'm': return `${base} am`;
    case 're': return `${base} are`;
    case 've': return `${base} have`;
    case 'll': return `${base} will`;
    case 'd': return next === 'better' || next === 'been' ? `${base} had` : `${base} would`;
    case 's':
      if (!S_SUBJECTS.has(base)) return tok; // posesivo: Maria's
      return next === 'been' || next === 'got' ? `${base} has` : `${base} is`;
  }
  return tok;
}

/** Normaliza un texto para comparar. Conserva «*» como comodín. */
export function normalize(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”"]/g, ' ')
    .replace(/\ba\.m\./g, 'am')
    .replace(/\bp\.m\./g, 'pm')
    .replace(/(\d)[.,](\d)/g, '$1$2')
    .replace(/[^a-z0-9'*#\s-]/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const toks = cleaned.split(' ');
  const out: string[] = [];
  toks.forEach((t, i) => {
    const expanded = expandToken(t, toks[i + 1]);
    for (const w of expanded.split(' ')) {
      const n = NUMBER_WORDS[w] ?? w;
      const prev = out[out.length - 1];
      // twenty eight → 28
      if (/^[1-9]$/.test(n) && prev && /^[2-9]0$/.test(prev)) out[out.length - 1] = prev[0] + n;
      else out.push(n);
    }
  });
  return out.join(' ');
}

/** Expande una plantilla en todas sus variantes (máximo `limit`). */
export function expandTemplate(template: string, limit = 256): string[] {
  const results: string[] = [];
  const walk = (s: string) => {
    if (results.length >= limit) return;
    const brace = s.indexOf('{');
    const paren = s.indexOf('(');
    const useBrace = brace !== -1 && (paren === -1 || brace < paren);
    const start = useBrace ? brace : paren;
    if (start === -1) {
      results.push(s);
      return;
    }
    const close = s.indexOf(useBrace ? '}' : ')', start);
    if (close === -1) {
      results.push(s.replace(/[{}()]/g, ''));
      return;
    }
    const before = s.slice(0, start);
    const inner = s.slice(start + 1, close);
    const after = s.slice(close + 1);
    const options = useBrace ? inner.split('|') : ['', inner];
    for (const opt of options) walk(before + opt + after);
  };
  walk(template);
  return results;
}

const escapeRe = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** Convierte una variante normalizada con «*» en una expresión regular. */
function wildcardSource(variant: string): string {
  let src = '';
  variant.split('*').map((p) => p.trim()).forEach((p, i) => {
    if (i > 0) src += (src ? '\\s' : '') + '.+?' + (p ? '\\s' : '');
    src += escapeRe(p).replace(/#/g, '\\d+');
  });
  return src;
}

const isPattern = (v: string) => v.includes('*') || v.includes('#');

/** Compara un texto ya normalizado con una variante normalizada (con posibles «*» o «#»). */
function matchesVariant(given: string, variant: string): boolean {
  if (!isPattern(variant)) return given === variant;
  return new RegExp('^' + wildcardSource(variant) + '$').test(given);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type MatchResult =
  | { result: 'correct'; target: string }
  | { result: 'close'; target: string; distance: number }
  | { result: 'wrong'; target: string };

/**
 * Comprueba una respuesta contra una lista de plantillas aceptadas.
 * `keys`: si todas aparecen en la respuesta, también se acepta (respuestas semiabiertas).
 */
export function checkAnswer(given: string, accept: string[], keys?: string[], anyOf?: string[]): MatchResult {
  const g = normalize(given);
  const display = accept[0]?.replace(/\{([^|}]*)[^}]*\}/g, '$1').replace(/\(([^)]*)\)/g, '$1').replace(/\s*\*\s*/g, ' … ') ?? '';
  if (!g) return { result: 'wrong', target: display };
  let best = { dist: Infinity, text: display };
  for (const tpl of accept) {
    for (const variant of expandTemplate(tpl)) {
      const v = normalize(variant);
      if (matchesVariant(g, v)) return { result: 'correct', target: variant };
      if (!isPattern(v)) {
        const d = levenshtein(g, v);
        if (d < best.dist) best = { dist: d, text: variant };
      }
    }
  }
  if (keys && keys.length && keys.every((k) => containsPhrase(given, k))) {
    return { result: 'correct', target: display };
  }
  if (anyOf && anyOf.some((k) => containsPhrase(given, k))) {
    return { result: 'correct', target: display };
  }
  const tolerance = Math.max(1, Math.floor(best.text.length / 14));
  if (best.dist <= tolerance) return { result: 'close', target: best.text, distance: best.dist };
  return { result: 'wrong', target: best.text };
}

/** ¿El texto contiene la expresión (normalizada, respetando límites de palabra)? */
export function containsPhrase(text: string, phrase: string): boolean {
  const t = ' ' + normalize(text) + ' ';
  return expandTemplate(phrase).some((variant) => {
    const p = normalize(variant);
    if (!p) return false;
    if (isPattern(p)) {
      return new RegExp('(^|\\s)' + wildcardSource(p) + '(\\s|$)').test(t);
    }
    return t.includes(' ' + p + ' ');
  });
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => /[a-zA-Z]/.test(w)).length;
}

/** Pista pequeña: primera letra de cada palabra. «I'm from Colombia» → «I'm f___ C_______». */
export function firstLetters(text: string, reveal = 1): string {
  return text
    .split(' ')
    .map((w, i) => {
      if (i < reveal) return w;
      return w.replace(/^([^A-Za-z]*[A-Za-z])([A-Za-z']*)(.*)$/, (_m, a: string, b: string, c: string) => a + b.replace(/[A-Za-z']/g, '_') + c);
    })
    .join(' ');
}

/** Pista intermedia: muestra la mitad inicial de las palabras. */
export function halfReveal(text: string): string {
  const words = text.split(' ');
  const keep = Math.max(1, Math.ceil(words.length / 2));
  return words.map((w, i) => (i < keep ? w : w.replace(/[A-Za-z']/g, '_'))).join(' ');
}

export interface WordDiff {
  word: string;
  status: 'ok' | 'missing' | 'extra';
}

/** Diferencias palabra a palabra entre la respuesta y el objetivo (LCS). */
export function diffWords(given: string, target: string): WordDiff[] {
  const a = given.trim().split(/\s+/).filter(Boolean);
  const b = target.trim().split(/\s+/).filter(Boolean);
  const na = a.map((w) => normalize(w));
  const nb = b.map((w) => normalize(w));
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: WordDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (na[i] === nb[j]) {
      out.push({ word: b[j], status: 'ok' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ word: a[i], status: 'extra' });
      i++;
    } else {
      out.push({ word: b[j], status: 'missing' });
      j++;
    }
  }
  while (i < a.length) out.push({ word: a[i++], status: 'extra' });
  while (j < b.length) out.push({ word: b[j++], status: 'missing' });
  return out;
}

/** Proporción de palabras del objetivo reconocidas en una transcripción (para voz). */
export function wordOverlap(transcript: string, target: string): number {
  const t = normalize(transcript).split(' ').filter(Boolean);
  const g = normalize(target).replace(/\*/g, '').split(' ').filter(Boolean);
  if (!g.length) return 0;
  const pool = [...t];
  let hit = 0;
  for (const w of g) {
    const k = pool.indexOf(w);
    if (k !== -1) {
      hit++;
      pool.splice(k, 1);
    }
  }
  return hit / g.length;
}
