/**
 * Ayudas de contexto para el reconocimiento de voz. El reconocedor escucha inglés «literal»:
 * un nombre como «Medellín» o una palabra dicha con acento puede salir como «medicine» o
 * «met a gene». Con las palabras del tema que se está practicando:
 *  1) se le da al modelo una lista de vocabulario (Whisper la usa como pista de lo que va a oír);
 *  2) después se corrige el texto: lo que suena parecido a una palabra esperada se reemplaza por ella.
 */

export interface Term {
  /** Forma escrita correcta («Medellín», «neighborhood»). */
  text: string;
  /** Nombre propio: se corrige con más flexibilidad porque el reconocedor casi nunca lo acierta. */
  proper: boolean;
  /** De la lista general (no del tema ni tuyo): pierde ante una palabra del tema que suene igual. */
  common?: boolean;
}

/** Lugares y nombres que un estudiante colombiano suele decir. */
export const COMMON_PROPER = [
  'Colombia',
  'Colombian',
  'Medellín',
  'Bogotá',
  'Cali',
  'Cartagena',
  'Barranquilla',
  'Bucaramanga',
  'Pereira',
  'Manizales',
  'Santa Marta',
  'Antioquia',
  'Envigado',
  'Itagüí',
  'Rionegro',
  'Latin America',
  'Spanish',
  'English',
];

const STOP = new Set(
  (
    'a an the and or but so to of in on at by for from with as is am are was were be been do does did have has had ' +
    'i me my you your he him his she her it its we us our they them their this that these those there here ' +
    "not no yes very too can could will would should may might must i'm it's don't what when where who why how " +
    'some any all just also then than about into over up out off if or ' +
    "he's she's that's what's there's here's let's i've you've we've they've i'd you'd i'll you'll we'll we're you're they're " +
    "isn't aren't wasn't weren't doesn't didn't can't won't wouldn't couldn't shouldn't haven't hasn't"
  ).split(' '),
);

/**
 * Palabras muy frecuentes: si el reconocedor las escribió, casi seguro se dijeron así.
 * Un tramo formado solo por ellas no se reemplaza («to go» no se convierte en «Diego»).
 */
const FREQUENT = new Set(
  (
    'go goes going gone went get gets got getting make makes made making take takes took taken know knew known think thought see saw seen ' +
    'come came want wanted look looked use used find found give gave given tell told work worked works call called try tried ask asked ' +
    'need needed feel felt leave left put mean meant keep kept let begin seem help talk turn start show hear heard play run move like ' +
    'liked live lived believe hold bring happen write wrote provide sit stand lose lost pay paid meet met include continue set learn ' +
    'change lead understand watch follow stop create speak read spend grow open walk win offer remember love buy wait send expect build ' +
    'stay fall cut reach say says said tell eat drink sleep drive cook study travel visit share check fix test wake ' +
    'time year years people way day days man thing things woman life child world school state family student group country problem ' +
    'hand part place case week company system program question number night point home water room mother area money story fact month ' +
    'lot right study book eye job word business issue side kind head house service friend friends father power hour game line end ' +
    'member law car city name team minute idea kid body back parent face level office door health person art history party result ' +
    'morning reason girl guy moment air teacher food coffee weekend today tomorrow yesterday tonight ' +
    'good new first last long great little own other old big high different small large next early young important few bad same able ' +
    'nice well better best sure free true full late hard real easy happy busy ready fine ' +
    'now only really still even never always often again already maybe please thanks thank okay much many more most each every both ' +
    'such after before because while since until through during without against between under around well ' +
    'one two three four five six seven eight nine ten hundred gonna wanna yeah hello good bye show shows showed whole built build'
  ).split(' '),
);

/** Minúsculas y sin tildes. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const letters = (s: string) => fold(s).replace(/[^a-z]/g, '');

/**
 * Clave de sonido aproximada, pensada para las confusiones del reconocedor con acento hispano:
 * b/v, s/z/c suave, d/t/th, ll/y/j/g suave, h muda… y todas las vocales cuentan como una sola.
 */
