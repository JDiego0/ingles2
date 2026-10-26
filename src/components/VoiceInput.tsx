import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { recognitionAvailable, startRecognition } from '../speech/recognition';
import { localSttSupported, loadStt, onSttStatus, sttModelDownloaded, sttStatus, startLocalRecognition, type SttStatus } from '../speech/stt';
import { stopSpeaking } from '../speech/tts';
import { soundMicOff, soundMicOn } from '../speech/sounds';
import { recorderAvailable, startRecording, type Recording } from '../speech/recorder';
import { COMMON_PROPER, correctTranscript, promptFor, termsFrom } from '../speech/vocab';
import { useSpeechHints } from './SpeechHints';
import { useProgress } from '../state/ProgressContext';
import type { Settings } from '../types/progress';

/** Hay alguna forma de responder hablando con transcripción. */
export function speechInputAvailable(): boolean {
  return localSttSupported() || recognitionAvailable();
}

/** Motor que se usará: el elegido en Ajustes si el navegador lo permite; si no, el otro. */
export function sttEngine(settings: Pick<Settings, 'stt'>): 'local' | 'browser' | null {
  if (settings.stt !== 'browser' && localSttSupported()) return 'local';
  if (recognitionAvailable()) return 'browser';
  return localSttSupported() ? 'local' : null;
}

export function useSttStatus(): SttStatus {
  const [s, setS] = useState(sttStatus);
  useEffect(() => onSttStatus(setS), []);
  return s;
}

type Phase = 'idle' | 'consent' | 'starting' | 'recording' | 'transcribing';

/**
 * Botón de micrófono. Devuelve la transcripción de lo que dijiste.
 * Con el motor «en el teléfono» graba con un solo micrófono abierto hasta pulsar «Listo»
 * y luego transcribe; con el de Chrome, muestra el texto mientras hablas.
 * Sin reconocimiento, permite grabarte y escucharte (sin texto).
 */
