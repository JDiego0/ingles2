import { useState } from 'react';
import type { Chunk } from '../types/content';
import { Icon } from './Icon';
import { Listen } from './Audio';
import { Chip } from './ui';

export const CATEGORY_LABEL: Record<Chunk['cat'], string> = {
  social: 'Relaciones sociales',
  personal: 'Información personal',
  routine: 'Rutinas',
  needs: 'Necesidades',
  likes: 'Gustos',
  ability: 'Habilidades',
  places: 'Lugares',
  shopping: 'Compras y comida',
  clarify: 'Pedir aclaraciones',
  past: 'Pasado',
  plans: 'Planes',
  experience: 'Experiencias',
  opinion: 'Opiniones',
  requests: 'Peticiones',
  feelings: 'Sentimientos',
  connectors: 'Conectores',
  work: 'Trabajo',
  tech: 'Tecnología',
  meetings: 'Reuniones',
  interview: 'Entrevistas',
  email: 'Correos',
  hypothesis: 'Hipótesis',
  argument: 'Argumentar',
  collocation: 'Collocations',
  phrasal: 'Phrasal verbs',
  travel: 'Viajes',
  health: 'Salud',
};

/** Presentación completa de una expresión: significado, audio, ejemplo, sustitución y error típico. */
export function ChunkCard({ c, revealExample = false }: { c: Chunk; revealExample?: boolean }) {
  const [showEs, setShowEs] = useState(revealExample);
  return (
    <article className="chunk-card">
      <div className="row row--between">
        <Chip tone="accent">{c.level}</Chip>
        <Chip>{CATEGORY_LABEL[c.cat]}</Chip>
      </div>
      <h2 className="chunk-card__en" lang="en">{c.en}</h2>
      <p className="chunk-card__es">{c.es}</p>
      <Listen text={c.en.replace(/…/g, '')} />
      {c.note && (
        <p className="note">
          <Icon name="bulb" size={16} /> {c.note}
        </p>
      )}

      <div className="chunk-card__section">
        <h3>Ejemplo</h3>
        <p className="example" lang="en">{c.example.en}</p>
        <div className="row">
          <Listen text={c.example.en} compact />
          <button type="button" className="link-btn" onClick={() => setShowEs((v) => !v)} aria-expanded={showEs}>
            <Icon name="translate" size={14} /> {showEs ? 'Ocultar traducción' : 'Ver traducción'}
          </button>
        </div>
        {showEs && <p className="muted">{c.example.es}</p>}
      </div>

      <div className="chunk-card__section">
        <h3>Cambia las piezas</h3>
        <p className="muted small">La estructura se mantiene; cambia el resto para decir lo que tú necesitas.</p>
        <ul className="variants" lang="en">
          {c.variants.map((v) => (
            <li key={v}>
              <span>{v}</span>
              <Listen text={v} compact slow={false} />
            </li>
          ))}
        </ul>
      </div>

      {c.errors.map((e) => (
        <div className="chunk-card__section error-pair" key={e.wrong}>
          <h3>Error frecuente</h3>
          <p>
            <span className="tag tag--bad">
              <Icon name="x" size={14} /> Evita
            </span>{' '}
            <del lang="en">{e.wrong}</del>
          </p>
          <p>
            <span className="tag tag--ok">
              <Icon name="check" size={14} /> Mejor
            </span>{' '}
            <span lang="en">{e.right}</span>
          </p>
          <p className="muted small">{e.why}</p>
        </div>
      ))}
    </article>
  );
}