export function phoneticKey(word: string): string {
  // La «e» muda final del inglés no suena («gene», «Madeline»).
  let w = fold(word)
    .split(/[^a-z]+/)
    .map((p) => (p.length > 3 ? p.replace(/([^aeiou])e$/, '$1') : p))
    .join('');
  if (!w) return '';
  w = w
    .replace(/^kn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/^ps/, 's')
    .replace(/x/g, 'ks')
    .replace(/ph/g, 'f')
    .replace(/gh/g, '')
    .replace(/[st]ion/g, 'xn')
    .replace(/ch|sh/g, 'x')
    .replace(/th/g, 't')
    .replace(/dg/g, 'y')
    .replace(/ll/g, 'y')
    .replace(/g(?=[eiy])/g, 'y')
    .replace(/j/g, 'y')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/ck|c|q/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/d/g, 't')
    .replace(/h/g, '')
    .replace(/w/g, 'u')
    .replace(/y(?![aeiou])/g, 'i')
    .replace(/[aeiou]+/g, 'a')
    .replace(/(.)\1+/g, '$1');
  return w;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const ratio = (a: string, b: string) => (a || b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 1);

/** Parecido (0–1) entre lo que se oyó y una palabra esperada: sobre todo por sonido, algo por letras. */
export function soundsLike(heard: string, term: string): number {
  return 0.6 * ratio(phoneticKey(heard), phoneticKey(term)) + 0.4 * ratio(letters(heard), letters(term));
}

/**
 * Vocabulario a partir de frases de la lección (modelos, expresiones, nombres).
 * Nombres propios: palabras con mayúscula que no empiezan la frase (y grupos como «Santa Marta»).
 */
export function termsFrom(texts: string[], proper: string[] = [], common: string[] = []): Term[] {
  const out = new Map<string, Term>();
  const add = (text: string, isProper: boolean, isCommon = false) => {
    const k = letters(text);
    if (k.length < 3) return;
    const prev = out.get(k);
    if (!prev || (isProper && !prev.proper) || (prev.common && !isCommon)) out.set(k, { text, proper: isProper || !!prev?.proper, common: isCommon || undefined });
  };
  for (const p of proper) for (const t of p.split(/[,;\n]+/)) if (t.trim()) add(t.trim(), true);
  for (const t of common) add(t, true, true);
  for (const raw of texts) {
    // Quita la notación de las respuestas aceptadas: {a|b}, (opcional), *, #.
    const clean = raw.replace(/\{([^|}]*)[^}]*\}/g, '$1').replace(/[()*#]/g, ' ');
    for (const sentence of clean.split(/[.!?¿¡:;\n]+/)) {
      const ws = sentence.split(/\s+/).map((w) => w.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, '')).filter(Boolean);
      let group: string[] = [];
      const flush = () => {
        if (group.length) add(group.join(' '), true);
        group = [];
      };
      ws.forEach((w, i) => {
        const capital = /^\p{Lu}/u.test(w) && i > 0 && !/^I('|$)/.test(w);
        if (capital) group.push(w);
        else {
          flush();
          if (w.length >= 4 && !STOP.has(w.toLowerCase())) add(w.toLowerCase(), false);
        }
      });
      flush();
    }
  }
  return [...out.values()];
}

/**
 * Lista de vocabulario para el modelo. Whisper la lee como texto anterior a la grabación,
 * así que escribe esas palabras tal cual si cree oírlas. Lo más importante va al final.
 */
export function promptFor(terms: Term[], maxChars = 600): string {
  // La lista general de lugares va primero (pesa menos); el tema y tus nombres, al final.
  const ordered = [...terms.filter((t) => t.common), ...terms.filter((t) => !t.proper), ...terms.filter((t) => t.proper && !t.common)];
  const picked: string[] = [];
  let len = 0;
  for (let i = ordered.length - 1; i >= 0 && len + ordered[i].text.length + 2 <= maxChars; i--) {
    picked.unshift(ordered[i].text);
    len += ordered[i].text.length + 2;
  }
  return picked.length ? `${picked.join(', ')}.` : '';
}

