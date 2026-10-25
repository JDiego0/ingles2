import { useEffect, useRef, useState, type ReactNode } from 'react';
import { checkAnswer, diffWords, firstLetters, halfReveal } from '../../engine/answer';
import { gradeFrom } from '../../engine/srs';
import { Icon } from '../Icon';
import { Verdict } from '../ui';
import { Listen } from '../Audio';
import { VoiceInput } from '../VoiceInput';
import { scoreFor, type ExerciseResult } from './types';

interface Props {
  accept: string[];
  keys?: string[];
  anyOf?: string[];
  hint?: string;
  explain?: string;
  onDone: (r: ExerciseResult) => void;
  doneLabel?: string;
  placeholder?: string;
  /** Mostrar el botón de micrófono. */
  voice?: boolean;
}

/** Modelo legible a partir de las respuestas aceptadas. */
export function modelOf(accept: string[]): string {
  const plain = accept.find((a) => !/[*#{}()]/.test(a));
  if (plain) return plain;
  return accept[0]
    .replace(/\{([^|}]*)[^}]*\}/g, '$1')
    .replace(/\(([^)]*)\)/g, '$1')
    .replace(/\s*\*\s*/g, ' … ')
    .replace(/#/g, '…')
    .trim();
}

type Phase = 'answer' | 'done' | 'revealed' | 'retype';

/**
 * Respuesta escrita (o dictada) con escalera de ayuda:
 * 1) intentar · 2) pista pequeña · 3) ayuda mayor · 4) ver modelo · 5) escribirla de nuevo sin verla.
 */
