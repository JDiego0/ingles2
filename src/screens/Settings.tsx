import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { exportBackup, parseBackup } from '../storage/store';
import { englishVoices, loadVoices, speak, ttsAvailable } from '../speech/tts';
import { recognitionAvailable } from '../speech/recognition';
import { recorderAvailable } from '../speech/recorder';
import { useOnline } from '../pwa';
import { Icon } from '../components/Icon';
import { Card, PageHeader, Verdict } from '../components/ui';
import type { Settings } from '../types/progress';

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsScreen() {
  const { state, act } = useProgress();
  const s = state.settings;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const [swActive, setSwActive] = useState<boolean | null>(null);

  useEffect(() => {
    loadVoices().then((v) => setVoices(englishVoices(v)));
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((r) => setSwActive(!!r?.active)).catch(() => setSwActive(false));
    else setSwActive(false);
  }, []);

  const set = (patch: Partial<Settings>) => act.updateSettings(patch);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const r = parseBackup(text);
    if (!r.ok) {
      setImportMsg({ ok: false, text: r.error });
      setPendingImport(null);
    } else {
      setPendingImport(r);
      setImportMsg(null);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="stack">
      <PageHeader title="Ajustes" back="#/" />

      <Card>
        <h2>Tú</h2>
        <label className="field">
          <span>Nombre (opcional)</span>
          <input className="input" value={state.name} onChange={(e) => act.setName(e.target.value)} maxLength={40} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Meta diaria</span>
          <select className="input" value={s.dailyGoalMin} onChange={(e) => set({ dailyGoalMin: Number(e.target.value) })}>
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutos
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card>
        <h2>Visualización</h2>
        <fieldset className="segmented">
          <legend>Tema</legend>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <label key={t} className={s.theme === t ? 'is-active' : ''}>
              <input type="radio" name="theme" checked={s.theme === t} onChange={() => set({ theme: t })} />
              {t === 'system' ? 'Sistema' : t === 'light' ? 'Claro' : 'Oscuro'}
            </label>
          ))}
        </fieldset>
        <fieldset className="segmented">
          <legend>Idioma de las instrucciones</legend>
          {(['auto', 'es', 'en'] as const).map((t) => (
            <label key={t} className={s.instructions === t ? 'is-active' : ''}>
              <input type="radio" name="instr" checked={s.instructions === t} onChange={() => set({ instructions: t })} />
              {t === 'auto' ? 'Progresivo' : t === 'es' ? 'Español' : 'Inglés'}
            </label>
          ))}
        </fieldset>
        <p className="muted small">Progresivo: español en la etapa A, bilingüe en la B e inglés (con traducción opcional) en C y D.</p>
      </Card>

      <Card>
        <h2>Voz</h2>
        {ttsAvailable() ? (
          <>
            <label className="field">
              <span>Voz en inglés</span>
              <select className="input" value={s.voiceURI ?? ''} onChange={(e) => set({ voiceURI: e.target.value || null })}>
                <option value="">Automática (en-US)</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
            {voices.length === 0 && <p className="muted small">No se encontraron voces en inglés. En Android: Ajustes → Idioma → Salida de texto a voz → instala inglés (EE. UU.).</p>}
            <label className="field">
              <span>Velocidad: {s.rate.toFixed(2)}×</span>
              <input type="range" min={0.6} max={1.2} step={0.05} value={s.rate} onChange={(e) => set({ rate: Number(e.target.value) })} />
            </label>
            <label className="toggle">
              <input type="checkbox" checked={s.autoplay} onChange={(e) => set({ autoplay: e.target.checked })} /> Reproducir automáticamente al interlocutor en conversaciones
            </label>
            <button className="btn btn--soft" onClick={() => speak("Hi! I'm your English practice voice. How does this sound?", { rate: s.rate, voiceURI: s.voiceURI })}>
              <Icon name="play" size={16} /> Probar voz
            </button>
          </>
        ) : (
          <Verdict kind="info">Este navegador no ofrece síntesis de voz. Usa Chrome en Android para tener audio.</Verdict>
        )}
      </Card>

      <Card>
        <h2>Capacidades de este dispositivo</h2>
        <ul className="result-list">
          <li>
            <Icon name={ttsAvailable() ? 'check' : 'x'} size={16} /> <span>Síntesis de voz (escuchar)</span>
          </li>
          <li>
            <Icon name={recognitionAvailable() ? 'check' : 'x'} size={16} /> <span>Reconocimiento de voz (suele requerir internet)</span>
          </li>
          <li>
            <Icon name={recorderAvailable() ? 'check' : 'x'} size={16} /> <span>Grabación para escucharte</span>
          </li>
          <li>
            <Icon name={swActive ? 'check' : 'x'} size={16} /> <span>Modo sin conexión {swActive === null ? '(comprobando…)' : swActive ? 'activo' : '(se activa en la versión publicada)'}</span>
          </li>
          <li>
            <Icon name={online ? 'check' : 'x'} size={16} /> <span>{online ? 'Conectado' : 'Sin conexión ahora'}</span>
          </li>
        </ul>
      </Card>

      <Card>
        <h2>Copia de seguridad</h2>
        <Verdict kind="info">
          Tu progreso se guarda <strong>solo en este navegador</strong>. No se sincroniza entre dispositivos, y si borras los datos del navegador lo perderás. Exporta una copia de vez en cuando.
        </Verdict>
        <div className="row">
          <button className="btn btn--primary grow" onClick={() => downloadText(`english-journey-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(state))}>
            <Icon name="download" size={16} /> Exportar
          </button>
          <button className="btn btn--soft grow" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Importar
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {importMsg && <Verdict kind={importMsg.ok ? 'ok' : 'bad'}>{importMsg.text}</Verdict>}
        {pendingImport?.ok && (
          <Verdict kind="close">
            <p>
              Copia válida{pendingImport.exportedAt ? ` del ${new Date(pendingImport.exportedAt).toLocaleString('es-CO')}` : ''}: {Object.keys(pendingImport.state.lessons).length} lecciones,{' '}
              {Object.keys(pendingImport.state.chunks).length} expresiones. Restaurarla <strong>reemplaza</strong> el progreso actual.
            </p>
            <div className="row">
              <button
                className="btn btn--primary btn--sm"
                onClick={() => {
                  if (pendingImport.ok) act.replaceState(pendingImport.state);
                  setPendingImport(null);
                  setImportMsg({ ok: true, text: 'Progreso restaurado.' });
                }}
              >
                Restaurar
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => setPendingImport(null)}>
                Cancelar
              </button>
            </div>
          </Verdict>
        )}
      </Card>

      <Card tone="warn">
        <h2>Borrar todo</h2>
        <p className="muted">Elimina todo tu progreso de este navegador. Exporta antes una copia si quieres conservarlo.</p>
        {confirmReset ? (
          <div className="row">
            <button
              className="btn btn--danger"
              onClick={() => {
                act.reset();
                setConfirmReset(false);
                window.location.hash = '#/';
              }}
            >
              Sí, borrar todo
            </button>
            <button className="btn btn--ghost" onClick={() => setConfirmReset(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
            Borrar progreso…
          </button>
        )}
      </Card>
      <p className="muted small center">English Journey · funciona sin cuentas ni servicios de pago.</p>
    </div>
  );
}
