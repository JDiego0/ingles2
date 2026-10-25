import { useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { AREA_LABEL, DIAGNOSTIC, START_BY_ESTIMATE, type DiagArea } from '../content/diagnostic';
import { MODULES, moduleById } from '../content/course';
import { navigate } from '../router';
import { ExerciseView } from '../components/exercises/ExerciseView';
import type { ExerciseResult } from '../components/exercises/types';
import { Icon } from '../components/Icon';
import { Card, PageHeader, Verdict, pct } from '../components/ui';
import type { Skill } from '../types/content';
import type { DiagnosticRecord } from '../types/progress';

type Estimate = DiagnosticRecord['estimate'];

/** Estimación por bandas: hay que superar la banda inferior para subir. */
export function estimateFromBands(b: Record<'A1' | 'A2' | 'B1' | 'B2', number>): Estimate {
  if (b.A1 < 0.4) return 'A0';
  if (b.A1 < 0.75) return 'A1';
  if (b.A2 < 0.5) return 'A1+';
  if (b.A2 < 0.75) return 'A2';
  if (b.B1 < 0.5) return 'A2+';
  if (b.B2 < 0.6) return 'B1';
  return 'B2';
}

export function DiagnosticScreen() {
  const { state, act } = useProgress();
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Record<string, ExerciseResult>>({});
  const [record, setRecord] = useState<DiagnosticRecord | null>(null);
  const previous = state.diagnostics[state.diagnostics.length - 1];

  const finish = (all: Record<string, ExerciseResult>) => {
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const score = (id: string) => all[id]?.score ?? 0;
    const bands = (['A1', 'A2', 'B1', 'B2'] as const).reduce(
      (acc, band) => ({ ...acc, [band]: avg(DIAGNOSTIC.filter((d) => d.band === band).map((d) => score(d.ex.id))) }),
      {} as Record<'A1' | 'A2' | 'B1' | 'B2', number>,
    );
    const estimate = estimateFromBands(bands);
    const areas = Object.keys(AREA_LABEL) as DiagArea[];
    const areaScore = (a: DiagArea) => avg(DIAGNOSTIC.filter((d) => d.area === a).map((d) => score(d.ex.id)));
    const bySkill: Partial<Record<Skill, number>> = {};
    for (const s of ['listening', 'reading', 'writing', 'grammar', 'vocabulary', 'fluency'] as Skill[]) {
      const items = DIAGNOSTIC.filter((d) => d.ex.skills.includes(s));
      if (items.length) bySkill[s] = avg(items.map((d) => score(d.ex.id)));
    }
    const start = START_BY_ESTIMATE[estimate];
    const startModule = moduleById.get(start.module) ?? MODULES[MODULES.length - 1];
    const idx = MODULES.indexOf(startModule);
    const rec: DiagnosticRecord = {
      t: Date.now(),
      estimate,
      bySkill,
      strengths: areas.filter((a) => areaScore(a) >= 0.7).map((a) => AREA_LABEL[a]),
      weaknesses: areas.filter((a) => areaScore(a) < 0.5).map((a) => AREA_LABEL[a]),
      startLesson: startModule.units[0].lessons[0].id,
      sample: all['diag.p1']?.given,
    };
    act.addDiagnostic(
      rec,
      MODULES.slice(1, idx + 1).map((m) => m.id),
    );
    setRecord(rec);
  };

  if (record) {
    const start = START_BY_ESTIMATE[record.estimate];
    const mod = moduleById.get(start.module) ?? MODULES[MODULES.length - 1];
    return (
      <div className="stack">
        <PageHeader title="Tu punto de partida" />
        <Card tone="accent">
          <p className="eyebrow">Estimación orientativa</p>
          <h2 className="big">{record.estimate === 'A0' ? 'Principiante (pre-A1)' : record.estimate}</h2>
          <p className="small">Una prueba breve no certifica un nivel MCER. Sirve para elegir dónde empezar; las evaluaciones de cada módulo la irán ajustando.</p>
        </Card>
        {previous && (
          <Verdict kind="info">
            Diagnóstico anterior: <strong>{previous.estimate}</strong>. Ahora: <strong>{record.estimate}</strong>.
          </Verdict>
        )}
        <Card>
          <h3>
            <Icon name="check" size={16} /> Fortalezas
          </h3>
          <p>{record.strengths.length ? record.strengths.join(' · ') : 'Todavía por descubrir: ¡para eso es el curso!'}</p>
          <h3>
            <Icon name="target" size={16} /> A reforzar
          </h3>
          <p>{record.weaknesses.length ? record.weaknesses.join(' · ') : 'Ningún área claramente débil.'}</p>
          <h3>Por competencia</h3>
          <ul className="result-list">
            {Object.entries(record.bySkill).map(([k, v]) => (
              <li key={k}>
                <span>{{ listening: 'Escucha', reading: 'Lectura', writing: 'Escritura', grammar: 'Gramática', vocabulary: 'Vocabulario', fluency: 'Producción', speaking: 'Oral' }[k]}</span>
                <strong>{pct(v ?? 0)}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Card tone="soft">
          <h3>Recomendación</h3>
          <p>{start.text}</p>
          <p>
            Primera lección: <strong>{mod.units[0].lessons[0].title}</strong> ({mod.title})
          </p>
        </Card>
        <button className="btn btn--primary btn--block btn--lg" onClick={() => navigate(`#/leccion/${record.startLesson}`)}>
          <Icon name="play" /> Empezar la primera lección
        </button>
        <a className="btn btn--ghost btn--block" href="#/">
          Ir al inicio
        </a>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="stack">
        <PageHeader title="Diagnóstico inicial" subtitle="5–10 minutos · 15 preguntas" back={state.onboarded ? '#/progreso' : undefined} />
        <Card>
          <p>Vamos a estimar tu punto de partida en:</p>
          <ul className="points">
            {Object.values(AREA_LABEL).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="muted small">Hay preguntas abiertas: responde con lo que sepas, sin traductor. Si no sabes algo, pulsa «No lo sé»: es información útil, no un fracaso.</p>
        </Card>
        {previous && <Verdict kind="info">Ya hiciste un diagnóstico ({previous.estimate}). Repetirlo te permite comparar tu evolución.</Verdict>}
        <button className="btn btn--primary btn--block btn--lg" onClick={() => setStarted(true)}>
          Empezar
        </button>
      </div>
    );
  }

  const item = DIAGNOSTIC[i];
  const next = (r: ExerciseResult) => {
    const all = { ...results, [item.ex.id]: r };
    setResults(all);
    act.recordExercise(item.ex, r, 'diagnostic');
    if (i + 1 < DIAGNOSTIC.length) setI(i + 1);
    else finish(all);
  };

  return (
    <div className="player">
      <header className="player__top">
        <a className="icon-btn" href="#/" aria-label="Salir del diagnóstico">
          <Icon name="x" />
        </a>
        <div className="phases" role="progressbar" aria-label="Avance del diagnóstico" aria-valuemin={0} aria-valuemax={DIAGNOSTIC.length} aria-valuenow={i}>
          <span className="phases__seg is-current">
            <span className="phases__fill" style={{ width: `${(i / DIAGNOSTIC.length) * 100}%` }} />
          </span>
        </div>
        <span className="small muted">
          {i + 1}/{DIAGNOSTIC.length}
        </span>
      </header>
      <p className="eyebrow">{AREA_LABEL[item.area]}</p>
      <ExerciseView key={item.ex.id} ex={item.ex} mode="es" onDone={next} doneLabel="Siguiente" />
      <button className="btn btn--ghost btn--block" onClick={() => next({ score: 0, grade: 'fail', given: '', hints: 0, revealed: false, mode: 'text' })}>
        No lo sé — siguiente
      </button>
    </div>
  );
}
