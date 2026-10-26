import { useMemo, useState } from 'react';
import { seededShuffle } from '../../utils/random';
import { Icon } from '../Icon';

/** Palabras que los hispanohablantes suelen confundir: se añaden como bloques de distracción. */
const CONFUSIONS: Record<string, string[]> = {
  is: ['are'], are: ['is'], am: ['is'], do: ['does'], does: ['do'], did: ['does'],
  a: ['an', 'the'], an: ['a'], the: ['a'], in: ['on', 'at'], on: ['in'], at: ['in'],
  have: ['has'], has: ['have'], was: ['were'], were: ['was'], my: ['me'], me: ['my'],
  i: ['me'], he: ['she'], she: ['he'], his: ['her'], her: ['his'], to: ['for'], for: ['to'],
  much: ['many'], many: ['much'], than: ['that'], this: ['these'], go: ['going'], going: ['go'],
  make: ['do'], say: ['tell'], tell: ['say'], since: ['for'], will: ['would'], would: ['will'],
};

const clean = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');

/** Bloques para formar `target`, más 1–2 distractores plausibles. */
export function bankFor(target: string, seed: string): string[] {
  const words = target.split(/\s+/).filter(Boolean);
  const present = new Set(words.map(clean));
  const extra: string[] = [];
  for (const w of seededShuffle(words, seed + ':d')) {
    for (const alt of CONFUSIONS[clean(w)] ?? []) {
      if (extra.length < 2 && !present.has(alt) && !extra.includes(alt)) extra.push(/^[A-Z]/.test(w) && alt !== 'i' ? alt[0].toUpperCase() + alt.slice(1) : alt);
    }
  }
  let s = seededShuffle([...words, ...extra], seed);
  if (s.join(' ') === words.join(' ') && s.length > 1) s = [...s.slice(1), s[0]];
  return s;
}

/**
 * Formar una frase tocando bloques (alternativa a escribir).
 * Llama a `onSubmit` con la frase formada; quien la use decide si es correcta.
 */
export function WordBank({ target, seed, onSubmit, status, prefix }: {
  target: string;
  seed: string;
  onSubmit: (text: string) => void;
  status?: 'bad' | 'ok';
  /** Bloques ya colocados por una pista (las primeras palabras). */
  prefix?: number;
}) {
  const bank = useMemo(() => bankFor(target, seed), [target, seed]);
  const [chosen, setChosen] = useState<number[]>(() => {
    const words = target.split(/\s+/);
    const placed: number[] = [];
    for (let i = 0; i < (prefix ?? 0) && i < words.length; i++) {
      const k = bank.findIndex((w, idx) => w === words[i] && !placed.includes(idx));
      if (k >= 0) placed.push(k);
    }
    return placed;
  });
  const text = chosen.map((k) => bank[k]).join(' ');
  const locked = status === 'ok';
  return (
    <div className="stack stack--tight">
      <div className={`order-line ${status === 'bad' ? 'order-line--bad' : status === 'ok' ? 'order-line--ok' : ''}`} aria-label="Tu frase" lang="en">
        {chosen.length === 0 && <span className="muted">Toca los bloques en orden (sobra alguno)…</span>}
        {chosen.map((k, pos) => (
          <button key={pos} type="button" className="tile tile--placed" disabled={locked} onClick={() => setChosen(chosen.filter((_, p) => p !== pos))} aria-label={`Quitar ${bank[k]}`}>
            {bank[k]}
          </button>
        ))}
      </div>
      <div className="tiles" lang="en">
        {bank.map((w, k) =>
          chosen.includes(k) ? (
            <span key={k} className="tile tile--ghost" aria-hidden="true">{w}</span>
          ) : (
            <button key={k} type="button" className="tile" disabled={locked} onClick={() => setChosen([...chosen, k])}>
              {w}
            </button>
          ),
        )}
      </div>
      {!locked && (
        <button type="button" className="btn btn--primary btn--block" disabled={!chosen.length} onClick={() => onSubmit(text)}>
          <Icon name="check" size={18} /> Comprobar
        </button>
      )}
    </div>
  );
}