export function VoiceInput({
  onText,
  compact,
  big,
  pick,
  hints,
  label = 'Hablar',
}: {
  onText: (text: string) => void;
  compact?: boolean;
  /** Botón principal grande (modo «responder hablando»). */
  big?: boolean;
  /** Elige entre las interpretaciones del reconocedor (p. ej., la que coincide con la respuesta). */
  pick?: (alternatives: string[]) => string | undefined;
  /** Frases esperadas o del tema (además de las de <SpeechHints>): ayudan a entender lo que dices. */
  hints?: string[];
  label?: string;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [interim, setInterim] = useState('');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const handle = useRef<{ stop(): void; cancel?(): void } | null>(null);
  const { state, act } = useProgress();
  const engine = sttEngine(state.settings);
  const model = useSttStatus();
  // El reconocedor en inglés suele confundir nombres en español («Diego» → «the ego»):
  // si alguna interpretación contiene tu nombre, se prefiere esa.
  const name = state.name.trim().toLowerCase();
  const choose = (alts: string[]) => pick?.(alts) ?? (name ? alts.find((a) => a.toLowerCase().includes(name)) : undefined);
  // Vocabulario del tema, tu nombre y tus palabras: se le pasan al modelo y luego se corrige lo que suene parecido.
  const context = useSpeechHints();
  const hintKey = [...context, ...(hints ?? [])].join('\n');
  const terms = useMemo(
    () => termsFrom([...context, ...(hints ?? [])], [state.name, state.settings.speechWords ?? ''], COMMON_PROPER),
    [hintKey, state.name, state.settings.speechWords], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Si el modelo ya está en el teléfono, se carga en memoria para que responda rápido.
  useEffect(() => {
    if (engine === 'local' && sttModelDownloaded()) loadStt();
  }, [engine]);
  useEffect(
    () => () => {
      const h = handle.current;
      if (h) (h.cancel ?? h.stop).call(h);
    },
    [],
  );

  if (!engine) return big ? null : <SelfRecorder compact={compact} />;

  const done = (result: Promise<{ transcript: string }>) =>
    result
      .then((r) => onText(correctTranscript(r.transcript, terms)))
      .catch((e: Error) => {
        if (!/cancelada/i.test(e.message)) setError(e.message);
      })
      .finally(() => {
        setPhase('idle');
        setInterim('');
        setLevel(0);
        handle.current = null;
      });

  const start = (consented = false) => {
    // Si la app sigue hablando, el micrófono grabaría su propia voz.
    stopSpeaking();
    setError('');
    setInterim('');
    if (engine === 'local' && !consented && !sttModelDownloaded() && model.state !== 'loading' && model.state !== 'ready') {
      setPhase('consent');
      return;
    }
    if (engine === 'local') {
      // El aviso «te escucho» y el sonido llegan cuando el micrófono ya graba: así no se pierde la primera palabra.
      setPhase('starting');
      const h = startLocalRecognition({
        prompt: promptFor(terms),
        onLevel: setLevel,
        onPhase: (p) => {
          if (p === 'recording') soundMicOn();
          setPhase(p);
        },
      });
      handle.current = h;
      done(h.result);
    } else {
      soundMicOn();
      setPhase('recording');
      const h = startRecognition(setInterim, choose);
      handle.current = h;
      done(h.result);
    }
  };

  const stop = () => {
    // Primero se corta la grabación, para que el sonido no quede grabado.
    handle.current?.stop();
    soundMicOff();
  };

  if (phase === 'consent') {
    return (
      <div className="voice voice__consent">
        <p>
          <strong>Para entenderte mucho mejor</strong>, la app usa un reconocedor de voz que funciona dentro de tu teléfono. Se descarga{' '}
          <strong>una sola vez</strong> (unos 140 MB, mejor con Wi-Fi) y después funciona incluso sin internet.
        </p>
        <div className="row">
          <button type="button" className="btn btn--primary grow" onClick={() => start(true)}>
            <Icon name="mic" size={18} /> Descargar y hablar
          </button>
          {recognitionAvailable() && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                act.updateSettings({ stt: 'browser' });
                setPhase('idle');
              }}
            >
              Usar el de Chrome
            </button>
          )}
        </div>
        <p className="muted small">Puedes cambiarlo cuando quieras en Ajustes → Micrófono.</p>
      </div>
    );
  }

  const loading = engine === 'local' && model.state === 'loading' && !sttModelDownloaded();
  const busy = phase === 'transcribing' || phase === 'starting';
  const pct = Math.round(model.progress * 100);
  return (
    <div className="voice">
      <button
        type="button"
        className={`btn ${phase === 'recording' ? 'btn--danger' : big ? 'btn--primary btn--block btn--mic' : 'btn--soft'} ${compact ? 'btn--icon' : ''}`}
        onClick={() => (phase === 'recording' ? stop() : phase === 'idle' ? start() : undefined)}
        disabled={busy}
        aria-pressed={phase === 'recording'}
        aria-label={phase === 'recording' ? 'Detener y usar lo que dije' : phase === 'starting' ? 'Abriendo el micrófono' : busy ? 'Entendiendo lo que dijiste' : label}
      >
        <Icon name={phase === 'recording' ? 'stop' : 'mic'} size={big ? 24 : 18} />
        {!compact && <span>{phase === 'recording' ? 'Listo, ya terminé' : phase === 'starting' ? 'Abriendo el micrófono…' : busy ? 'Entendiendo…' : label}</span>}
      </button>
      {phase === 'recording' && (
        <div className="voice__interim" aria-live="polite">
          {engine === 'local' ? (
            <span className="voice__meter" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.max(0.04, level)})` }} />
            </span>
          ) : (
            <span className="pulse" aria-hidden="true" />
          )}{' '}
          {interim || 'Te escucho… puedes pausar para pensar. Pulsa «Listo» cuando termines.'}{' '}
          {engine === 'local' && (
            <button type="button" className="link-btn" onClick={() => handle.current?.cancel?.()}>
              Cancelar
            </button>
          )}
        </div>
      )}
      {phase === 'transcribing' && !loading && (
        <p className="voice__interim" aria-live="polite">
          <span className="pulse" aria-hidden="true" /> Entendiendo lo que dijiste…
        </p>
      )}
      {loading && (
        <p className="voice__interim" aria-live="polite">
          <span className="progress-mini" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </span>{' '}
          Descargando el reconocedor de voz (solo la primera vez): {pct} %{model.totalMb ? ` de ${model.totalMb} MB` : ''}
        </p>
      )}
      {model.state === 'error' && engine === 'local' && (
        <p className="voice__error" role="alert">
          No se pudo preparar el reconocedor de voz{navigator.onLine ? '' : ' (la primera vez necesita internet)'}.{' '}
          {recognitionAvailable() && (
            <button type="button" className="link-btn" onClick={() => act.updateSettings({ stt: 'browser' })}>
              Usar el de Chrome
            </button>
          )}
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