interface Token {
  pre: string;
  word: string;
  post: string;
}

function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const m = /^([^\p{L}\p{N}']*)(.*?)([^\p{L}\p{N}']*)$/u.exec(t)!;
      return { pre: m[1], word: m[2], post: m[3] };
    });
}

/**
 * Corrige la transcripción con el vocabulario esperado: si un tramo de 1 a 4 palabras suena
 * como una palabra del tema, se reemplaza por ella («met a gene» → «Medellín»,
 * «Medellin» → «Medellín»). Las palabras comunes solo se cambian si el parecido es muy alto.
 */
export function correctTranscript(text: string, terms: Term[]): string {
  const tokens = tokenize(text);
  if (!tokens.length || !terms.length) return text;
  const exact = new Set(terms.map((t) => letters(t.text)));
  type Hit = { i: number; n: number; score: number; term: Term };
  const hits: Hit[] = [];
  for (const term of terms) {
    const target = letters(term.text);
    if (target.length < 4) continue;
    const tn = term.text.split(/\s+/).length;
    for (let n = Math.max(1, tn - 1); n <= Math.min(4, tn + 2); n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const win = tokens.slice(i, i + n);
        // Un tramo que empieza o acaba en «in», «the»… solo cuenta si se parece mucho («the ego» → «Diego»).
        const edge = n > 1 && (STOP.has(fold(win[0].word)) || STOP.has(fold(win[n - 1].word))) ? 0.1 : 0;
        // Solo el primer y el último token pueden llevar puntuación pegada (no se une a través de una coma).
        if (win.some((t, k) => (k > 0 && t.pre) || (k < n - 1 && t.post))) continue;
        if (win.some((t) => !t.word)) continue;
        const heard = win.map((t) => t.word).join(' ');
        const joined = letters(heard);
        if (!joined) continue;
        if (joined === target) {
          // Ya está bien dicho. Se arreglan palabras partidas («neighbor hood») y, en los nombres, tildes y mayúsculas.
          const same = term.proper ? heard === term.text : fold(heard) === fold(term.text);
          if (!same) hits.push({ i, n, score: 2, term });
          continue;
        }
        // Una palabra que ya es otra del vocabulario no se toca, ni un tramo de palabras muy frecuentes.
        if (win.some((t) => exact.has(letters(t.word)))) continue;
        if (win.every((t) => STOP.has(fold(t.word)) || FREQUENT.has(fold(t.word)))) continue;
        const lr = joined.length / target.length;
        if (lr < 0.6 || lr > 1.6) continue;
        const score = soundsLike(heard, term.text) - (term.common ? 0.05 : 0);
        if (score >= (term.proper ? 0.62 : 0.82) + edge) hits.push({ i, n, score, term });
      }
    }
  }
  if (!hits.length) return text;
  hits.sort((a, b) => b.score - a.score || a.n - b.n);
  const used = new Array<boolean>(tokens.length).fill(false);
  const chosen: Hit[] = [];
  for (const h of hits) {
    if (used.slice(h.i, h.i + h.n).some(Boolean)) continue;
    for (let k = h.i; k < h.i + h.n; k++) used[k] = true;
    chosen.push(h);
  }
  chosen.sort((a, b) => b.i - a.i);
  const out = [...tokens];
  for (const h of chosen) {
    const first = out[h.i];
    const last = out[h.i + h.n - 1];
    // Al principio de la frase, una palabra común conserva la mayúscula.
    const capital = !h.term.proper && /^\p{Lu}/u.test(first.word) ? h.term.text[0].toUpperCase() + h.term.text.slice(1) : h.term.text;
    out.splice(h.i, h.n, { pre: first.pre, word: capital, post: last.post });
  }
  return out.map((t) => t.pre + t.word + t.post).join(' ');
}
