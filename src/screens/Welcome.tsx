import { useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { navigate } from '../router';
import { Icon } from '../components/Icon';
import { Card, Verdict } from '../components/ui';

export function Welcome() {
  const { state, act } = useProgress();
  const [name, setName] = useState(state.name);
  return (
    <div className="stack welcome">
      <div className="welcome__hero">
        <img src="./icons/icon.svg" alt="" width={72} height={72} />
        <h1>English Journey</h1>
        <p>Tu ruta personal de inglés, de A1 a B2, en sesiones de 30 minutos.</p>
      </div>
      <Card>
        <h2>Cómo funciona</h2>
        <ul className="method">
          <li>
            <Icon name="ear" /> <span>Entiendes una expresión en una situación real y la escuchas.</span>
          </li>
          <li>
            <Icon name="eyeOff" /> <span>La recuperas de memoria, sin verla. Las pistas aparecen solo si las necesitas.</span>
          </li>
          <li>
            <Icon name="pen" /> <span>La usas para decir cosas tuyas, hablando o escribiendo.</span>
          </li>
          <li>
            <Icon name="repeat" /> <span>Vuelve días después para que se quede en tu memoria.</span>
          </li>
        </ul>
        <p className="muted small">El objetivo no es completar ejercicios, sino poder hablar cuando no hay pistas.</p>
      </Card>
      <label className="field">
        <span>¿Cómo te llamas? (opcional)</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" />
      </label>
      <Verdict kind="info">Tu progreso se guarda en este navegador, sin cuentas. Puedes exportar una copia desde Ajustes.</Verdict>
      <button
        className="btn btn--primary btn--block btn--lg"
        onClick={() => {
          act.setName(name.trim());
          navigate('#/diagnostico');
        }}
      >
        Hacer el diagnóstico (5–10 min)
      </button>
      <button
        className="btn btn--ghost btn--block"
        onClick={() => {
          act.setName(name.trim());
          act.setOnboarded();
          navigate('#/leccion/a1-l1');
        }}
      >
        Empezar desde el principio
      </button>
    </div>
  );
}
