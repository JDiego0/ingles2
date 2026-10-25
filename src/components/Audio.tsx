import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { speak, stopSpeaking, ttsAvailable } from '../speech/tts';
import { useProgress } from '../state/ProgressContext';

/** Hook que reproduce texto con la voz y velocidad configuradas. */
export function useSpeaker() {
  const { state } = useProgress();
  const [speaking, setSpeaking] = useState<string | null>(null);
  useEffect(() => () => stopSpeaking(), []);
  const play = async (text: string, slow = false) => {
    setSpeaking(text + (slow ? ':slow' : ''));
    const rate = slow ? Math.max(0.5, state.settings.rate - 0.3) : state.settings.rate;
    await speak(text, { rate, voiceURI: state.settings.voiceURI });
    setSpeaking(null);
  };
  return { play, speaking, available: ttsAvailable() };
}

/** Botón para escuchar una frase (normal y lento). Si no hay voz, lo explica. */
export function Listen({ text, label = 'Escuchar', slow = true, compact }: { text: string; label?: string; slow?: boolean; compact?: boolean }) {
  const { play, speaking, available } = useSpeaker();
  if (!available) {
    return compact ? null : <span className="muted small">Audio no disponible en este navegador.</span>;
  }
  return (
    <span className="listen">
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
