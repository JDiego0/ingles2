import { useRef, useState } from 'react';
import { createInitialState, parseBackup, saveState, STORAGE_KEY } from '../storage/store';
import { downloadText } from './Settings';

/**
 * Se muestra si el progreso guardado está dañado. No borra nada sin confirmación
 * y permite descargar los datos originales antes de reiniciar o restaurar.
 */
export function Recovery({ raw, problems }: { raw: string; problems: string[] }) {
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const restore = async (f: File | undefined) => {
    if (!f) return;
    const r = parseBackup(await f.text());
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    saveState(r.state);
    window.location.reload();
  };

  return (
    <main className="app-main">
      <div className="stack">
        <div className="card card--warn">
          <h1>No pudimos leer tu progreso</h1>
          <p>Los datos guardados en este navegador parecen dañados. No se ha borrado nada.</p>
          <ul className="small">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>1. Guarda los datos actuales</h2>
          <p className="muted">Descarga una copia de los datos tal como están, por si se pueden reparar.</p>
          <button className="btn btn--soft" onClick={() => downloadText('english-journey-datos-danados.json', raw)}>
            Descargar datos dañados
          </button>
        </div>
        <div className="card">
          <h2>2. Restaura una copia de seguridad</h2>
          <p className="muted">Si exportaste una copia desde Ajustes, impórtala aquí.</p>
          <button className="btn btn--primary" onClick={() => fileRef.current?.click()}>
            Importar copia (.json)
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          {msg && <p role="alert" className="error-text">{msg}</p>}
        </div>
        <div className="card">
          <h2>3. O empieza de nuevo</h2>
          {confirm ? (
            <div className="row">
              <button
                className="btn btn--danger"
                onClick={() => {
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {
                    /* almacenamiento no disponible */
                  }
                  saveState(createInitialState());
                  window.location.reload();
                }}
              >
                Sí, empezar de cero
              </button>
              <button className="btn btn--ghost" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button className="btn btn--ghost" onClick={() => setConfirm(true)}>
              Reiniciar progreso…
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
