import { useMemo, useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { CHUNKS } from '../content/course';
import { masteryScore } from '../engine/srs';
import { normalize } from '../engine/answer';
import { CATEGORY_LABEL } from '../components/ChunkCard';
import { Icon } from '../components/Icon';
import { Bar, Chip, PageHeader } from '../components/ui';
import type { Cefr, ChunkCategory } from '../types/content';

type StatusFilter = 'all' | 'new' | 'learning' | 'review' | 'mastered';

const STATUS: Record<StatusFilter, string> = {
  all: 'Todas',
  new: 'Sin empezar',
  learning: 'Aprendiendo',
  review: 'En práctica',
  mastered: 'Dominadas',
};

export function LibraryScreen() {
  const { state } = useProgress();
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<Cefr | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [cat, setCat] = useState<ChunkCategory | 'all'>('all');

  const cats = useMemo(() => [...new Set(CHUNKS.map((c) => c.cat))], []);
  const query = normalize(q);
  const list = CHUNKS.filter((c) => {
    if (level !== 'all' && c.level !== level) return false;
    if (cat !== 'all' && c.cat !== cat) return false;
    const st = state.chunks[c.id]?.state ?? 'new';
    if (status !== 'all' && st !== status) return false;
    if (query && !normalize(`${c.en} ${c.es} ${c.example.en}`).includes(query) && !c.es.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="stack">
      <PageHeader title="Biblioteca de expresiones" subtitle={`${CHUNKS.length} chunks organizados por nivel, función y situación.`} back="#/practicar" />
      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en inglés o español…" aria-label="Buscar expresiones" />
      </div>
      <div className="filters" role="group" aria-label="Filtrar por estado">
        {(Object.keys(STATUS) as StatusFilter[]).map((s) => (
          <button key={s} className={`pill ${status === s ? 'is-active' : ''}`} onClick={() => setStatus(s)} aria-pressed={status === s}>
            {STATUS[s]}
          </button>
        ))}
      </div>
      <div className="row">
        <label className="select">
          <span className="sr-only">Nivel</span>
          <select value={level} onChange={(e) => setLevel(e.target.value as Cefr | 'all')}>
            <option value="all">Todos los niveles</option>
            {(['A1', 'A2', 'B1', 'B2'] as Cefr[]).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="select grow">
          <span className="sr-only">Función comunicativa</span>
          <select value={cat} onChange={(e) => setCat(e.target.value as ChunkCategory | 'all')}>
            <option value="all">Todas las funciones</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">{list.length} resultados</p>
      <ul className="chunk-list">
        {list.map((c) => {
          const p = state.chunks[c.id];
          const score = masteryScore(p);
          return (
            <li key={c.id}>
              <a href={`#/biblioteca/${c.id}`} className="chunk-row">
                <div className="chunk-row__text">
                  <strong lang="en">{c.en}</strong>
                  <span className="muted small">{c.es}</span>
                </div>
                <div className="chunk-row__meta">
                  <Chip tone={p?.state === 'mastered' ? 'ok' : p ? 'accent' : 'muted'}>{p ? STATUS[p.state as StatusFilter] : c.level}</Chip>
                  {p && <Bar value={score / 100} label={`Dominio de ${c.en}`} small />}
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
