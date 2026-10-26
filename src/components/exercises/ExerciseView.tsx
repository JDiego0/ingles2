import { useMemo, useState } from 'react';
import type { ChoiceExercise, Exercise, ListenExercise, OrderExercise, SpeakExercise, TypeExercise } from '../../types/content';
import { checkAnswer, wordOverlap } from '../../engine/answer';
import { seededShuffle } from '../../utils/random';
import { ttsAvailable } from '../../speech/tts';
import { Icon } from '../Icon';
import { Verdict } from '../ui';
import { AudioFailed, Listen, useSpeaker } from '../Audio';
import { SelfRecorder, VoiceInput, speechInputAvailable } from '../VoiceInput';
import { AnswerFlow } from './AnswerFlow';
import { OpenView } from './OpenView';
import { Prompt } from './Prompt';
import type { ExerciseProps } from './types';
import { soundError, soundSuccess } from '../../speech/sounds';

/** Muestra un ejercicio de cualquier tipo. */
export function ExerciseView(props: ExerciseProps) {
  const { ex } = props;
  switch (ex.kind) {
    case 'type':
      return <TypeView {...props} ex={ex} />;
    case 'choice':
      return <ChoiceView {...props} ex={ex} />;
    case 'order':
      return <OrderView {...props} ex={ex} />;
    case 'listen':
      return <ListenView {...props} ex={ex} />;
    case 'open':
      return <OpenView {...props} ex={ex} />;
    case 'speak':
      return <SpeakView {...props} ex={ex} />;
  }
}

/** Para que React reinicie el estado interno al cambiar de ejercicio. */
export const exerciseKey = (ex: Exercise) => ex.id;

function TypeView({ ex, mode, onDone, doneLabel }: ExerciseProps<TypeExercise>) {
  return (
    <div className="exercise">
      <Prompt instr={ex.prompt} mode={mode} />
      {ex.context && (
        <p className="context-line" lang="en">
          {ex.context}
        </p>
      )}
      <AnswerFlow accept={ex.accept} keys={ex.keys} anyOf={ex.anyOf} hint={ex.hint} explain={ex.explain} onDone={onDone} doneLabel={doneLabel} />
    </div>
  );
}

function ListenView({ ex, mode, onDone, doneLabel }: ExerciseProps<ListenExercise>) {
  const { play, failed } = useSpeaker();
  const tts = ttsAvailable() && !failed;
  return (
    <div className="exercise">
      <Prompt instr={ex.prompt} mode={mode} />
      {failed && <AudioFailed />}
      {tts ? (
        <div className="listen-big">
          <button type="button" className="btn btn--primary btn--round" onClick={() => play(ex.text)} aria-label="Escuchar la frase">
            <Icon name="play" size={28} />
          </button>
          <button type="button" className="btn btn--soft" onClick={() => play(ex.text, true)}>
            <Icon name="slow" size={16} /> Despacio
          </button>
          <p className="muted small">Puedes escucharla las veces que necesites.</p>
        </div>
      ) : (
        <Verdict kind="info">
          Sin audio en este navegador. Ejercicio alternativo: completa y escribe la frase completa.
          <p className="context-line" lang="en">{ex.fallbackGap ?? ex.text.replace(/\b(\w{4,})\b/g, (w, _a, i) => (i % 3 === 0 ? '___' : w))}</p>
        </Verdict>
      )}
      <AnswerFlow accept={ex.accept ?? [ex.text]} onDone={onDone} doneLabel={doneLabel} placeholder="Escribe lo que escuchas…" />
    </div>
  );
}

