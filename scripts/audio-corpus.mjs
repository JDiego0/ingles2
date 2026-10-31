/**
 * Reúne todas las frases en inglés que la app puede reproducir y las guarda en
 * scripts/audio-corpus.json (texto normalizado → id del archivo). Lo usa make-audio.py.
 *
 * Uso: node scripts/audio-corpus.mjs
 */
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const load = (p) => server.ssrLoadModule(p);
  const { MODULES, CHUNKS } = await load('/src/content/course.ts');
  const { CONVERSATIONS } = await load('/src/content/conversations.ts');
  const { MINIMAL_PAIRS, RHYTHM } = await load('/src/content/pronunciation.ts');
  const { audioKey, audioId, audioIdTagged } = await load('/src/speech/audio.ts');
  const { speakerGender } = await load('/src/speech/tts.ts');

  // Campos cuyo texto en inglés se escucha en algún botón de la app.
  const SPOKEN = new Set(['en', 'say', 'text', 'sentence', 'context', 'model', 'question', 'variants', 'sentences', 'pairs']);
  const texts = new Set(["Hi! I'm your English practice voice. How does this sound?"]);
  const add = (v) => {
    if (typeof v === 'string') texts.add(v);
    else if (Array.isArray(v)) v.forEach(add);
  };
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (SPOKEN.has(k)) add(v);
      if (typeof v === 'object') walk(v);
    }
  };
  walk([MODULES, CHUNKS, CONVERSATIONS, MINIMAL_PAIRS, RHYTHM]);

  // Corpus base: todas las frases con la voz femenina predeterminada (formato simple).
  const corpus = {};
  for (const t of texts) {
    const key = audioKey(t);
    // Solo frases con letras latinas (descarta textos en español con «___» u otros restos).
    if (key && /[a-z]/i.test(key) && !key.includes('___')) corpus[audioId(t)] = key;
  }

  // Entradas adicionales con voz masculina para las líneas de diálogo de hablantes masculinos.
  for (const mod of MODULES) {
    for (const unit of mod.units) {
      for (const lesson of unit.lessons) {
        for (const line of lesson.context.lines) {
          const gender = speakerGender(line.who);
          if (gender === 'male') {
            const key = audioKey(line.en);
            if (key && /[a-z]/i.test(key) && !key.includes('___')) {
              const id = audioIdTagged(line.en, 'm');
              corpus[id] = { text: key, voice: 'male' };
            }
          }
        }
      }
    }
  }

  writeFileSync('scripts/audio-corpus.json', JSON.stringify(corpus, null, 0));
  console.log(`${Object.keys(corpus).length} frases (incluye entradas con voz masculina)`);
} finally {
  await server.close();
}
