import { useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { chunkById, chunkHome } from '../content/course';
import { independence, INDEPENDENCE_LABEL, masteryScore } from '../engine/srs';
import { askExercise, substitutionExercise } from '../engine/generate';
import { instrMode } from '../engine/instructions';
import { formatDate, relativeDue } from '../utils/date';
import { ChunkCard } from '../components/ChunkCard';
import { ExerciseView } from '../components/exercises/ExerciseView';
import { Icon } from '../components/Icon';
import { Bar, Card, Empty, PageHeader } from '../components/ui';

export function ChunkDetail({ id }: { id: string }) {
  const { state, act } = useProgress();
  const c = chunkById.get(id);
  const [practice, setPractice] = useState<0 | 1 | 2 | 3>(0);
  if (!c) return <Empty icon="alert" title="Expresión no encontrada" text="" action={<a className="btn" href="#/biblioteca">Biblioteca</a>} />;
  const p = state.chunks[id];
  const home = chunkHome.get(id);
  const ind = independence(p);
  const mode = instrMode(state.settings, home?.module.stage);

  return (
    <div className="stack">
      <PageHeader title="Expresión" back="#/biblioteca" />
      <ChunkCard c={c} />
      <Card>
        <h2>Tu dominio</h2>
        {p ? (
          <>
            <div className="row row--between">
              <span>{INDEPENDENCE_LABEL[ind]}</span>
              <strong>{masteryScore(p)}/100</strong>
            </div>
            <Bar value={masteryScore(p) / 100} label="Dominio" />
            <ol className="ladder" aria-label="Escala de independencia">
              {([1, 2, 3, 4] as const).map((lvl) => (
                <li key={lvl} className={ind >= lvl ? 'is-done' : ''}>
                  <Icon name={ind >= lvl ? 'check' : 'more'} size={14} /> {INDEPENDENCE_LABEL[lvl]}
                </li>
              ))}
            </ol>
            <p className="small muted">
              Último repaso: {p.lastReview ? formatDate(p.lastReview) : '—'} · Próximo: {relativeDue(p.nextReview)} · Sin ayuda: {p.counts.unaided + p.counts.spontaneous} · Con pista: {p.counts.hinted} · Fallos: {p.counts.fail}
            </p>
            {p.errors.length > 0 && (
              <>
                <h3>Tus errores recientes</h3>
                <ul className="small" lang="en">
                  {p.errors.slice(-3).map((e) => (
                    <li key={e.t}>
                      <del>{e.given}</del>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <>
            <p className="muted">
              Aún no la has practicado. {home?.lesson ? `Se enseña en la lección «${home.lesson.title}».` : 'Es una expresión extra de la biblioteca.'}
            </p>
            <button className="btn btn--soft" onClick={() => act.introduce([id])}>
              <Icon name="repeat" size={16} /> Añadir a mis repasos
            </button>
          </>
        )}
      </Card>

      {practice === 0 && (
        <button className="btn btn--primary btn--block" onClick={() => setPractice(1)}>
          <Icon name="pen" size={18} /> Practicar ahora (2 ejercicios)
        </button>
      )}
      {practice === 1 && (
        <ExerciseView key="ask" ex={askExercise(c, 'lib')} mode={mode} doneLabel="Siguiente" onDone={(r) => {
          act.introduce([id]);
          act.recordExercise(askExercise(c, 'lib'), r, 'review');
          setPractice(2);
        }} />
      )}
      {practice === 2 && (
        <ExerciseView key="sub" ex={substitutionExercise(c, 'lib')} mode={mode} doneLabel="Terminar" onDone={(r) => {
          act.recordExercise(substitutionExercise(c, 'lib'), r, 'production');
          setPractice(3);
        }} />
      )}
      {practice === 3 && <Card tone="soft">¡Hecho! Esta práctica queda registrada en tu historial.</Card>}
    </div>
  );
}
