import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Card({ children, className = '', tone }: { children: ReactNode; className?: string; tone?: 'accent' | 'soft' | 'warn' }) {
  return <section className={`card ${tone ? 'card--' + tone : ''} ${className}`}>{children}</section>;
}

export function Bar({ value, label, tone = 'accent', small }: { value: number; label: string; tone?: 'accent' | 'ok' | 'warn' | 'muted'; small?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`bar ${small ? 'bar--small' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className={`bar__fill bar__fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 76, label, children }: { value: number; size?: number; label: string; children?: ReactNode }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(pct * 100)} %`}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring__track" strokeWidth={8} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring__fill"
          strokeWidth={8}
          fill="none"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
      <div className="ring__label">{children}</div>
    </div>
  );
}

export function Chip({ children, tone = 'muted', icon }: { children: ReactNode; tone?: 'muted' | 'accent' | 'ok' | 'warn' | 'bad'; icon?: IconName }) {
  return (
    <span className={`chip chip--${tone}`}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

/** Estado de una respuesta: siempre con icono y texto, nunca solo color. */
export function Verdict({ kind, children }: { kind: 'ok' | 'close' | 'bad' | 'info'; children: ReactNode }) {
  const icon: IconName = kind === 'ok' ? 'check' : kind === 'bad' ? 'x' : kind === 'close' ? 'alert' : 'bulb';
  return (
    <div className={`verdict verdict--${kind}`} role="status" aria-live="polite">
      <span className="verdict__icon">
        <Icon name={icon} size={18} />
      </span>
      <div className="verdict__body">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: string; right?: ReactNode }) {
  return (
    <header className="page-header">
      {back && (
        <a className="icon-btn" href={back} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
      )}
      <div className="page-header__text">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={36} />
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}

export function Stat({ icon, value, label }: { icon: IconName; value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <Icon name={icon} size={18} />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function pct(v: number) {
  return `${Math.round(v * 100)} %`;
}
