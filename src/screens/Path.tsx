import { useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { MODULES, moduleById } from '../content/course';
import { STAGES } from '../content/descriptors';
import {
  bestScore,
  checkpointTaken,
  checkpointUnlocked,
  currentModule,
  lessonDone,
  lessonUnlocked,
  moduleAssessmentUnlocked,
  modulePassed,
  moduleStatus,
} from '../engine/unlock';
import { Icon } from '../components/Icon';
import { Chip, PageHeader } from '../components/ui';
import type { Module } from '../types/content';

const STATUS_LABEL = { locked: 'Bloqueado', available: 'Disponible', current: 'En curso', completed: 'Completado' } as const;

export function PathScreen() {
  const { state } = useProgress();
  const current = currentModule(state);
  const [open, setOpen] = useState<string>(current.id);

  return (
    <div className="stack">
      <PageHeader title="Tu ruta A1 → B2" subtitle="Cada módulo se abre al aprobar la evaluación del anterior." />
      {STAGES.map((stage) => {
        const mods = MODULES.filter((m) => m.stage === stage.id);
        return (
          <section key={stage.id} className="stage">
            <h2 className="stage__title">
              Etapa {stage.id} · {stage.title} <Chip>{stage.level}</Chip>
            </h2>
            <p className="muted small">{stage.description}</p>
            <ol className="modules">
              {mods.map((m) => moduleItem(m, MODULES.indexOf(m) + 1, open === m.id, () => setOpen(open === m.id ? '' : m.id)))}
            </ol>
          </section>
        );
      })}
    </div>
  );

  function moduleItem(m: Module, n: number, open: boolean, onToggle: () => void) {
    const status = moduleStatus(state, m);
    const lessons = m.units.flatMap((u) => u.lessons);
    const done = lessons.filter((l) => lessonDone(state, l.id)).length;
    const best = bestScore(state, 'module', m.id);
    return (
      <li key={m.id} className={`module module--${status}`}>
        <button className="module__head" onClick={onToggle} aria-expanded={open}>
          <span className="module__badge" aria-hidden="true">
            {status === 'completed' ? <Icon name="check" size={18} /> : status === 'locked' ? <Icon name="lock" size={16} /> : n}
          </span>
          <span className="module__text">
            <strong>{m.title}</strong>
            <span className="muted small">
              {STATUS_LABEL[status]} · {done}/{lessons.length} lecciones{best !== null ? ` · evaluación ${Math.round(best * 100)} %` : ''}
            </span>
          </span>
          <Icon name={open ? 'x' : 'more'} size={18} />
        </button>
        {open && (
          <div className="module__body">
            <p className="muted">{m.summary}</p>
            {status === 'locked' && (
              <p className="notice">
                <Icon name="lock" size={14} /> Se abre al aprobar: {m.prereq.map((p) => moduleById.get(p)?.title).join(', ')}.
              </p>
            )}
            <p className="eyebrow">Al terminar podrás:</p>
            <ul className="cando">
              {m.canDo.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {m.units.map((u, ui) => (
              <div key={u.id} className="unit">
                <p className="unit__title">
                  Unidad {ui + 1}: {u.title}
                </p>
                <ul className="lessons">
                  {u.lessons.map((l) => {
                    const isDone = lessonDone(state, l.id);
                    const unlocked = lessonUnlocked(state, l.id);
                    const score = state.lessons[l.id]?.score;
                    return (
                      <li key={l.id}>
                        {unlocked ? (
                          <a className={`lesson-link ${isDone ? 'is-done' : ''}`} href={`#/leccion/${l.id}`}>
                            <Icon name={isDone ? 'check' : 'play'} size={16} />
                            <span>
                              {l.title}
                              <span className="muted small"> · {isDone ? `hecha (${Math.round((score ?? 0) * 100)} %)` : `${l.minutes} min`}</span>
                            </span>
                          </a>
                        ) : (
                          <span className="lesson-link is-locked">
                            <Icon name="lock" size={16} />
                            <span>
                              {l.title}
                              <span className="sr-only"> (bloqueada)</span>
                            </span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                  <li>
                    {checkpointUnlocked(state, u.id) ? (
                      <a className={`lesson-link lesson-link--eval ${checkpointTaken(state, u.id) ? 'is-done' : ''}`} href={`#/evaluacion/unidad/${u.id}`}>
                        <Icon name="target" size={16} />
                        <span>
                          Evaluación de la unidad
                          {checkpointTaken(state, u.id) && <span className="muted small"> · mejor {Math.round((bestScore(state, 'unit', u.id) ?? 0) * 100)} %</span>}
                        </span>
                      </a>
                    ) : (
                      <span className="lesson-link is-locked">
                        <Icon name="lock" size={16} /> <span>Evaluación de la unidad</span>
                      </span>
                    )}
                  </li>
                </ul>
              </div>
            ))}
            {moduleAssessmentUnlocked(state, m.id) ? (
              <a className="btn btn--primary btn--block" href={`#/evaluacion/modulo/${m.id}`}>
                <Icon name="trophy" size={18} /> {modulePassed(state, m.id) ? 'Repetir evaluación del módulo' : 'Evaluación del módulo'}
              </a>
            ) : (
              <p className="muted small">
                <Icon name="lock" size={14} /> La evaluación del módulo se abre al terminar todas las lecciones y evaluaciones de unidad.
              </p>
            )}
          </div>
        )}
      </li>
    );
  }
}
