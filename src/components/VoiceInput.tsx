import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { recognitionAvailable, startRecognition, type RecognitionHandle } from '../speech/recognition';
import { recorderAvailable, startRecording, type Recording } from '../speech/recorder';
import { useProgress } from '../state/ProgressContext';

/**
 * Botón de micrófono. Con reconocimiento de voz devuelve la transcripción.
 * Sin reconocimiento, permite grabarte y escucharte (sin texto).
 */
export function VoiceInput({
  onText,
  compact,
  big,
  pick,
  label = 'Hablar',
}: {
  onText: (text: string) => void;
  compact?: boolean;
  /** Botón principal grande (modo «responder hablando»). */
  big?: boolean;
  /** Elige entre las interpretaciones del reconocedor (p. ej., la que coincide con la respuesta). */
  pick?: (alternatives: string[]) => string | undefined;
  label?: string;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const handle = useRef<RecognitionHandle | null>(null);
  const { state } = useProgress();
  // El reconocedor en inglés suele confundir nombres en español («Diego» → «the ego»):
  // si alguna interpretación contiene tu nombre, se prefiere esa.
  const name = state.name.trim().toLowerCase();
  const choose = (alts: string[]) => pick?.(alts) ?? (name ? alts.find((a) => a.toLowerCase().includes(name)) : undefined);

  useEffect(() => () => handle.current?.stop(), []);

  if (!recognitionAvailable()) return big ? null : <SelfRecorder compact={compact} />;

  const start = () => {
    setError('');
    setInterim('');
    setListening(true);
    const h = startRecognition(setInterim, choose);
    handle.current = h;
    h.result
      .then((r) => onText(r.transcript))
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setListening(false);
        setInterim('');
        handle.current = null;
      });
  };

  return (
    <div className="voice">
      <button
        type="button"
        className={`btn ${listening ? 'btn--danger' : big ? 'btn--primary btn--block btn--mic' : 'btn--soft'} ${compact ? 'btn--icon' : ''}`}
        onClick={() => (listening ? handle.current?.stop() : start())}
        aria-pressed={listening}
        aria-label={listening ? 'Detener y usar lo que dije' : 'Responder hablando'}
      >
        <Icon name={listening ? 'stop' : 'mic'} size={big ? 24 : 18} />
        {!compact && <span>{listening ? 'Listo, ya terminé' : label}</span>}
      </button>
      {listening && (
        <p className="voice__interim" aria-live="polite">
          <span className="pulse" aria-hidden="true" /> {interim || 'Te escucho… di la frase una vez, en inglés.'}
        </p>
      )}
      {error && <p className="voice__error" role="alert">{error}</p>}
    </div>
  );
}

/** Alternativa sin reconocimiento: grabarse y escucharse para compararse con el modelo. */
export function SelfRecorder({ compact }: { compact?: boolean }) {
  const [rec, setRec] = useState<Recording | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  if (!recorderAvailable()) return null;
  const toggle = async () => {
    setError('');
    if (rec) {
      const u = await rec.stop();
      setRec(null);
      setUrl(u);
      return;
    }
    try {
      setRec(await startRecording());
    } catch {
      setError('No se pudo usar el micrófono. Revisa los permisos del navegador.');
    }
  };
  return (
    <div className="voice">
      <button type="button" className={`btn ${rec ? 'btn--danger' : 'btn--soft'} ${compact ? 'btn--icon' : ''}`} onClick={toggle} aria-pressed={!!rec} aria-label={rec ? 'Detener grabación' : 'Grabarme'}>
        <Icon name={rec ? 'stop' : 'mic'} size={18} />
        {!compact && <span>{rec ? 'Detener' : 'Grabarme'}</span>}
      </button>
      {url && !rec && <audio controls src={url} className="voice__audio" aria-label="Tu grabación" />}
      {error && <p className="voice__error" role="alert">{error}</p>}
      {!compact && !rec && !url && <p className="muted small">Este navegador no transcribe voz: grábate, escúchate y compárate con el modelo.</p>}
    </div>
  );
}
