import { useState } from 'react';
import type { Instr } from '../../types/content';
import { instrText, type InstrMode } from '../../engine/instructions';
import { Icon } from '../Icon';

export function Prompt({ instr, mode }: { instr: Instr; mode: InstrMode }) {
  const [showEs, setShowEs] = useState(false);
  const t = instrText(instr, mode);
  return (
    <div className="prompt">
      <p className="prompt__main" lang={t.lang}>{t.main}</p>
      {t.secondary && mode === 'bi' && <p className="prompt__secondary">{t.secondary}</p>}
      {t.secondary && mode === 'en' && (
        <button type="button" className="link-btn" onClick={() => setShowEs((v) => !v)} aria-expanded={showEs}>
          <Icon name="translate" size={14} /> {showEs ? t.secondary : 'Ver en español'}
        </button>
      )}
    </div>
  );
}