function ChoiceView({ ex, mode, onDone, doneLabel = 'Continuar' }: ExerciseProps<ChoiceExercise>) {
  const [picked, setPicked] = useState<number | null>(null);
  const [showText, setShowText] = useState(!ex.audio || !ttsAvailable());
  const options = useMemo(() => seededShuffle(ex.options.map((o, i) => ({ o, i })), ex.id), [ex]);
  const correct = picked === ex.answer;
  return (
    <div className="exercise">
      <Prompt instr={ex.prompt} mode={mode} />
      {ex.context && ex.audio && ttsAvailable() && <Listen text={ex.context} label="Escuchar" />}
      {ex.context && showText && (
        <p className="context-line" lang="en">
          {ex.context}
        </p>
      )}
      {ex.context && !showText && picked !== null && (
        <button type="button" className="link-btn" onClick={() => setShowText(true)}>
          Ver el texto
        </button>
      )}
      <div className="options" role="group" aria-label="Opciones">
        {options.map(({ o, i }) => {
          const state = picked === null ? '' : i === ex.answer ? 'option--ok' : i === picked ? 'option--bad' : 'option--dim';
          return (
            <button key={i} type="button" className={`option ${state}`} disabled={picked !== null} onClick={() => {
              setPicked(i);
              (i === ex.answer ? soundSuccess : soundError)();
            }} lang={/[a-z]{3,}/i.test(o) && !/[áéíóúñ¿¡]/i.test(o) ? 'en' : 'es'}>
              <span>{o}</span>
              {picked !== null && i === ex.answer && <Icon name="check" size={18} label="correcta" />}
              {picked === i && i !== ex.answer && <Icon name="x" size={18} label="tu elección, incorrecta" />}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <Verdict kind={correct ? 'ok' : 'bad'}>
            <strong>{correct ? '¡Correcto!' : 'No es esa.'}</strong> {ex.explain}
          </Verdict>
          <button
            type="button"
            className="btn btn--primary btn--block"
            autoFocus
            onClick={() => onDone({ score: correct ? 1 : 0, grade: correct ? 'recognized' : 'fail', given: ex.options[picked], hints: 0, revealed: false, mode: 'choice' })}
          >
            {doneLabel} <Icon name="arrowRight" size={18} />
          </button>
        </>
      )}
    </div>
  );
}

function OrderView({ ex, mode, onDone, doneLabel = 'Continuar' }: ExerciseProps<OrderExercise>) {
  const words = useMemo(() => ex.sentence.split(/\s+/), [ex.sentence]);
  const shuffled = useMemo(() => {
    let s = seededShuffle(words.map((w, i) => ({ w, i })), ex.id);
    if (s.every((x, k) => x.i === k) && s.length > 1) s = [...s.slice(1), s[0]];
    return s;
  }, [words, ex.id]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [hints, setHints] = useState(0);
  const [status, setStatus] = useState<'idle' | 'bad' | 'ok' | 'revealed'>('idle');
  const [wasRevealed, setWasRevealed] = useState(false);
  const tts = ttsAvailable();
  const answer = chosen.map((k) => shuffled[k].w).join(' ');

  const check = () => {
    const res = checkAnswer(answer, [ex.sentence, ...(ex.accept ?? [])]);
    setStatus(res.result === 'correct' ? 'ok' : 'bad');
    (res.result === 'correct' ? soundSuccess : soundError)();
  };

  const hint = () => {
    if (hints >= 2) {
      setWasRevealed(true);
      setStatus('revealed');
      return;
    }
    // Coloca las primeras palabras correctas (una más por cada pista).
    const placed: number[] = [];
    for (let i = 0; i < Math.min(hints + 1, words.length); i++) {
      placed.push(shuffled.findIndex((x, idx) => x.w === words[i] && !placed.includes(idx)));
    }
    setChosen(placed);
    setHints((h) => h + 1);
    setStatus('idle');
  };

  return (
    <div className="exercise">
      <Prompt instr={ex.prompt} mode={mode} />
      {ex.audio && tts && <Listen text={ex.sentence} />}
      {ex.audio && !tts && <p className="muted small">Sin audio disponible: ordena la frase leyendo las palabras.</p>}
      {status === 'revealed' ? (
        <div className="reveal">
          <p className="reveal__text" lang="en">{ex.sentence}</p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => {
              setChosen([]);
              setStatus('idle');
            }}
          >
            Ocultarla y ordenarla de nuevo
          </button>
        </div>
      ) : (
        <>
          <div className={`order-line ${status === 'bad' ? 'order-line--bad' : status === 'ok' ? 'order-line--ok' : ''}`} aria-label="Tu frase" lang="en">
            {chosen.length === 0 && <span className="muted">Toca las palabras en orden…</span>}
            {chosen.map((k, pos) => (
              <button key={pos} type="button" className="tile tile--placed" disabled={status === 'ok'} onClick={() => setChosen(chosen.filter((_, p) => p !== pos))} aria-label={`Quitar ${shuffled[k].w}`}>
                {shuffled[k].w}
              </button>
            ))}
          </div>
          <div className="tiles" lang="en">
            {shuffled.map((x, k) =>
              chosen.includes(k) ? (
                <span key={k} className="tile tile--ghost" aria-hidden="true">{x.w}</span>
              ) : (
                <button key={k} type="button" className="tile" disabled={status === 'ok'} onClick={() => setChosen([...chosen, k])}>
                  {x.w}
                </button>
              ),
            )}
          </div>
        </>
      )}
      {status === 'bad' && <Verdict kind="bad">Todavía no. Cambia el orden o pide una pista.</Verdict>}
      {status === 'ok' && <Verdict kind="ok">¡Correcto!</Verdict>}
      {status !== 'ok' && status !== 'revealed' && (
        <div className="row">
          <button type="button" className="btn btn--primary grow" disabled={chosen.length !== words.length} onClick={check}>
            <Icon name="check" size={18} /> Comprobar
          </button>
          <button type="button" className="btn btn--ghost" onClick={hint}>
            <Icon name="bulb" size={16} /> {hints >= 2 ? 'Ver' : 'Pista'}
          </button>
        </div>
      )}
      {status === 'ok' && (
        <button
          type="button"
          className="btn btn--primary btn--block"
          autoFocus
          onClick={() =>
            onDone({
              score: wasRevealed ? 0 : hints === 0 ? 1 : hints === 1 ? 0.6 : 0.4,
              grade: wasRevealed ? 'fail' : hints ? 'hinted' : 'unaided',
              given: answer,
              hints,
              revealed: wasRevealed,
              mode: 'text',
            })
          }
        >
          {doneLabel} <Icon name="arrowRight" size={18} />
        </button>
      )}
    </div>
  );
}

function SpeakView({ ex, mode, onDone, doneLabel = 'Continuar' }: ExerciseProps<SpeakExercise>) {
  const [transcript, setTranscript] = useState('');
  const sr = speechInputAvailable();
  const overlap = transcript ? wordOverlap(transcript, ex.text) : 0;
  return (
    <div className="exercise">
      <Prompt instr={ex.prompt} mode={mode} />
      <p className="speak-target" lang="en">{ex.text}</p>
      <Listen text={ex.text} />
      {ex.focus && (
        <p className="hint">
          <Icon name="bulb" size={16} /> {ex.focus}
        </p>
      )}
      {sr ? (
        <VoiceInput
          onText={(t) => {
            setTranscript(t);
            if (wordOverlap(t, ex.text) >= 0.8) soundSuccess();
          }}
        />
      ) : (
        <SelfRecorder />
      )}
      {transcript && (
        <Verdict kind={overlap >= 0.8 ? 'ok' : 'info'}>
          <p>
            El reconocedor entendió: «<span lang="en">{transcript}</span>» ({Math.round(overlap * 100)} % de las palabras).
          </p>
          <p className="muted small">Esto indica qué palabras se reconocieron, no evalúa tu pronunciación en detalle. Escucha el modelo y compárate.</p>
        </Verdict>
      )}
      <div className="row">
        {transcript ? (
          <button
            type="button"
            className="btn btn--primary grow"
            onClick={() => onDone({ score: overlap, grade: overlap >= 0.8 ? 'unaided' : 'hinted', given: transcript, hints: 0, revealed: false, mode: 'voice' })}
          >
            {doneLabel} <Icon name="arrowRight" size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--soft grow"
            onClick={() => onDone({ score: 1, grade: 'recognized', given: '', hints: 0, revealed: false, mode: 'self' })}
          >
            <Icon name="check" size={16} /> Lo repetí en voz alta
          </button>
        )}
      </div>
    </div>
  );
}
