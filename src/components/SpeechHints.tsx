import { createContext, useContext, useMemo, type ReactNode } from 'react';

const HintsContext = createContext<string[]>([]);

/**
 * Vocabulario del tema para el micrófono: frases y expresiones de la lección o la conversación.
 * Se acumula con el de los componentes de fuera.
 */
export function SpeechHints({ texts, children }: { texts: string[]; children: ReactNode }) {
  const parent = useContext(HintsContext);
  const key = texts.join('\n');
  const value = useMemo(() => [...parent, ...texts], [parent, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <HintsContext.Provider value={value}>{children}</HintsContext.Provider>;
}

export const useSpeechHints = () => useContext(HintsContext);
