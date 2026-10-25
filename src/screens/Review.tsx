import { useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { chunkById, chunkHome } from '../content/course';
import { dueChunks, masteryScore } from '../engine/srs';
import { askExercise, clozeExercise, meaningExercise, rebuildExercise, substitutionExercise } from '../engine/generate';
import { instrMode } from '../engine/instructions';
import { relativeDue } from '../utils/date';
import { ExerciseView } from '../components/exercises/ExerciseView';
import { Icon } from '../components/Icon';
import { Card, Empty, PageHeader } from '../components/ui';
import type { Chunk, Exercise } from '../types/content';
import type { ChunkProgress, Grade } from '../types/progress';

/** Elige el tipo de ejercicio según la etapa del chunk: cuanto más avanzado, más producción. */
export function reviewExercise(c: Chunk, p: ChunkProgress | undefined, round: number): Exercise {
  const step = p?.step ?? 0;
  const prefix = `review.${round}`;
  const pool: (Exercise | null)[] =
    step <= 1
      ? [meaningExercise(c, prefix), clozeExercise(c, prefix), rebuildExercise(c, prefix)]
      : step <= 3
        ? [askExercise(c, prefix), clozeExercise(c, prefix), meaningExercise(c, prefix)]
        : [substitutionExercise(c, prefix), askExercise(c, prefix)];
  const options = pool.filter((e): e is Exercise => !!e);
  return options[(round + c.id.length) % options.length];
}

interface Item {
  id: string;
  ex: Exercise;
  retry: boolean;
}

export function ReviewScreen() {
  const { state, act } = useProgress();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [pos, setPos] = useState(0);
  const [results, setResults] = useState<{ id: string; grade: Grade }[]>([]);
  const now = Date.now();
  const due = dueChunks(state.chunks, now).filter((p) => chunkById.has(p.id));
  const upcoming = Object.values(state.chunks).sort((a, b) => a.nextReview - b.nextReview)[0];

  const start = (ids: string[]) => {
    const round = Math.floor(Date.now() / 60000);
    setQueue(ids.map((id, i) => ({ id, ex: reviewExercise(chunkById.get(id)!, state.chunks[id], round + i), retry: false })));
    setPos(0);
    setResults([]);
  };

  if (queue && pos < queue.length) {
    const item = queue[pos];
    const mod = chunkHome.get(item.id)?.module;
    return (
      <div className="player">
        <header className="player__top">
          <button className="icon-btn" onClick={() => setQueue(null)} aria-label="Terminar repaso">
            <Icon name="x" />
          </button>
          <div className="phases" role="progressbar" aria-label="Avance del repaso" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={pos}>
            <span className="phases__seg is-current">
              <span className="phases__fill" style={{ width: `${(pos / queue.length) * 100}%` }} />
            </span>
          </div>
          <span className="small muted">
            {pos + 1}/{queue.length}
          </span>
        </header>
        {item.retry && <p className="eyebrow">Segundo intento</p>}
        <ExerciseView
          key={`${item.ex.id}-${pos}`}
          ex={item.ex}
          mode={instrMode(state.settings, mod?.stage)}
          onDone={(r) => {
            act.recordExercise(item.ex, r, 'review');
            setResults((list) => [...list, { id: item.id, grade: r.grade }]);
            // Si falla, vuelve al final de la sesión una vez más.
            if (r.grade === 'fail' && !item.retry) {
              const c = chunkById.get(item.id)!;
              setQueue([...queue, { id: item.id, ex: meaningExercise(c, `review.retry.${pos}`), retry: true }]);
            }
            setPos(pos + 1);
          }}
        />
      </div>
    );
  }

  if (queue) {
    const first = new Map<string, Grade>();
    for (const r of results) if (!first.has(r.id)) first.set(r.id, r.grade);
    const good = [...first.values()].filter((g) => g === 'unaided' || g === 'spontaneous').length;
    return (
      <div className="stack">
        <div className="victory">
          <Icon name="check" size={32} />
          <h2>Repaso terminado</h2>
          <p>
            {good} de {first.size} recuperadas sin ayuda a la primera.
          </p>
        </div>
        <Card>
          <ul className="result-list" lang="en">
            {[...first.entries()].map(([id, g]) => (
              <li key={id}>
                <Icon name={g === 'unaided' || g === 'spontaneous' ? 'check' : g === 'fail' ? 'x' : 'bulb'} size={16} />
                <span>{chunkById.get(id)?.en}</span>
                <span className="muted small">{relativeDue(state.chunks[id]?.nextReview ?? now)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">La columna derecha indica cuándo volverá cada expresión.</p>
        </Card>
        <button className="btn btn--primary btn--block" onClick={() => setQueue(null)}>
          Volver
        </button>
      </div>
    );
  }

  const weakest = Object.values(state.chunks)
    .filter((p) => chunkById.has(p.id))
    .sort((a, b) => masteryScore(a) - masteryScore(b))
    .slice(0, 6)
    .map((p) => p.id);

  return (
    <div className="stack">
      <PageHeader title="Repasos" subtitle="Recupera de memoria lo aprendido en días anteriores." />
      {due.length > 0 ? (
        <Card tone="accent">
          <h2>{due.length} expresiones esperan</h2>
          <p>Las sesiones son cortas: puedes hacerlas aunque tengas poco tiempo.</p>
          <div className="stack-sm">
            <button className="btn btn--primary btn--block" onClick={() => start(due.slice(0, 5).map((p) => p.id))}>
              <Icon name="clock" size={18} /> Repaso rápido (5 · ~3 min)
            </button>
            {due.length > 5 && (
              <button className="btn btn--soft btn--block" onClick={() => start(due.slice(0, 15).map((p) => p.id))}>
                Repaso completo ({Math.min(15, due.length)})
              </button>
            )}
          </div>
        </Card>
      ) : (
        <Empty
          icon="check"
          title="Nada pendiente"
          text={upcoming ? `Tu próximo repaso: ${relativeDue(upcoming.nextReview, now)}.` : 'Cuando aprendas expresiones en las lecciones, aparecerán aquí según el calendario 1-3-7-14-30 días.'}
        />
      )}
      {weakest.length > 0 && (
        <Card>
          <h2>Práctica extra</h2>
          <p className="muted">Tus expresiones más débiles. Practicar antes de tiempo no adelanta el calendario, pero refuerza la memoria.</p>
          <button className="btn btn--soft btn--block" onClick={() => start(weakest)}>
            Practicar las {weakest.length} más débiles
          </button>
        </Card>
      )}
      <Card>
        <h2>Evaluación acumulativa</h2>
        <p className="muted">Mezcla expresiones y situaciones de todo lo estudiado, con preguntas nuevas.</p>
        <a className="btn btn--soft btn--block" href="#/evaluacion/acumulativa/general">
          <Icon name="layers" size={18} /> Hacer evaluación acumulativa
        </a>
      </Card>
    </div>
  );
}
