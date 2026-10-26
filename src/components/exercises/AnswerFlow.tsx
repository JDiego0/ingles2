import { useEffect, useRef, useState, type ReactNode } from 'react';
import { checkAnswer, diffWords, firstLetters, halfReveal } from '../../engine/answer';
import { gradeFrom } from '../../engine/srs';
import { Icon } from '../Icon';
import { Verdict } from '../ui';
import { Listen } from '../Audio';
import { VoiceInput, speechInputAvailable } from '../VoiceInput';
import { soundClose, soundError, soundSuccess } from '../../speech/sounds';
import { useProgress } from '../../state/ProgressContext';
import { WordBank } from './WordBank';
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
type Method = 'voice' | 'tiles' | 'text';

/** Elige, entre lo que pudo oír el reconocedor, la interpretación que coincide con la respuesta. */
export function pickMatching(alternatives: string[], accept: string[], keys?: string[], anyOf?: string[]): string | undefined {
  return (
    alternatives.find((a) => checkAnswer(a, accept, keys, anyOf).result === 'correct') ??
    alternatives.find((a) => checkAnswer(a, accept, keys, anyOf).result === 'close')
  );
}

/**
 * Respuesta hablada, con bloques o escrita, con escalera de ayuda:
 * 1) intentar · 2) pista pequeña · 3) ayuda mayor · 4) ver modelo · 5) decirla (o formarla) de nuevo sin verla.
 * Por defecto no se usa el teclado (Ajustes → «Responder con el teclado»).
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
  const { state } = useProgress();
  const canVoice = voice && speechInputAvailable();
  /** Lo que entendió el reconocedor; mientras no es null se puede corregir antes de comprobar. */
  const [heard, setHeard] = useState<string | null>(null);
  // Bloques solo si la respuesta es una frase concreta (sin «…» para datos propios).
  const canTiles = !model.includes('…') && model.split(/\s+/).length >= 2;
  const [method, setMethod] = useState<Method>(state.settings.keyboard ? 'text' : canVoice ? 'voice' : canTiles ? 'tiles' : 'text');
  const [tileTry, setTileTry] = useState(0);
  const [tileStatus, setTileStatus] = useState<'bad' | 'ok' | undefined>();

  // Espera a que el estudiante lo intente: la ayuda aparece tras un intento o 12 segundos.
  useEffect(() => {
    const id = setTimeout(() => setCanHint(true), 12_000);
    return () => clearTimeout(id);
  }, []);

  const finish = (r: ExerciseResult) => {
    setResult(r);
    setPhase('done');
  };

  const check = (spoken?: string, via: Method = method) => {
    const given = (spoken ?? text).trim();
    if (!given) {
      inputRef.current?.focus();
      return;
    }
    const tiles = via === 'tiles';
    const mode: ExerciseResult['mode'] = via === 'voice' || usedVoice ? 'voice' : tiles ? 'tiles' : 'text';
    const heard = via === 'voice' ? (
      <p className="small">
        Entendí: «<span lang="en">{given}</span>»
      </p>
    ) : null;
    const res = checkAnswer(given, accept, keys, anyOf);
    setAttempts((a) => a + 1);
    setCanHint(true);
    if (phase === 'retype') {
      if (res.result !== 'wrong') {
        soundSuccess();
        if (tiles) setTileStatus('ok');
        setFeedback(<Verdict kind="ok">{heard}¡Bien! Ahora la recuperaste sin verla. La repasaremos pronto para fijarla.</Verdict>);
        finish({ score: 0, grade: 'fail', given, hints, revealed: true, mode });
      } else {
        soundError();
        setFeedback(<Verdict kind="bad">{heard}Todavía no. Mírala otra vez y vuelve a intentarlo.</Verdict>);
        setPhase('revealed');
      }
      return;
    }
    if (res.result === 'correct' || res.result === 'close') {
      // Con la voz, una diferencia pequeña suele ser del reconocedor, no tuya.
      const close = res.result === 'close' && via !== 'voice';
      // Formar la frase con bloques ayuda (las palabras están a la vista): cuenta como «con pista».
      const score = tiles ? Math.min(0.6, scoreFor(hints, false, close)) : scoreFor(hints, false, close);
      const grade = gradeFrom({ correct: true, hints: tiles ? Math.max(1, hints) : hints, revealed: false });
      if (tiles) setTileStatus('ok');
      (close ? soundClose : soundSuccess)();
      setFeedback(
        <Verdict kind={close ? 'close' : 'ok'}>
          {heard}
          <strong>{close ? 'Correcto, con un detalle de escritura' : hints ? 'Correcto, con ayuda' : '¡Correcto!'}</strong>
          {tiles && !hints && <p className="small muted">La próxima vez intenta decirla sin ver los bloques.</p>}
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
      finish({ score, grade, given, hints, revealed: false, mode });
      return;
    }
    if (tiles) setTileStatus('bad');
    soundError();
    const diff = anyOf ? null : diffWords(given, res.target);
    setFeedback(
      <Verdict kind="bad">
        {heard}
        <strong>Todavía no.</strong>{' '}
        {via === 'voice' && 'Si crees que lo dijiste bien, repítelo más despacio y cerca del micrófono. '}
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
            setHeard(null);
            setFeedback(null);
            setPhase('retype');
            setTileStatus(undefined);
            setTileTry((t) => t + 1);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        >
          {method === 'voice' ? 'Ya la tengo: ocultarla y decirla' : method === 'tiles' ? 'Ya la tengo: ocultarla y formarla' : 'Ya la tengo: ocultarla y escribirla'}
        </button>
      </div>
    );
  }

  const methods: { id: Method; label: string; icon: 'mic' | 'blocks' | 'keyboard' }[] = [
    ...(canVoice ? [{ id: 'voice' as const, label: 'Hablar', icon: 'mic' as const }] : []),
    ...(canTiles ? [{ id: 'tiles' as const, label: 'Bloques', icon: 'blocks' as const }] : []),
    { id: 'text', label: 'Escribir', icon: 'keyboard' },
  ];

  return (
    <div className="answer">
      {phase === 'retype' && <Verdict kind="info">Ahora {method === 'voice' ? 'dila' : method === 'tiles' ? 'fórmala' : 'escríbela'} sin mirarla.</Verdict>}
      {hintText && phase === 'answer' && (
        <p className="hint" lang="en">
          <Icon name="bulb" size={16} /> {hintText}
        </p>
      )}
      {phase !== 'done' && methods.length > 1 && (
        <div className="method-switch" role="group" aria-label="Cómo responder">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`method-switch__btn ${method === m.id ? 'is-active' : ''}`}
              aria-pressed={method === m.id}
              onClick={() => {
                setMethod(m.id);
                setHeard(null);
                setFeedback(null);
                setTileStatus(undefined);
              }}
            >
              <Icon name={m.icon} size={16} /> {m.label}
            </button>
          ))}
        </div>
      )}
      {method === 'voice' && phase !== 'done' && heard === null && (
        <VoiceInput
          big
          label="Responder hablando"
          pick={(alts) => pickMatching(alts, accept, keys, anyOf)}
          hints={accept}
          onText={(t) => {
            setText(t);
            setHeard(t);
            setFeedback(null);
          }}
        />
      )}
      {method === 'voice' && heard !== null && (
        <div className="stack stack--tight">
          {phase !== 'done' && <p className="small muted">Esto entendí. Si alguna palabra quedó mal, tócala y corrígela; luego pulsa «Comprobar».</p>}
          <textarea
            ref={inputRef}
            className="input"
            rows={2}
            lang="en"
            value={text}
            aria-label="Lo que entendí (puedes corregirlo)"
            autoCapitalize="sentences"
            autoCorrect="off"
            spellCheck={false}
            readOnly={phase === 'done'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && phase !== 'done') {
                e.preventDefault();
                check(undefined, 'voice');
              }
            }}
          />
          {phase !== 'done' && (
            <div className="row">
              <button type="button" className="btn btn--primary grow" onClick={() => check(undefined, 'voice')} disabled={!text.trim()}>
                <Icon name="check" size={18} /> Comprobar
              </button>
              <VoiceInput
                compact
                label="Decirlo otra vez"
                pick={(alts) => pickMatching(alts, accept, keys, anyOf)}
                hints={accept}
                onText={(t) => {
                  setText(t);
                  setHeard(t);
                  setFeedback(null);
                }}
              />
            </div>
          )}
        </div>
      )}
      {method === 'tiles' && (
        <WordBank key={tileTry} target={model} seed={model + tileTry} prefix={phase === 'answer' ? hints : 0} status={tileStatus} onSubmit={(t) => check(t, 'tiles')} />
      )}
      {method === 'text' && (
        <>
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
              <button type="button" className="btn btn--primary grow" onClick={() => check()} disabled={!text.trim()}>
                <Icon name="check" size={18} /> Comprobar
              </button>
              {canVoice && (
                <VoiceInput
                  compact
                  pick={(alts) => pickMatching(alts, accept, keys, anyOf)}
                  hints={accept}
                  onText={(t) => {
                    setText(t);
                    setUsedVoice(true);
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
      {feedback}
      {phase === 'answer' && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            nextHint();
            if (method === 'tiles' && hints < 2) setTileTry((t) => t + 1);
          }}
          disabled={!canHint}
        >
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
