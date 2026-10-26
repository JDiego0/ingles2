import { useMemo, useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { chunkById, lessonById, LESSONS } from '../content/course';
import { buildLessonPlan, PHASES, pickWarmup, summarize, victoryId, type Step } from '../engine/lessonPlan';
import { instrMode } from '../engine/instructions';
import { lessonUnlocked } from '../engine/unlock';
import { detectErrors, topErrors } from '../engine/errors';
import { DAY } from '../engine/srs';
import { navigate } from '../router';
import { ExerciseView } from '../components/exercises/ExerciseView';
import type { ExerciseResult } from '../components/exercises/types';
import { Icon } from '../components/Icon';
import { Card, Chip, Empty, Verdict } from '../components/ui';
import { SpeechHints } from '../components/SpeechHints';
import { ContextStep, DescriptorList, GrammarStep, PhaseIntro, TeachStep, VictoryStep } from './lesson/Steps';
import type { Lesson } from '../types/content';
import type { LessonSession } from '../types/progress';

/** Lo que se oye y se practica en la lección: el micrófono lo usa como pista. */
function lessonVocabulary(lesson: Lesson): string[] {
  const chunks = lesson.newChunks.map((id) => chunkById.get(id)).filter((c) => !!c);
  return [...chunks.flatMap((c) => [c.en, c.example.en]), ...lesson.context.lines.map((l) => l.en)];
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const { state, act } = useProgress();
  const ref = lessonById.get(lessonId);
  const session = state.session?.lessonId === lessonId ? state.session : null;
  const [started, setStarted] = useState(false);

  const steps = useMemo(() => (ref && session ? buildLessonPlan(ref.lesson, session.warmup) : []), [ref, session?.warmup]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ref) {
    return <Empty icon="alert" title="Lección no encontrada" text="Puede que el enlace sea antiguo." action={<a className="btn btn--primary" href="#/ruta">Ver la ruta</a>} />;
  }
  const { lesson, module } = ref;
  const mode = instrMode(state.settings, module.stage);

  if (!lessonUnlocked(state, lessonId)) {
    return (
      <Empty
        icon="lock"
        title="Lección bloqueada"
        text="Completa primero las lecciones y evaluaciones anteriores. Así cada lección se apoya en lo que ya sabes."
        action={<a className="btn btn--primary" href="#/ruta">Ver la ruta</a>}
      />
    );
  }

  const begin = (fresh: boolean) => {
    if (fresh || !session) {
      const s: LessonSession = { lessonId, phase: 0, step: 0, startedAt: Date.now(), warmup: pickWarmup(lesson, state.chunks, Date.now()), results: {} };
      act.setSession(s);
    }
    setStarted(true);
  };

  if (!started || !session) {
    return <LessonIntro lesson={lesson} resumable={!!session} onStart={begin} done={!!state.lessons[lessonId]} />;
  }

  const current = steps[Math.min(session.step, steps.length - 1)];
  const prev = steps[session.step - 1];
  const firstOfPhase = !prev || prev.phase !== current.phase;
  const phaseSteps = steps.filter((s) => s.phase === current.phase);
  const posInPhase = phaseSteps.indexOf(current) + 1;

  const advance = (extra?: Record<string, { g: ExerciseResult['grade']; s: number }>) => {
    const nextIdx = Math.min(session.step + 1, steps.length - 1);
    act.setSession({ ...session, step: nextIdx, phase: steps[nextIdx].phase, results: { ...session.results, ...extra } });
  };

  const onExercise = (step: Extract<Step, { kind: 'exercise' }>) => (r: ExerciseResult) => {
    act.recordExercise(step.ex, r, step.ctx);
    advance({ [step.ex.id]: { g: r.grade, s: r.score } });
  };

  return (
    <div className="player">
      <header className="player__top">
        <button className="icon-btn" onClick={() => navigate('#/')} aria-label="Salir (tu avance queda guardado)">
          <Icon name="x" />
        </button>
        <div className="phases" role="progressbar" aria-label="Fases de la lección" aria-valuemin={1} aria-valuemax={6} aria-valuenow={current.phase + 1}>
          {PHASES.map((p, i) => (
            <span key={p.title} className={`phases__seg ${i < current.phase ? 'is-done' : i === current.phase ? 'is-current' : ''}`} title={p.title}>
              {i === current.phase && <span className="phases__fill" style={{ width: `${(posInPhase / phaseSteps.length) * 100}%` }} />}
            </span>
          ))}
        </div>
        <span className="player__count small muted">
          {current.phase + 1}/6
        </span>
      </header>
      <p className="player__phase">
        {mode === 'es' ? PHASES[current.phase].title : PHASES[current.phase].titleEn} <span className="muted">· {posInPhase}/{phaseSteps.length}</span>
      </p>

      {firstOfPhase && current.kind !== 'summary' && <PhaseIntro {...PHASES[current.phase]} mode={mode} />}

      <SpeechHints texts={lessonVocabulary(lesson)}>
        <div key={session.step}>{renderStep(current)}</div>
      </SpeechHints>
    </div>
  );

  function renderStep(step: Step) {
    switch (step.kind) {
      case 'exercise':
        return <ExerciseView ex={step.ex} mode={mode} onDone={onExercise(step)} />;
      case 'context':
        return (
          <ContextStep
            lesson={lesson}
            mode={mode}
            onRecord={(exId, r) => {
              const ex = lesson.context.gist.find((g) => g.id === exId);
              if (ex) act.recordExercise(ex, r, 'context');
            }}
            onDone={() => advance()}
          />
        );
      case 'grammar':
        return <GrammarStep lesson={lesson} onDone={() => advance()} />;
      case 'teach': {
        const teach = steps.filter((s) => s.kind === 'teach');
        return <TeachStep chunkId={step.chunkId} index={teach.indexOf(step) + 1} total={teach.length} onDone={() => advance()} />;
      }
      case 'victory':
        return <VictoryStep lesson={lesson} onDone={(g, s) => advance({ [victoryId(lesson.id)]: { g, s } })} />;
      case 'summary':
        return <Summary lesson={lesson} steps={steps} session={session!} />;
    }
  }
}

function LessonIntro({ lesson, resumable, onStart, done }: { lesson: Lesson; resumable: boolean; onStart: (fresh: boolean) => void; done: boolean }) {
  const ref = lessonById.get(lesson.id)!;
  return (
    <div className="stack">
      <a className="link" href="#/ruta">
        ← Ruta
      </a>
      <div className="lesson-intro">
        <p className="eyebrow">
          {ref.module.title} · {ref.unit.title}
        </p>
        <h1>{lesson.title}</h1>
        <p lang="en" className="muted">{lesson.titleEn}</p>
        <Verdict kind="info">
          <strong>Al terminar:</strong> {lesson.goal}
        </Verdict>
      </div>
      <Card>
        <h2>Tu sesión (~{lesson.minutes} min)</h2>
        <ol className="phase-list">
          {PHASES.map((p) => (
            <li key={p.title}>
              <strong>{p.title}</strong> <span className="muted small">~{p.minutes} min</span>
            </li>
          ))}
        </ol>
        <p className="muted small">Los tiempos son orientativos: tómate el tiempo que necesites. Puedes salir y retomar donde lo dejaste.</p>
      </Card>
      <Card>
        <h2>Expresiones nuevas</h2>
        <div className="chips">
          {lesson.newChunks.map((id) => (
            <Chip key={id} tone="accent">
              <span lang="en">{chunkById.get(id)?.en}</span>
            </Chip>
          ))}
        </div>
        <p className="eyebrow">Descriptores trabajados</p>
        <DescriptorList ids={lesson.descriptors} />
      </Card>
      {resumable ? (
        <>
          <button className="btn btn--primary btn--block btn--lg" onClick={() => onStart(false)}>
            <Icon name="play" /> Retomar donde lo dejé
          </button>
          <button className="btn btn--ghost btn--block" onClick={() => onStart(true)}>
            Empezar de nuevo
          </button>
        </>
      ) : (
        <button className="btn btn--primary btn--block btn--lg" onClick={() => onStart(true)}>
          <Icon name="play" /> {done ? 'Repetir la lección' : 'Empezar'}
        </button>
      )}
    </div>
  );
}

function Summary({ lesson, steps, session }: { lesson: Lesson; steps: Step[]; session: LessonSession }) {
  const { state, act } = useProgress();
  const sum = summarize(lesson, steps, session);
  const now = Date.now();
  const tomorrow = Object.values(state.chunks)
    .filter((c) => c.nextReview < now + 1.5 * DAY)
    .map((c) => chunkById.get(c.id))
    .filter((c) => !!c)
    .slice(0, 8);
  const errors = topErrors(
    state.attempts.filter((a) => a.t >= session.startedAt && a.given).flatMap((a) => detectErrors(a.given!)),
    3,
  );
  const victory = [...state.samples].reverse().find((s) => s.ref === `${lesson.id}.victory`);
  const idx = LESSONS.findIndex((l) => l.lesson.id === lesson.id);
  const label = (id: string) => chunkById.get(id)?.en ?? id;

  const finish = (href: string) => {
    act.completeLesson(lesson.id, sum);
    navigate(href);
  };

  return (
    <div className="stack">
      <div className="victory">
        <Icon name="star" size={32} />
        <h2>¡Sesión terminada!</h2>
        <p>Evaluación final: {Math.round(sum.score * 100)} %</p>
      </div>
      <Card>
        <h3>
          <Icon name="check" size={16} /> Recuperaste sin ayuda
        </h3>
        <p lang="en">{sum.recalled.length ? sum.recalled.map(label).join(' · ') : '—'}</p>
        <h3>
          <Icon name="bulb" size={16} /> Necesitaron pista
        </h3>
        <p lang="en">{sum.hinted.length ? sum.hinted.map(label).join(' · ') : '—'}</p>
        <h3>
          <Icon name="x" size={16} /> Todavía no las recuerdas
        </h3>
        <p lang="en">{sum.missed.length ? sum.missed.map(label).join(' · ') : '—'}</p>
      </Card>
      {errors.length > 0 && (
        <Card>
          <h3>Errores para corregir</h3>
          {errors.map((e) => (
            <p key={e.key}>
              <del lang="en">{e.found}</del> → <ins lang="en">{e.fix}</ins>
              <br />
              <span className="muted small">{e.why}</span>
            </p>
          ))}
        </Card>
      )}
      <Card>
        <h3>Mañana repasarás</h3>
        <p lang="en">{tomorrow.length ? tomorrow.map((c) => c.en).join(' · ') : 'Nada pendiente todavía.'}</p>
      </Card>
      {victory && (
        <Card tone="soft">
          <h3>Esto lo dijiste tú, sin guion</h3>
          <blockquote lang="en">{victory.text}</blockquote>
        </Card>
      )}
      {sum.score < 0.6 && <Verdict kind="info">La evaluación quedó por debajo del 60 %. Puedes continuar, pero te recomendamos repetir esta lección después de tus repasos.</Verdict>}
      <button className="btn btn--primary btn--block btn--lg" onClick={() => finish('#/')}>
        Terminar lección
      </button>
      {LESSONS[idx + 1] && (
        <button className="btn btn--ghost btn--block" onClick={() => finish('#/ruta')}>
          Terminar y ver la ruta
        </button>
      )}
    </div>
  );
}
