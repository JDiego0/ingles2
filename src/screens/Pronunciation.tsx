import { useMemo, useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { MINIMAL_PAIRS, RHYTHM } from '../content/pronunciation';
import { CHUNKS, chunkById } from '../content/course';
import { speak, ttsAvailable } from '../speech/tts';
import { shuffle } from '../utils/random';
import { ExerciseView } from '../components/exercises/ExerciseView';
import { Icon } from '../components/Icon';
import { Card, PageHeader, Verdict } from '../components/ui';
import { Listen, NoTtsNotice } from '../components/Audio';
import type { ListenExercise, MinimalPairSet, SpeakExercise } from '../types/content';

type Tab = 'pairs' | 'rhythm' | 'dictation';

export function PronunciationScreen() {
  const [tab, setTab] = useState<Tab>('pairs');
  return (
    <div className="stack">
      <PageHeader title="Pronunciación y escucha" subtitle="Inglés estadounidense. El objetivo es que te entiendan, no sonar nativo." back="#/practicar" />
      <NoTtsNotice />
      <div className="tabs" role="tablist">
        {(
          [
            ['pairs', 'Sonidos'],
            ['rhythm', 'Ritmo'],
            ['dictation', 'Dictado'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'pairs' && <Pairs />}
      {tab === 'rhythm' && <Rhythm />}
      {tab === 'dictation' && <Dictation />}
    </div>
  );
}

function Pairs() {
  const [set, setSet] = useState<MinimalPairSet | null>(null);
  if (set) return <PairGame set={set} onExit={() => setSet(null)} />;
  return (
    <ul className="card-list">
      {MINIMAL_PAIRS.map((p) => (
        <li key={p.id}>
          <button className="conv-item" onClick={() => setSet(p)}>
            <div>
              <strong lang="en">{p.title}</strong>
              <span className="muted small">{p.sound}</span>
            </div>
            <Icon name="arrowRight" size={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Identificación de palabras: suena una palabra del par y eliges cuál fue. */
function PairGame({ set, onExit }: { set: MinimalPairSet; onExit: () => void }) {
  const { state, act } = useProgress();
  const rounds = useMemo(() => shuffle([...set.pairs, ...set.pairs]).slice(0, 8).map(([a, b]) => ({ pair: [a, b] as [string, string], target: Math.random() < 0.5 ? a : b })), [set]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const tts = ttsAvailable();
  const opts = { rate: state.settings.rate, voiceURI: state.settings.voiceURI };

  const header = (
    <Card tone="soft">
      <h2 lang="en">{set.title}</h2>
      <p className="eyebrow">{set.sound}</p>
      <p>{set.tip}</p>
      <ul className="pair-list" lang="en">
        {set.pairs.map(([a, b]) => (
          <li key={a}>
            <Listen text={a} label={a} slow={false} /> <Listen text={b} label={b} slow={false} />
          </li>
        ))}
      </ul>
    </Card>
  );

  if (!tts) {
    return (
      <div className="stack">
        {header}
        <Verdict kind="info">Sin síntesis de voz no podemos reproducir los sonidos. Alternativa: lee cada par en voz alta exagerando la diferencia, y practica estas frases:</Verdict>
        <ul className="examples" lang="en">
          {set.sentences.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <button className="btn btn--ghost" onClick={onExit}>
          Volver
        </button>
      </div>
    );
  }

  if (i >= rounds.length) {
    return (
      <div className="stack">
        <div className="victory">
          <Icon name="ear" size={32} />
          <h2>
            {score}/{rounds.length} sonidos identificados
          </h2>
          <p className="muted">Repite las frases en voz alta exagerando el sonido:</p>
        </div>
        {set.sentences.map((s) => (
          <ExerciseView
            key={s}
            ex={{ kind: 'speak', id: `pron.${set.id}.${s}`, prompt: 'Escucha y repite.', text: s, skills: ['speaking'] } satisfies SpeakExercise}
            mode="es"
            onDone={() => undefined}
            doneLabel="Hecho"
          />
        ))}
        <button className="btn btn--primary btn--block" onClick={onExit}>
          Otros sonidos
        </button>
      </div>
    );
  }

  const r = rounds[i];
  return (
    <div className="stack">
      {i === 0 && header}
      <p className="eyebrow">
        Ronda {i + 1} de {rounds.length}
      </p>
      <div className="listen-big">
        <button className="btn btn--primary btn--round" onClick={() => speak(r.target, opts)} aria-label="Escuchar la palabra">
          <Icon name="play" size={28} />
        </button>
        <p className="muted small">¿Qué palabra escuchaste?</p>
      </div>
      <div className="options options--two" lang="en">
        {r.pair.map((w) => (
          <button
            key={w}
            className={`option ${picked ? (w === r.target ? 'option--ok' : w === picked ? 'option--bad' : 'option--dim') : ''}`}
            disabled={!!picked}
            onClick={() => {
              setPicked(w);
              const ok = w === r.target;
              if (ok) setScore((s) => s + 1);
            }}
          >
            {w}
            {picked && w === r.target && <Icon name="check" size={16} label="correcta" />}
          </button>
        ))}
      </div>
      {picked && (
        <>
          <Verdict kind={picked === r.target ? 'ok' : 'bad'}>
            {picked === r.target ? '¡Bien!' : `Era «${r.target}».`} Escucha las dos otra vez y compáralas.
          </Verdict>
          <div className="row">
            <Listen text={r.pair[0]} label={r.pair[0]} slow={false} />
            <Listen text={r.pair[1]} label={r.pair[1]} slow={false} />
          </div>
          <button
            className="btn btn--primary btn--block"
            onClick={() => {
              act.recordExercise(
                { kind: 'choice', id: `pron.${set.id}`, prompt: '', options: r.pair, answer: 0, skills: ['listening'] },
                { score: picked === r.target ? 1 : 0, grade: picked === r.target ? 'unaided' : 'fail', given: picked, hints: 0, revealed: false, mode: 'choice' },
                'pronunciation',
              );
              setPicked(null);
              setI(i + 1);
            }}
          >
            Siguiente <Icon name="arrowRight" size={18} />
          </button>
        </>
      )}
    </div>
  );
}

function Rhythm() {
  const [i, setI] = useState<number | null>(null);
  if (i !== null) {
    const item = RHYTHM[i];
    const ex: SpeakExercise = { kind: 'speak', id: `rhythm.${i}`, prompt: 'Escucha, fíjate en el ritmo y repite.', text: item.text, focus: item.focus, skills: ['speaking'] };
    return (
      <div className="stack">
        <ExerciseView key={i} ex={ex} mode="es" doneLabel={i + 1 < RHYTHM.length ? 'Siguiente' : 'Terminar'} onDone={() => setI(i + 1 < RHYTHM.length ? i + 1 : null)} />
        <button className="btn btn--ghost" onClick={() => setI(null)}>
          Volver a la lista
        </button>
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="muted">Contracciones, palabras débiles y acento: lo que más cambia entre el inglés escrito y el hablado.</p>
      <ul className="card-list">
        {RHYTHM.map((r, k) => (
          <li key={r.text}>
            <button className="conv-item" onClick={() => setI(k)}>
              <div>
                <strong lang="en">{r.text}</strong>
                <span className="muted small">{r.focus}</span>
              </div>
              <Icon name="mic" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dictados breves con frases de expresiones que ya estudiaste (o del nivel A1 si aún no hay). */
function Dictation() {
  const { state, act } = useProgress();
  const pool = useMemo(() => {
    const known = Object.keys(state.chunks).map((id) => chunkById.get(id)).filter((c) => !!c);
    const base = known.length >= 5 ? known : CHUNKS.filter((c) => c.level === 'A1');
    return shuffle(base).slice(0, 5);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  if (i >= pool.length) {
    return (
      <div className="stack">
        <Verdict kind="ok">Dictado terminado. Cada dictado usa frases distintas.</Verdict>
        <button className="btn btn--primary" onClick={() => setI(0)}>
          Otra vez
        </button>
      </div>
    );
  }
  const c = pool[i];
  const ex: ListenExercise = { kind: 'listen', id: `dict.${c.id}`, prompt: `Dictado ${i + 1} de ${pool.length}: escucha y escribe.`, text: c.example.en, skills: ['listening', 'writing'], chunks: [c.id] };
  return (
    <ExerciseView
      key={ex.id}
      ex={ex}
      mode="es"
      onDone={(r) => {
        act.recordExercise(ex, r, 'review');
        setI(i + 1);
      }}
    />
  );
}

