import { useState } from 'react';
import type { OpenExercise } from '../../types/content';
import { wordCount, wordOverlap } from '../../engine/answer';
import { detectErrors, topErrors, type DetectedError } from '../../engine/errors';
import { usesChunk } from '../../engine/generate';
import { chunkById } from '../../content/course';
import { Icon } from '../Icon';
import { Verdict } from '../ui';
import { Listen } from '../Audio';
import { VoiceInput } from '../VoiceInput';
import { Prompt } from './Prompt';
import type { ExerciseProps } from './types';

interface Evaluation {
  words: number;
  used: string[];
  missing: string[];
  errors: DetectedError[];
  score: number;
}

export function evaluateOpen(text: string, ex: Pick<OpenExercise, 'minWords' | 'targets'>, helped: number, modelSeen: boolean): Evaluation {
  const words = wordCount(text);
  const targets = (ex.targets ?? []).map((id) => chunkById.get(id)).filter((c) => !!c);
  const used = targets.filter((c) => usesChunk(text, c)).map((c) => c.id);
  const missing = targets.filter((c) => !used.includes(c.id)).map((c) => c.id);
  const errors = topErrors(detectErrors(text), 3);
  const lengthScore = Math.min(1, words / ex.minWords);
  const targetScore = targets.length ? Math.min(1, used.length / Math.min(2, targets.length)) : 1;
  const errorScore = errors.length === 0 ? 1 : errors.length === 1 ? 0.6 : 0.3;
  let score = 0.4 * lengthScore + 0.4 * targetScore + 0.2 * errorScore;
  if (modelSeen) score *= 0.6;
  else if (helped) score *= 0.85;
  return { words, used, missing, errors, score: Math.round(score * 100) / 100 };
}

