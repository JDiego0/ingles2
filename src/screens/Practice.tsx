import { Icon, type IconName } from '../components/Icon';
import { PageHeader } from '../components/ui';
import { CHUNKS } from '../content/course';
import { CONVERSATIONS } from '../content/conversations';

const ITEMS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: '#/conversar', icon: 'chat', title: 'Conversación', text: `${CONVERSATIONS.length} situaciones ramificadas: responde sin guion, con pistas solo si te bloqueas.` },
  { href: '#/pronunciacion', icon: 'ear', title: 'Pronunciación y escucha', text: 'Sonidos difíciles para hispanohablantes, ritmo, contracciones y dictados.' },
  { href: '#/biblioteca', icon: 'book', title: 'Biblioteca de expresiones', text: `${CHUNKS.length} chunks con ejemplos, variantes y errores frecuentes.` },
  { href: '#/repaso', icon: 'repeat', title: 'Repasos', text: 'Repetición espaciada: 1, 3, 7, 14 y 30 días.' },
  { href: '#/evaluacion/acumulativa/general', icon: 'layers', title: 'Evaluación acumulativa', text: 'Preguntas nuevas sobre todo lo que has estudiado.' },
];

export function PracticeHub() {
  return (
    <div className="stack">
      <PageHeader title="Practicar" subtitle="Elige el tipo de práctica." />
      <ul className="card-list">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <a className="hub-item" href={i.href}>
              <span className="hub-item__icon">
                <Icon name={i.icon} size={24} />
              </span>
              <span>
                <strong>{i.title}</strong>
                <span className="muted small">{i.text}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
