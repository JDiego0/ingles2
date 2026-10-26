import { useState } from 'react';
import { Icon } from './Icon';
import { VoiceInput, speechInputAvailable } from './VoiceInput';
import { useProgress } from '../state/ProgressContext';

/**
 * Respuesta libre hablando: cada vez que pulsas el micrófono se añade lo que dijiste.
 * El teclado queda como opción («Escribir») o como modo por defecto si se eligió en Ajustes
 * o si el navegador no reconoce voz.
 */
export function SpokenComposer({
  text,
  setText,
  onVoice,
  placeholder = 'Tu respuesta en inglés…',
  rows = 3,
  compact,
  onEnter,
}: {
  text: string;
  setText: (t: string) => void;
  onVoice?: () => void;
  placeholder?: string;
  rows?: number;
  /** Versión reducida (conversación). */
  compact?: boolean;
  onEnter?: () => void;
}) {
  const { state } = useProgress();
  const canVoice = speechInputAvailable();
  const [typing, setTyping] = useState(state.settings.keyboard || !canVoice);
  const [history, setHistory] = useState<string[]>([]);

  const add = (t: string) => {
    // Si el reconocedor entrega otra vez la misma frase, no se añade dos veces.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (text && norm(text).endsWith(norm(t))) return;
    setHistory((h) => [...h, text]);
    setText(text ? `${text.trim()} ${t}` : t);
    onVoice?.();
  };

  if (typing) {
    return (
      <div className="stack stack--tight">
        <textarea
          className="input input--tall"
          rows={rows}
          lang="en"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="Tu respuesta"
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (onEnter && e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        {canVoice && (
          <div className="row row--between">
            <VoiceInput compact onText={add} />
            <button type="button" className="link-btn" onClick={() => setTyping(false)}>
              <Icon name="mic" size={14} /> Prefiero hablar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack stack--tight">
      {text ? (
        <>
          <textarea
            className={`input spoken ${compact ? 'spoken--compact' : ''}`}
            rows={rows}
            lang="en"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Lo que entendí (puedes corregirlo)"
            autoCapitalize="sentences"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="muted small">Si alguna palabra quedó mal, tócala y corrígela antes de enviar.</p>
        </>
      ) : (
        <div className={`spoken spoken--empty ${compact ? 'spoken--compact' : ''}`} aria-live="polite" lang="en">
          <span className="muted">Pulsa el micrófono y di tu respuesta. Si hablas otra vez, se añade al final.</span>
        </div>
      )}
      <VoiceInput big label={text ? 'Añadir más' : 'Responder hablando'} onText={add} />
      <div className="row row--between">
        <div className="row">
          {history.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setText(history[history.length - 1]);
                setHistory((h) => h.slice(0, -1));
              }}
            >
              <Icon name="arrowLeft" size={14} /> Quitar lo último
            </button>
          )}
          {text && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setHistory((h) => [...h, text]);
                setText('');
              }}
            >
              <Icon name="x" size={14} /> Borrar
            </button>
          )}
        </div>
        <button type="button" className="link-btn" onClick={() => setTyping(true)}>
          <Icon name="keyboard" size={14} /> Escribir
        </button>
      </div>
    </div>
  );
}
