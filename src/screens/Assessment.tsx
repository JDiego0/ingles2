import { useMemo, useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { chunkById, chunkHome, LESSONS, MODULES, moduleById, unitById } from '../content/course';
import { askExercise, substitutionExercise } from '../engine/generate';
import { instrMode } from '../engine/instructions';
import { checkpointUnlocked, moduleAssessmentUnlocked, PASS_MARK } from '../engine/unlock';
import { SKILL_LABEL } from '../engine/stats';
import { seededShuffle } from '../utils/random';
import { ExerciseView } from '../components/exercises/ExerciseView';
import type { ExerciseResult } from '../components/exercises/types';
import { Icon } from '../components/Icon';
import { Card, Empty, PageHeader, Verdict, pct } from '../components/ui';
import type { Exercise, Skill, StageId } from '../types/content';
import type { AssessmentRecord, ProgressState } from '../types/progress';

/** Evaluación acumulativa: mezcla chunks de todo lo estudiado y preguntas de lecciones anteriores. */
export function buildCumulative(state: ProgressState, seed: string): Exercise[] {
  const known = Object.keys(state.chunks).filter((id) => chunkById.has(id));
  const chunks = seededShuffle(known, seed).slice(0, 6);
  const items: Exercise[] = chunks.map((id, i) => (i % 2 ? substitutionExercise(chunkById.get(id)!, `cum.${seed}`) : askExercise(chunkById.get(id)!, `cum.${seed}`)));
  const done = LESSONS.filter((l) => state.lessons[l.lesson.id]);
  const pool = done.flatMap((l) => l.lesson.assessment.filter((e) => e.kind !== 'choice'));
  items.push(...seededShuffle(pool, seed + 'a').slice(0, 3));
  const prod = done.flatMap((l) => l.lesson.production);
  items.push(...seededShuffle(prod, seed + 'p').slice(0, 1));
  return seededShuffle(items, seed + 'mix');
}

export function AssessmentScreen({ kind, id }: { kind?: string; id?: string }) {
  const { state, act } = useProgress();
  const seed = useMemo(() => String(Date.now()), []);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<{ ex: Exercise; r: ExerciseResult }[]>([]);
  const [record, setRecord] = useState<AssessmentRecord | null>(null);

  let title = '';
  let items: Exercise[] = [];
  let stage: StageId | undefined;
  let recKind: AssessmentRecord['kind'] = 'cumulative';
  let locked = false;
  if (kind === 'unidad' && id && unitById.has(id)) {
    const { unit, module } = unitById.get(id)!;
    title = `Evaluación de unidad: ${unit.title}`;
    items = unit.checkpoint;
    stage = module.stage;
    recKind = 'unit';
    locked = !checkpointUnlocked(state, id);
  } else if (kind === 'modulo' && id && moduleById.has(id)) {
    const m = moduleById.get(id)!;
    title = `Evaluación del módulo: ${m.title}`;
    items = m.assessment;
    stage = m.stage;
    recKind = 'module';
    locked = !moduleAssessmentUnlocked(state, id);
  } else if (kind === 'acumulativa') {
    title = 'Evaluación acumulativa';
    items = buildCumulative(state, seed); // eslint-disable-line react-hooks/rules-of-hooks
    const last = Object.keys(state.chunks).map((cid) => chunkHome.get(cid)?.module.stage).filter(Boolean).sort().pop();
    stage = last as StageId | undefined;
  }
  // Congelar la lista para que no cambie mientras se responde.
  const frozen = useMemo(() => items, [kind, id, started]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!title) return <Empty icon="alert" title="Evaluación no encontrada" text="" action={<a className="btn" href="#/ruta">Ruta</a>} />;
  if (locked) return <Empty icon="lock" title="Todavía no disponible" text="Termina primero las lecciones (y evaluaciones de unidad) correspondientes." action={<a className="btn btn--primary" href="#/ruta">Ver la ruta</a>} />;
  if (kind === 'acumulativa' && frozen.length < 5) {
    return <Empty icon="layers" title="Aún es pronto" text="La evaluación acumulativa estará disponible cuando hayas aprendido algunas expresiones (completa al menos una lección)." action={<a className="btn btn--primary" href="#/">Inicio</a>} />;
  }
  const mode = instrMode(state.settings, stage);

  const finish = (all: { ex: Exercise; r: ExerciseResult }[]) => {
    const score = all.reduce((a, b) => a + b.r.score, 0) / all.length;
    const sums: Partial<Record<Skill, [number, number]>> = {};
    for (const { ex, r } of all) {
      for (const s of ex.skills) {
        const cur = sums[s] ?? [0, 0];
        sums[s] = [cur[0] + r.score, cur[1] + 1];
      }
    }
    const bySkill = Object.fromEntries(Object.entries(sums).map(([k, [a, n]]) => [k, a / n])) as Partial<Record<Skill, number>>;
    const rec: AssessmentRecord = { t: Date.now(), kind: recKind, ref: id ?? 'general', score, bySkill, passed: score >= PASS_MARK };
    act.addAssessment(rec);
    setRecord(rec);
  };

  if (record) {
    const nextModule = recKind === 'module' ? MODULES[MODULES.findIndex((m) => m.id === id) + 1] : undefined;
    const weakest = Object.entries(record.bySkill).sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))[0];
    return (
      <div className="stack">
        <div className="victory">
          <Icon name={record.passed ? 'trophy' : 'target'} size={32} />
          <h2>{pct(record.score)}</h2>
          <p>{record.passed ? (recKind === 'module' ? '¡Módulo aprobado!' : '¡Superada!') : `No llegaste al ${Math.round(PASS_MARK * 100)} % esta vez.`}</p>
        </div>
        <Card>
          <h3>Por competencia</h3>
          <ul className="result-list">
            {Object.entries(record.bySkill).map(([k, v]) => (
              <li key={k}>
                <span>{SKILL_LABEL[k as Skill]}</span>
                <strong>{pct(v ?? 0)}</strong>
              </li>
            ))}
          </ul>
        </Card>
        {record.passed && nextModule && (
          <Verdict kind="ok">
            Se abre el módulo <strong>{nextModule.title}</strong>.
          </Verdict>
        )}
        {!record.passed && (
          <Verdict kind="info">
            {recKind === 'unit' ? 'Puedes continuar con la siguiente unidad. ' : ''}
            Te recomendamos repasar {weakest ? SKILL_LABEL[weakest[0] as Skill].toLowerCase() : 'lo estudiado'} y volver a intentarlo. Las preguntas cambian de contexto, así que memorizar respuestas no sirve: practica producirlas.
          </Verdict>
        )}
        <a className="btn btn--primary btn--block" href={record.passed && nextModule ? '#/ruta' : '#/repaso'}>
          {record.passed && nextModule ? 'Ver la ruta' : 'Ir a repasos'}
        </a>
        <a className="btn btn--ghost btn--block" href="#/">
          Inicio
        </a>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="stack">
        <PageHeader title={title} back="#/ruta" />
        <Card>
          <p>{frozen.length} preguntas nuevas, con situaciones distintas a las de las lecciones.</p>
          <ul className="points">
            <li>Puedes pedir pistas, pero reducen la puntuación.</li>
            <li>Para aprobar se necesita un {Math.round(PASS_MARK * 100)} %.</li>
            {recKind === 'module' && <li>Aprobarla abre el siguiente módulo.</li>}
          </ul>
        </Card>
        <button className="btn btn--primary btn--block btn--lg" onClick={() => setStarted(true)}>
          Empezar
        </button>
      </div>
    );
  }

  const ex = frozen[i];
  return (
    <div className="player">
      <header className="player__top">
        <a className="icon-btn" href="#/ruta" aria-label="Salir de la evaluación">
          <Icon name="x" />
        </a>
        <div className="phases" role="progressbar" aria-label="Avance de la evaluación" aria-valuemin={0} aria-valuemax={frozen.length} aria-valuenow={i}>
          <span className="phases__seg is-current">
            <span className="phases__fill" style={{ width: `${(i / frozen.length) * 100}%` }} />
          </span>
        </div>
        <span className="small muted">
          {i + 1}/{frozen.length}
        </span>
      </header>
      <ExerciseView
        key={`${ex.id}-${i}`}
        ex={ex}
        mode={mode}
        doneLabel={i + 1 < frozen.length ? 'Siguiente' : 'Ver resultado'}
        onDone={(r) => {
          act.recordExercise(ex, r, 'assessment');
          const all = [...results, { ex, r }];
          setResults(all);
          if (i + 1 < frozen.length) setI(i + 1);
          else finish(all);
        }}
      />
    </div>
  );
}