export function OpenView({ ex, mode, onDone, doneLabel = 'Continuar' }: ExerciseProps<OpenExercise>) {
  const [text, setText] = useState('');
  const [help, setHelp] = useState(0);
  const [showModel, setShowModel] = useState(false);
  const [modelSeen, setModelSeen] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [warning, setWarning] = useState('');
  const [shortOk, setShortOk] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [compare, setCompare] = useState(false);
  const words = wordCount(text);
  const targets = (ex.targets ?? []).map((id) => chunkById.get(id)).filter((c) => !!c);

  const submit = () => {
    setWarning('');
    if (modelSeen && wordOverlap(text, ex.model) > 0.85) {
      setWarning('Tu respuesta es casi igual al modelo. Cámbiala con tus propios datos e ideas.');
      return;
    }
    if (words < ex.minWords && !shortOk) {
      setWarning(`Intenta llegar a ${ex.minWords} palabras (llevas ${words}). Añade un detalle o una razón. Si no puedes, pulsa «Enviar» de nuevo.`);
      setShortOk(true);
      return;
    }
    setEvaluation(evaluateOpen(text, ex, help, modelSeen));
  };

  if (evaluation) {
    const good = evaluation.score >= 0.7;
    return (
      <div className="exercise">
        <Prompt instr={ex.prompt} mode={mode} />
        <blockquote className="your-answer" lang="en">{text}</blockquote>
        <Verdict kind={good ? 'ok' : 'info'}>
          <strong>{good ? '¡Lo expresaste con tus palabras!' : 'Buen intento. Esto es lo que puedes mejorar:'}</strong>
          <ul className="checklist">
            <li className={evaluation.words >= ex.minWords ? 'is-ok' : 'is-miss'}>
              <Icon name={evaluation.words >= ex.minWords ? 'check' : 'x'} size={14} /> {evaluation.words} palabras (objetivo: {ex.minWords})
            </li>
            {targets.length > 0 && (
              <li className={evaluation.used.length ? 'is-ok' : 'is-miss'}>
                <Icon name={evaluation.used.length ? 'check' : 'x'} size={14} />{' '}
                {evaluation.used.length ? `Usaste: ${evaluation.used.map((id) => chunkById.get(id)!.en).join(' · ')}` : `No detectamos: ${targets.map((c) => c.en).join(' · ')}`}
              </li>
            )}
            {help > 0 && (
              <li className="is-miss">
                <Icon name="bulb" size={14} /> Usaste {modelSeen ? 'el modelo' : 'pistas'}: la próxima vez intenta sin ayuda.
              </li>
            )}
          </ul>
        </Verdict>
        {evaluation.errors.length > 0 && (
          <div className="errors-box">
            <h3>Para corregir</h3>
            {evaluation.errors.map((e) => (
              <div key={e.key} className="error-item">
                <p>
                  <del lang="en">{e.found}</del> → <ins lang="en">{e.fix}</ins>
                </p>
                <p className="muted small">{e.why}</p>
              </div>
            ))}
          </div>
        )}
        {ex.criteria && (
          <details className="details">
            <summary>Autoevaluación</summary>
            <ul className="criteria">
              {ex.criteria.map((c) => (
                <li key={c}>
                  <label>
                    <input type="checkbox" /> {c}
                  </label>
                </li>
              ))}
            </ul>
          </details>
        )}
        <button type="button" className="link-btn" onClick={() => setCompare((v) => !v)} aria-expanded={compare}>
          {compare ? 'Ocultar ejemplo' : 'Comparar con un ejemplo'}
        </button>
        {compare && (
          <div className="reveal">
            <p className="reveal__text" lang="en">{ex.model}</p>
            <Listen text={ex.model} />
          </div>
        )}
        <p className="muted small">Revisión automática: comprueba longitud, expresiones del curso y algunos errores frecuentes. No sustituye a la corrección de un profesor.</p>
        <button
          type="button"
          className="btn btn--primary btn--block"
          autoFocus
          onClick={() =>
            onDone({
              score: evaluation.score,
              grade: modelSeen ? 'fail' : help ? 'hinted' : 'spontaneous',
              given: text,
              hints: help,
              revealed: modelSeen,
              mode: usedVoice ? 'voice' : 'text',
            })
          }
        >
          {doneLabel} <Icon name="arrowRight" size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="exercise">
      <Prompt instr={ex.prompt} mode={mode} />
      {ex.question && (
        <div className="question-bubble">
          <p lang="en">{ex.question}</p>
          <Listen text={ex.question} compact />
        </div>
      )}
      {help >= 1 && (
        <div className="help-box">
          {ex.ideas && (
            <ul>
              {ex.ideas.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {targets.length > 0 && (
            <p className="small">
              Expresiones útiles: <span lang="en">{targets.map((c) => c.en).join(' · ')}</span>
            </p>
          )}
          {help >= 2 && ex.frame && (
            <p className="frame" lang="en">
              {ex.frame}
            </p>
          )}
        </div>
      )}
      {showModel ? (
        <div className="reveal">
          <p className="muted small">Ejemplo:</p>
          <p className="reveal__text" lang="en">{ex.model}</p>
          <Listen text={ex.model} />
          <button type="button" className="btn btn--primary btn--block" onClick={() => setShowModel(false)}>
            Ocultar y escribir MI versión
          </button>
        </div>
      ) : (
        <>
          <label className="sr-only" htmlFor="open-input">Tu respuesta en inglés</label>
          <textarea
            id="open-input"
            className="input input--tall"
            rows={4}
            lang="en"
            value={text}
            placeholder="Escribe o di tu respuesta en inglés…"
            autoCapitalize="sentences"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row row--between">
            <span className={`small ${words >= ex.minWords ? 'ok-text' : 'muted'}`}>
              {words} / {ex.minWords} palabras
            </span>
            <VoiceInput
              onText={(t) => {
                setText((prev) => (prev ? prev.trim() + ' ' : '') + t);
                setUsedVoice(true);
              }}
            />
          </div>
          {warning && <Verdict kind="close">{warning}</Verdict>}
          <div className="row">
            <button type="button" className="btn btn--primary grow" onClick={submit} disabled={words < 1}>
              <Icon name="check" size={18} /> Enviar
            </button>
            {help < 3 && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  const next = help + 1;
                  setHelp(next);
                  if (next === 3) {
                    setShowModel(true);
                    setModelSeen(true);
                  }
                }}
              >
                <Icon name="bulb" size={16} /> {help === 0 ? 'Ideas' : help === 1 ? 'Estructura' : 'Ejemplo'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
