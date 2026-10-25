import { useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { chunkById, lessonById, moduleById, unitById } from '../content/course';
import { descriptorById } from '../content/descriptors';
import { AREA_LABEL } from '../content/diagnostic';
import { achievements, ALL_SKILLS, beforeAfter, estimateLevel, SKILL_LABEL, skillStats, weekly } from '../engine/stats';
import { masteryScore, independence, INDEPENDENCE_LABEL } from '../engine/srs';
import { ruleLabel, ruleWhy } from '../engine/errors';
import { formatDate } from '../utils/date';
import { Icon } from '../components/Icon';
import { Bar, Card, Chip, PageHeader, pct } from '../components/ui';
import type { Skill } from '../types/content';

export function ProgressScreen() {
  const { state } = useProgress();
  const [skill, setSkill] = useState<Skill | 'minutes'>('minutes');
  const level = estimateLevel(state);
  const stats = skillStats(state);
  const weeks = weekly(state, 8);
  const values = weeks.map((w) => (skill === 'minutes' ? w.minutes : (w.bySkill[skill] ?? 0) * 100));
  const max = Math.max(skill === 'minutes' ? 30 : 100, ...values);
  const weakChunks = Object.values(state.chunks)
    .filter((p) => chunkById.has(p.id) && p.state !== 'mastered')
    .sort((a, b) => masteryScore(a) - masteryScore(b))
    .slice(0, 10);
  const errors = Object.values(state.errors).sort((a, b) => b.count - a.count).slice(0, 5);
  const evidence = beforeAfter(state);
  const achv = achievements(state);
  const diag = state.diagnostics;
  const firstSample = state.diagnostics[0]?.sample ?? state.samples[0]?.text;
  const lastSample = [...state.samples].reverse().find((s) => s.words >= 10)?.text;
  const descriptors = [...new Set(Object.keys(state.lessons).flatMap((id) => lessonById.get(id)?.lesson.descriptors ?? []))];

  return (
    <div className="stack">
      <PageHeader title="Tu progreso" subtitle="Basado en lo que demostraste, no en pantallas visitadas." />

      <Card tone="accent">
        <p className="eyebrow">Nivel estimado</p>
        <h2 className="big">{level.label}</h2>
        <p>{level.detail}</p>
        <p className="small">Es una estimación orientativa basada en tu diagnóstico y evaluaciones. No certifica un nivel MCER oficial.</p>
      </Card>

      <Card>
        <h2>Competencias</h2>
        {stats.map((s) => (
          <div key={s.skill} className="skill-row">
            <div className="row row--between">
              <span>{SKILL_LABEL[s.skill]}</span>
              <span className="muted small">{s.evidence ? `${pct(s.score)} · ${s.evidence} evidencias` : 'sin datos'}</span>
            </div>
            <Bar value={s.score} label={SKILL_LABEL[s.skill]} small tone={s.evidence ? (s.score >= 0.7 ? 'ok' : 'accent') : 'muted'} />
          </div>
        ))}
        <p className="muted small">Media ponderada de tus últimos 40 intentos por competencia. La opción múltiple y la repetición autodeclarada no cuentan.</p>
      </Card>

      <Card>
        <h2>Por semana</h2>
        <div className="filters" role="group" aria-label="Qué mostrar">
          <button className={`pill ${skill === 'minutes' ? 'is-active' : ''}`} onClick={() => setSkill('minutes')} aria-pressed={skill === 'minutes'}>
            Minutos
          </button>
          {ALL_SKILLS.map((k) => (
            <button key={k} className={`pill ${skill === k ? 'is-active' : ''}`} onClick={() => setSkill(k)} aria-pressed={skill === k}>
              {SKILL_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="chart" role="img" aria-label={`Gráfico semanal: ${skill === 'minutes' ? 'minutos' : SKILL_LABEL[skill]}`}>
          {weeks.map((w, i) => (
            <div key={w.week} className="chart__col">
              <span className="chart__val">{values[i] ? Math.round(values[i]) : ''}</span>
              <div className="chart__bar" style={{ height: `${(values[i] / max) * 100}%` }} />
              <span className="chart__label">{w.week.slice(5).replace('-', '/')}</span>
            </div>
          ))}
        </div>
        <p className="muted small">{skill === 'minutes' ? 'Minutos de estudio por semana (semana que empieza el lunes indicado).' : 'Rendimiento medio (%) por semana.'}</p>
      </Card>

      <Card>
        <h2>Antes podía / Ahora puedo</h2>
        {firstSample && lastSample && firstSample !== lastSample ? (
          <div className="compare">
            <div>
              <p className="eyebrow">Antes</p>
              <blockquote lang="en">{firstSample}</blockquote>
            </div>
            <div>
              <p className="eyebrow">Ahora</p>
              <blockquote lang="en">{lastSample}</blockquote>
            </div>
          </div>
        ) : (
          <p className="muted">Cuando tengas más respuestas libres, aquí verás tu primera producción junto a la más reciente.</p>
        )}
        {evidence.map((e) => (
          <div key={e.canDo} className="evidence">
            <p>
              <Icon name="check" size={14} /> <strong>Ahora puedo:</strong> {e.now}
            </p>
            {e.evidence && (
              <p className="small">
                Evidencia: <q lang="en">{e.evidence}</q>
              </p>
            )}
          </div>
        ))}
      </Card>

      <Card>
        <h2>Expresiones que todavía no dominas</h2>
        {weakChunks.length ? (
          <ul className="result-list">
            {weakChunks.map((p) => (
              <li key={p.id}>
                <a href={`#/biblioteca/${p.id}`} lang="en">{chunkById.get(p.id)!.en}</a>
                <span className="muted small">{INDEPENDENCE_LABEL[independence(p)]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aún no has empezado expresiones.</p>
        )}
      </Card>

      {errors.length > 0 && (
        <Card>
          <h2>Tus errores más frecuentes</h2>
          {errors.map((e) => (
            <div key={e.key} className="error-item">
              <p>
                <strong>{ruleLabel(e.key)}</strong> <Chip>{e.count}×</Chip>
              </p>
              <p className="small">
                Ejemplo tuyo: <del lang="en">{e.example}</del>
              </p>
              <p className="muted small">{ruleWhy(e.key)}</p>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <h2>Evaluaciones</h2>
        {state.assessments.length === 0 && diag.length === 0 && <p className="muted">Todavía no hay evaluaciones.</p>}
        <ul className="result-list">
          {[...state.assessments].reverse().slice(0, 15).map((a) => (
            <li key={a.t}>
              <Icon name={a.passed ? 'check' : 'x'} size={16} />
              <span>
                {a.kind === 'module' ? `Módulo: ${moduleById.get(a.ref)?.title}` : a.kind === 'unit' ? `Unidad: ${unitById.get(a.ref)?.unit.title}` : 'Acumulativa'}
                <span className="muted small"> · {formatDate(a.t)}</span>
              </span>
              <strong>{pct(a.score)}</strong>
            </li>
          ))}
        </ul>
        {diag.length > 0 && (
          <>
            <h3>Diagnósticos</h3>
            <ul className="result-list">
              {diag.map((d) => (
                <li key={d.t}>
                  <Icon name="target" size={16} />
                  <span>
                    {formatDate(d.t)} <span className="muted small">· {d.weaknesses.length ? `a reforzar: ${d.weaknesses.join(', ')}` : 'sin áreas débiles claras'}</span>
                  </span>
                  <strong>{d.estimate}</strong>
                </li>
              ))}
            </ul>
            {diag.length > 1 && (
              <p className="small">
                Comparación: {AREA_LABEL.production} pasó de {pct(diag[0].bySkill.writing ?? 0)} a {pct(diag[diag.length - 1].bySkill.writing ?? 0)}.
              </p>
            )}
          </>
        )}
        <a className="btn btn--soft btn--sm" href="#/diagnostico">
          Repetir diagnóstico
        </a>
      </Card>

      <Card>
        <h2>Logros</h2>
        <ul className="achievements">
          {achv.map((a) => (
            <li key={a.id} className={a.earned ? 'is-earned' : ''}>
              <Icon name={a.earned ? 'trophy' : 'lock'} size={20} />
              <div>
                <strong>{a.title}</strong>
                <span className="muted small">{a.text}</span>
              </div>
              <span className="sr-only">{a.earned ? 'conseguido' : 'pendiente'}</span>
            </li>
          ))}
        </ul>
      </Card>

      {descriptors.length > 0 && (
        <Card>
          <h2>Descriptores MCER trabajados</h2>
          <ul className="descriptors">
            {descriptors.map((id) => {
              const d = descriptorById.get(id);
              return d ? (
                <li key={id}>
                  <Chip>{d.level}</Chip> {d.text}
                </li>
              ) : null;
            })}
          </ul>
          <p className="muted small">Descriptores orientativos inspirados en el MCER.</p>
        </Card>
      )}
    </div>
  );
}
