import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { speak, stopSpeaking, ttsAvailable } from '../speech/tts';
import { useProgress } from '../state/ProgressContext';

/** Hook que reproduce texto con la voz y velocidad configuradas. */
export function useSpeaker() {
  const { state } = useProgress();
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  const play = async (text: string, slow = false) => {
    setSpeaking(text + (slow ? ':slow' : ''));
    const rate = slow ? Math.max(0.5, state.settings.rate - 0.3) : state.settings.rate;
    const ok = await speak(text, { rate, voiceURI: state.settings.voiceURI });
    setFailed(!ok);
    setSpeaking(null);
    return ok;
  };
  return { play, speaking, failed, available: ttsAvailable() };
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
  const { play, speaking, available, failed } = useSpeaker();
  if (!available) {
    return compact ? null : <span className="muted small">Audio no disponible en este navegador.</span>;
  }
  return (
    <span className="listen">
      {failed && !compact && <span className="small error-text">Audio no disponible ahora.</span>}
      <button
        type="button"
        className={`btn btn--soft ${compact ? 'btn--icon' : 'btn--sm'}`}
        onClick={() => play(text)}
        aria-label={`${label}: ${text}`}
        aria-pressed={speaking === text}
      >
        <Icon name="play" size={16} />
        {!compact && <span>{label}</span>}
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
