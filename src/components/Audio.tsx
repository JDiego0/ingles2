import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { speakResult, stopSpeaking, ttsAvailable } from '../speech/tts';
import { useProgress } from '../state/ProgressContext';

/** Hook que reproduce texto con la voz y velocidad configuradas. */
export function useSpeaker() {
  const { state } = useProgress();
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const active = useRef(false);
  // Al salir de la pantalla solo se corta el audio si lo lanzó este componente.
  useEffect(() => () => {
    if (active.current) stopSpeaking();
  }, []);
  const say = async (text: string, slow = false) => {
    const rate = slow ? Math.max(0.5, state.settings.rate - 0.3) : state.settings.rate;
    active.current = true;
    const r = await speakResult(text, { rate, voiceURI: state.settings.voiceURI });
    active.current = false;
    return r;
  };
  const play = async (text: string, slow = false) => {
    setSpeaking(text + (slow ? ':slow' : ''));
    const r = await say(text, slow);
    setFailed(r === 'failed');
    setSpeaking(null);
    return r !== 'failed';
  };
  /** Reproduce varias frases seguidas; se detiene si falla o si empieza otro audio. */
  const playAll = async (texts: string[]) => {
    for (const t of texts) {
      setSpeaking(t);
      // eslint-disable-next-line no-await-in-loop
      const r = await say(t);
      if (r !== 'ok') {
        setSpeaking(null);
        setFailed(r === 'failed');
        return r;
      }
    }
    setSpeaking(null);
    setFailed(false);
    return 'ok' as const;
  };
  const stop = () => {
    stopSpeaking();
    setSpeaking(null);
  };
  return { play, playAll, stop, speaking, failed, available: ttsAvailable() };
}

export function AudioFailed() {
  return (
    <p className="notice" role="alert">
      <Icon name="alert" size={16} /> No se pudo reproducir el audio. Revisa el volumen y que haya una voz en inglés instalada (Ajustes → Voz).
      Mientras tanto, usa el texto o la alternativa escrita.
    </p>
  );
}

/** Botón para escuchar una frase (normal y lento). Si no hay voz, lo explica. */
export function Listen({ text, label = 'Escuchar', slow = true, compact }: { text: string; label?: string; slow?: boolean; compact?: boolean }) {
  const { play, stop, speaking, available, failed } = useSpeaker();
  if (!available) {
    return compact ? null : <span className="muted small">Audio no disponible en este navegador.</span>;
  }
  return (
    <span className="listen">
      {failed && !compact && <span className="small error-text">Audio no disponible ahora.</span>}
      <button
        type="button"
        className={`btn btn--soft ${compact ? 'btn--icon' : 'btn--sm'}`}
        onClick={() => (speaking === text ? stop() : play(text))}
        aria-label={`${label}: ${text}`}
        aria-pressed={speaking === text}
      >
        <Icon name={speaking === text ? 'stop' : 'play'} size={16} />
        {!compact && <span>{speaking === text ? 'Detener' : label}</span>}
      </button>
      {slow && (
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => play(text, true)} aria-label={`Escuchar despacio: ${text}`} title="Despacio">
          <Icon name="slow" size={16} />
        </button>
      )}
    </span>
  );
}

export function NoTtsNotice() {
  if (ttsAvailable()) return null;
  return (
    <p className="notice">
      <Icon name="alert" size={16} /> Este navegador no ofrece síntesis de voz. Los ejercicios de escucha mostrarán una alternativa escrita.
      En Android, usa Chrome y revisa que «Síntesis de voz de Google» esté instalada.
    </p>
  );
}