export function AnswerFlow({ accept, keys, anyOf, hint, explain, onDone, doneLabel = 'Continuar', placeholder = 'Escribe en inglés…', voice = true }: Props) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('answer');
  const [hints, setHints] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<ReactNode>(null);
  const [revealed, setRevealed] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [canHint, setCanHint] = useState(false);
  const [result, setResult] = useState<ExerciseResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const model = modelOf(accept);

  // Espera a que el estudiante lo intente: la ayuda aparece tras un intento o 12 segundos.
  useEffect(() => {
    const id = setTimeout(() => setCanHint(true), 12_000);
    return () => clearTimeout(id);
  }, []);

  const finish = (r: ExerciseResult) => {
    setResult(r);
    setPhase('done');
  };

  const check = () => {
    const given = text.trim();
    if (!given) {
      inputRef.current?.focus();
      return;
    }
    const res = checkAnswer(given, accept, keys, anyOf);
    setAttempts((a) => a + 1);
    setCanHint(true);
    if (phase === 'retype') {
      if (res.result !== 'wrong') {
        setFeedback(<Verdict kind="ok">¡Bien! Ahora la recuperaste sin verla. La repasaremos pronto para fijarla.</Verdict>);
        finish({ score: 0, grade: 'fail', given, hints, revealed: true, mode: usedVoice ? 'voice' : 'text' });
      } else {
        setFeedback(<Verdict kind="bad">Todavía no. Mírala otra vez y vuelve a intentarlo.</Verdict>);
        setPhase('revealed');
      }
      return;
    }
    if (res.result === 'correct' || res.result === 'close') {
      const close = res.result === 'close';
      const score = scoreFor(hints, false, close);
      const grade = gradeFrom({ correct: true, hints, revealed: false });
      setFeedback(
        <Verdict kind={close ? 'close' : 'ok'}>
          <strong>{close ? 'Correcto, con un detalle de escritura' : hints ? 'Correcto, con ayuda' : '¡Correcto!'}</strong>
          {close && (
            <p>
              Forma exacta: <span lang="en">{res.target}</span>
            </p>
          )}
          {!close && model && normalizeLoose(given) !== normalizeLoose(model) && (
            <p className="muted">
              Otra forma posible: <span lang="en">{model}</span>
            </p>
          )}
          {explain && <p className="muted">{explain}</p>}
        </Verdict>,
      );
      finish({ score, grade, given, hints, revealed: false, mode: usedVoice ? 'voice' : 'text' });
      return;
    }
    const diff = anyOf ? null : diffWords(given, res.target);
    setFeedback(
      <Verdict kind="bad">
        <strong>Todavía no.</strong>{' '}
        {anyOf ? 'Tu respuesta no usa la expresión que buscamos. ' : 'Revisa las palabras marcadas. '}
        {hints < 2 ? 'Inténtalo otra vez o pide una pista.' : 'Puedes ver la respuesta.'}
        {diff && attempts >= 1 && (
          <p className="diff" aria-label="Comparación">
            {diff.map((w, i) =>
              w.status === 'ok' ? (
                <span key={i}>{w.word} </span>
              ) : w.status === 'extra' ? (
                <del key={i} title="sobra o está mal">{w.word} </del>
              ) : (
                <ins key={i} title="falta">
                  {'_'.repeat(Math.min(w.word.length, 6))}{' '}
                </ins>
              ),
            )}
          </p>
        )}
      </Verdict>,
    );
  };

  const nextHint = () => {
    if (hints < 2) {
      setHints((h) => h + 1);
      setCanHint(true);
      return;
    }
    setRevealed(true);
    setPhase('revealed');
    setFeedback(null);
  };

  const hintText = hints >= 1 ? (hints === 1 ? hint ?? firstLetters(model) : halfReveal(model)) : null;

  if (phase === 'revealed') {
    return (
      <div className="answer">
        {feedback}
        <div className="reveal">
          <p className="muted small">Respuesta modelo:</p>
          <p className="reveal__text" lang="en">{model}</p>
          {model.includes('…') && <p className="small">Completa «…» con tus propios datos (por ejemplo, tu nombre o tu ciudad).</p>}
          <Listen text={model.replace(/…/g, '')} />
          {explain && <p className="muted small">{explain}</p>}
        </div>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => {
            setText('');
            setFeedback(null);
            setPhase('retype');
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        >
          Ya la tengo: ocultarla y escribirla
        </button>
      </div>
    );
  }

  return (
    <div className="answer">
      {phase === 'retype' && <Verdict kind="info">Ahora escríbela (o dila) sin mirarla.</Verdict>}
      {hintText && phase === 'answer' && (
        <p className="hint" lang="en">
          <Icon name="bulb" size={16} /> {hintText}
        </p>
      )}
      <label className="sr-only" htmlFor="answer-input">Tu respuesta</label>
      <textarea
        id="answer-input"
        ref={inputRef}
        className="input"
        rows={2}
        lang="en"
        value={text}
        placeholder={placeholder}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        readOnly={phase === 'done'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && phase !== 'done') {
            e.preventDefault();
            check();
          }
        }}
      />
      {phase !== 'done' && (
        <div className="row">
          <button type="button" className="btn btn--primary grow" onClick={check} disabled={!text.trim()}>
            <Icon name="check" size={18} /> Comprobar
          </button>
          {voice && (
            <VoiceInput
              compact
              onText={(t) => {
                setText(t);
                setUsedVoice(true);
              }}
            />
          )}
        </div>
      )}
      {feedback}
      {phase === 'answer' && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={nextHint} disabled={!canHint}>
          <Icon name={hints < 2 ? 'bulb' : 'eye'} size={16} />
          {hints === 0 ? (canHint ? 'Pista pequeña' : 'Primero inténtalo…') : hints === 1 ? 'Más ayuda' : 'Ver la respuesta'}
        </button>
      )}
      {phase === 'done' && result && (
        <button type="button" className="btn btn--primary btn--block" onClick={() => onDone(result)} autoFocus>
          {doneLabel} <Icon name="arrowRight" size={18} />
        </button>
      )}
      {revealed && phase === 'done' && <p className="muted small">Esta expresión volverá pronto a tus repasos.</p>}
    </div>
  );
}

const normalizeLoose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
