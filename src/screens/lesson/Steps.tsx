import { useEffect, useMemo, useState } from 'react';
import type { Lesson } from '../../types/content';
import type { InstrMode } from '../../engine/instructions';
import { chunkById } from '../../content/course';
import { descriptorById } from '../../content/descriptors';
import { wordCount } from '../../engine/answer';
import { useProgress } from '../../state/ProgressContext';
import { ExerciseView } from '../../components/exercises/ExerciseView';
import type { ExerciseResult } from '../../components/exercises/types';
import { ChunkCard } from '../../components/ChunkCard';
import { Listen, useSpeaker } from '../../components/Audio';
import { VoiceInput } from '../../components/VoiceInput';
import { Icon } from '../../components/Icon';
import { Verdict } from '../../components/ui';
import { ttsAvailable } from '../../speech/tts';

/** Fase 2: primero escuchar sin texto y responder la idea general; después, transcripción y traducción. */
export function ContextStep({ lesson, mode, onRecord, onDone }: { lesson: Lesson; mode: InstrMode; onRecord: (exId: string, r: ExerciseResult) => void; onDone: () => void }) {
  const { play, speaking } = useSpeaker();
  const tts = ttsAvailable();
  const [stage, setStage] = useState<'listen' | 'gist' | 'transcript'>(tts ? 'listen' : 'gist');
  const [gi, setGi] = useState(0);
  const [showEs, setShowEs] = useState<Record<number, boolean>>({});
  const [allEs, setAllEs] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const [listened, setListened] = useState(false);
  const ctx = lesson.context;

  const playAll = async () => {
    setPlayingAll(true);
    for (const l of ctx.lines) {
      // eslint-disable-next-line no-await-in-loop
      await play(l.en);
    }
    setPlayingAll(false);
    setListened(true);
  };

  return (
    <div className="stack">
      <div className="scene">
        <p className="eyebrow">Situación</p>
        <h2>{ctx.title}</h2>
        <p className="muted">{ctx.setting}</p>
      </div>

      {stage === 'listen' && (
        <>
          <p>Escucha la conversación completa <strong>sin leer</strong>. No necesitas entender cada palabra: busca la idea general.</p>
          <button type="button" className="btn btn--primary btn--block" onClick={playAll} disabled={playingAll}>
            <Icon name="play" size={18} /> {playingAll ? 'Reproduciendo…' : listened ? 'Escuchar otra vez' : 'Escuchar la conversación'}
          </button>
          <button type="button" className="btn btn--soft btn--block" onClick={() => setStage('gist')} disabled={!listened}>
            Responder preguntas
          </button>
          {!listened && (
            <button type="button" className="link-btn" onClick={() => setStage('gist')}>
              No puedo escuchar ahora (leer en su lugar)
            </button>
          )}
        </>
      )}

      {stage === 'gist' && (
        <>
          {!tts && <Verdict kind="info">Sin audio disponible: lee la conversación y responde.</Verdict>}
          {(!tts || !listened) && <Transcript lesson={lesson} showEs={{}} toggle={() => undefined} speaking={speaking} play={play} hideTranslation />}
          {listened && (
            <button type="button" className="link-btn" onClick={playAll}>
              <Icon name="play" size={14} /> Volver a escuchar
            </button>
          )}
          <p className="eyebrow">
            Pregunta {gi + 1} de {ctx.gist.length}
          </p>
          <ExerciseView
            key={ctx.gist[gi].id}
            ex={ctx.gist[gi]}
            mode={mode}
            onDone={(r) => {
              onRecord(ctx.gist[gi].id, r);
              if (gi + 1 < ctx.gist.length) setGi(gi + 1);
              else setStage('transcript');
            }}
          />
        </>
      )}

      {stage === 'transcript' && (
        <>
          <div className="row row--between">
            <p className="eyebrow">Transcripción</p>
            <button type="button" className="link-btn" onClick={() => setAllEs((v) => !v)} aria-pressed={allEs}>
              <Icon name="translate" size={14} /> {allEs ? 'Ocultar traducción' : 'Traducir todo'}
            </button>
          </div>
          <Transcript
            lesson={lesson}
            showEs={allEs ? Object.fromEntries(ctx.lines.map((_, i) => [i, true])) : showEs}
            toggle={(i) => setShowEs((s) => ({ ...s, [i]: !s[i] }))}
            speaking={speaking}
            play={play}
          />
          {ctx.highlights && (
            <div className="highlights">
              <p className="eyebrow">Expresiones clave</p>
              <ul lang="en">
                {ctx.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" className="btn btn--primary btn--block" onClick={onDone}>
            Continuar <Icon name="arrowRight" size={18} />
          </button>
        </>
      )}
    </div>
  );
}

function Transcript({
  lesson,
  showEs,
  toggle,
  play,
  speaking,
  hideTranslation,
}: {
  lesson: Lesson;
  showEs: Record<number, boolean>;
  toggle: (i: number) => void;
  play: (t: string, slow?: boolean) => void;
  speaking: string | null;
  hideTranslation?: boolean;
}) {
  const speakers = [...new Set(lesson.context.lines.map((l) => l.who))];
  return (
    <ol className="dialogue">
      {lesson.context.lines.map((l, i) => (
        <li key={i} className={`bubble ${speakers.indexOf(l.who) % 2 ? 'bubble--right' : ''} ${speaking === l.en ? 'is-speaking' : ''}`}>
          <span className="bubble__who">{l.who}</span>
          <p lang="en">{l.en}</p>
          {showEs[i] && <p className="bubble__es">{l.es}</p>}
          <div className="bubble__tools">
            {ttsAvailable() && (
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => play(l.en)} aria-label={`Escuchar: ${l.en}`}>
                <Icon name="play" size={14} />
              </button>
            )}
            {!hideTranslation && (
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => toggle(i)} aria-label="Traducción de esta línea" aria-pressed={!!showEs[i]}>
                <Icon name="translate" size={14} />
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function GrammarStep({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const g = lesson.grammar!;
  return (
    <div className="stack">
      <div className="card card--soft">
        <p className="eyebrow">Estructura</p>
        <h2>{g.title}</h2>
        <ul className="points">
          {g.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <ul className="examples">
          {g.examples.map((e) => (
            <li key={e.en}>
              <span lang="en">{e.en}</span> <Listen text={e.en} compact slow={false} />
              <span className="muted">{e.es}</span>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="btn btn--primary btn--block" onClick={onDone}>
        Entendido <Icon name="arrowRight" size={18} />
      </button>
    </div>
  );
}

/** Fase 3: presentar un chunk y pedir repetirlo en voz alta. */
export function TeachStep({ chunkId, index, total, onDone }: { chunkId: string; index: number; total: number; onDone: () => void }) {
  const { act } = useProgress();
  const c = chunkById.get(chunkId)!;
  useEffect(() => {
    act.introduce([chunkId]);
  }, [act, chunkId]);
  return (
    <div className="stack">
      <p className="eyebrow">
        Expresión {index} de {total}
      </p>
      <ChunkCard c={c} />
      <div className="card card--soft">
        <p>
          <Icon name="mic" size={16} /> Escúchala y <strong>repítela en voz alta</strong> dos veces, con tu propio ejemplo.
        </p>
        <p className="muted small">Tarea: {c.task}</p>
      </div>
      <button type="button" className="btn btn--primary btn--block" onClick={onDone}>
        La repetí — continuar <Icon name="arrowRight" size={18} />
      </button>
    </div>
  );
}

/** Pequeña victoria comunicativa: expresar algo útil sin guion. */
export function VictoryStep({ lesson, onDone }: { lesson: Lesson; onDone: (grade: 'spontaneous' | 'hinted' | 'fail', score: number) => void }) {
  const { act } = useProgress();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [found, setFound] = useState<string[] | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [tries, setTries] = useState(0);
  const targets = lesson.victory.targets.map((id) => chunkById.get(id)!).filter(Boolean);

  const submit = () => {
    const ids = act.recordFreeText(`${lesson.id}.victory`, text, {
      targets: lesson.victory.targets,
      helped: showModel,
      ctx: 'victory',
      prompt: lesson.victory.prompt,
      mode,
    });
    setFound(ids);
    setTries((t) => t + 1);
  };

  const usedTargets = found ? targets.filter((c) => found.includes(c.id)) : [];
  const success = found && (usedTargets.length > 0 || wordCount(text) >= 8);

  return (
    <div className="stack">
      <div className="victory">
        <Icon name="trophy" size={32} />
        <h2>Tu victoria de hoy</h2>
        <p>{lesson.victory.prompt}</p>
        <p className="muted small">Sin mirar notas. Hablando (si tu navegador lo permite) o escribiendo.</p>
      </div>
      {!found || (!success && tries < 2) ? (
        <>
          {found && !success && <Verdict kind="close">Casi. Intenta incluir una de las expresiones de hoy y algún detalle más.</Verdict>}
          <textarea className="input input--tall" rows={3} lang="en" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tu respuesta en inglés…" aria-label="Tu respuesta" autoCorrect="off" spellCheck={false} />
          <div className="row row--between">
            <VoiceInput
              onText={(t) => {
                setText((p) => (p ? p + ' ' : '') + t);
                setMode('voice');
              }}
            />
            <button type="button" className="btn btn--primary" onClick={submit} disabled={wordCount(text) < 2}>
              Enviar
            </button>
          </div>
          {tries > 0 && !showModel && (
            <button type="button" className="link-btn" onClick={() => setShowModel(true)}>
              Ver un ejemplo
            </button>
          )}
          {showModel && (
            <p className="reveal__text" lang="en">
              {lesson.victory.model}
            </p>
          )}
        </>
      ) : (
        <>
          <blockquote className="your-answer" lang="en">{text}</blockquote>
          <Verdict kind={success ? 'ok' : 'info'}>
            {success ? (
              <>
                <strong>¡Lo dijiste por tu cuenta!</strong>{' '}
                {usedTargets.length > 0 && <span>Usaste: {usedTargets.map((c) => c.en).join(' · ')}.</span>}
              </>
            ) : (
              <>Has avanzado. Esta victoria la retomaremos en el próximo repaso.</>
            )}
          </Verdict>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => onDone(success ? (showModel ? 'hinted' : 'spontaneous') : 'fail', success ? (showModel ? 0.6 : 1) : 0.3)}
          >
            Ver resumen <Icon name="arrowRight" size={18} />
          </button>
        </>
      )}
    </div>
  );
}

export function PhaseIntro({ title, titleEn, minutes, intro }: { title: string; titleEn: string; minutes: number; intro: string }) {
  return (
    <div className="phase-intro">
      <p className="eyebrow">
        {titleEn} · ~{minutes} min
      </p>
      <h2>{title}</h2>
      <p className="muted">{intro}</p>
    </div>
  );
}

export function DescriptorList({ ids }: { ids: string[] }) {
  const list = useMemo(() => ids.map((id) => descriptorById.get(id)).filter((d) => !!d), [ids]);
  if (!list.length) return null;
  return (
    <ul className="descriptors">
      {list.map((d) => (
        <li key={d.id}>
          <span className="chip chip--muted">{d.level}</span> {d.text}
        </li>
      ))}
    </ul>
  );
}
