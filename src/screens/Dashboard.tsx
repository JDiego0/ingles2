import { useProgress } from '../state/ProgressContext';
import { lessonById, moduleById, unitById, MODULES } from '../content/course';
import { STAGES } from '../content/descriptors';
import { currentModule, nextStep } from '../engine/unlock';
import { chunkCounts, courseProgress, estimateLevel, flexibleStreak, last7, recommend, skillStats, todaySeconds } from '../engine/stats';
import { formatMinutes, weekdayShort } from '../utils/date';
import { Icon } from '../components/Icon';
import { Bar, Card, Ring, Stat } from '../components/ui';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function Dashboard() {
  const { state } = useProgress();
  const step = nextStep(state);
  const mod = currentModule(state);
  const level = estimateLevel(state);
  const progress = courseProgress(state);
  const counts = chunkCounts(state);
  const streak = flexibleStreak(state);
  const today = todaySeconds(state);
  const goal = state.settings.dailyGoalMin * 60;
  const week = last7(state);
  const maxWeek = Math.max(goal, ...week.map((d) => d.seconds));
  const rec = recommend(state);
  const skills = skillStats(state);
  const skill = (k: string) => skills.find((s) => s.skill === k)!;
  const stage = STAGES.find((s) => s.id === mod.stage)!;
  const session = state.session;

  let cta = { href: '#/ruta', title: 'Ruta completada', sub: 'Repasa y practica conversación para mantener tu nivel.' };
  if (session && lessonById.has(session.lessonId)) {
    const ref = lessonById.get(session.lessonId)!;
    cta = { href: `#/leccion/${session.lessonId}`, title: ref.lesson.title, sub: 'Retoma donde lo dejaste' };
  } else if (step.kind === 'lesson') {
    const ref = lessonById.get(step.id)!;
    cta = { href: `#/leccion/${step.id}`, title: ref.lesson.title, sub: `${ref.unit.title} · ${ref.lesson.minutes} min` };
  } else if (step.kind === 'unit') {
    cta = { href: `#/evaluacion/unidad/${step.id}`, title: `Evaluación: ${unitById.get(step.id)!.unit.title}`, sub: 'Evaluación corta de la unidad' };
  } else if (step.kind === 'module') {
    cta = { href: `#/evaluacion/modulo/${step.id}`, title: `Evaluación del módulo: ${moduleById.get(step.id)!.title}`, sub: 'Evaluación acumulativa para desbloquear el siguiente módulo' };
  }

  const nextMilestone = (() => {
    const idx = MODULES.findIndex((m) => m.id === mod.id);
    const remaining = mod.units.flatMap((u) => u.lessons).filter((l) => !state.lessons[l.id]).length;
    if (remaining > 0) return `Terminar «${mod.title}»: faltan ${remaining} ${remaining === 1 ? 'lección' : 'lecciones'} y la evaluación del módulo.`;
    const next = MODULES[idx + 1];
    return next ? `Aprobar la evaluación de «${mod.title}» para abrir «${next.title}».` : 'Aprobar la última evaluación del curso.';
  })();

  return (
    <div className="stack">
      <section className="hero">
        <p className="muted">{greeting()}{state.name ? `, ${state.name}` : ''} 👋</p>
        <h1>Tu objetivo: comunicarte en inglés con independencia</h1>
        <div className="hero__levels">
          <div>
            <span className="muted small">Nivel estimado</span>
            <strong>{level.label}</strong>
          </div>
          <Icon name="arrowRight" />
          <div>
            <span className="muted small">Objetivo</span>
            <strong>B2</strong>
          </div>
          <Ring value={progress} size={64} label="Progreso del curso">
            <strong>{Math.round(progress * 100)}%</strong>
          </Ring>
        </div>
        <p className="muted small">{level.detail} Estimación orientativa: no certifica un nivel oficial.</p>
      </section>

      <a className="cta" href={cta.href}>
        <div>
          <span className="cta__eyebrow">Continuar aprendiendo</span>
          <strong className="cta__title">{cta.title}</strong>
          <span className="cta__sub">{cta.sub}</span>
        </div>
        <span className="cta__icon">
          <Icon name="play" size={26} />
        </span>
      </a>

      <Card>
        <div className="row row--between">
          <h2>Hoy</h2>
          <span className="muted small">{formatMinutes(today)} de {state.settings.dailyGoalMin} min</span>
        </div>
        <Bar value={today / goal} label="Tiempo de práctica de hoy" tone={today >= goal ? 'ok' : 'accent'} />
        <div className="stats-grid">
          <Stat icon="flame" value={streak.streak} label={streak.streak === 1 ? 'día de racha' : 'días de racha'} />
          <Stat icon="repeat" value={counts.due} label="repasos pendientes" />
          <Stat icon="clock" value={`${streak.activeThisWeek}/7`} label="días activos" />
        </div>
        <p className="muted small">La racha es flexible: un día de descanso no la rompe.</p>
        <div className="week" aria-label="Minutos de estudio de los últimos 7 días">
          {week.map((d) => (
            <div key={d.key} className="week__day">
              <div className="week__bar" style={{ height: `${Math.max(4, (d.seconds / maxWeek) * 64)}px` }} title={formatMinutes(d.seconds)} />
              <span>{weekdayShort(d.key)}</span>
              <span className="sr-only">{formatMinutes(d.seconds)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card tone="soft">
        <div className="rec">
          <Icon name="sparkle" />
          <div>
            <h2>{rec.title}</h2>
            <p>{rec.text}</p>
            <a className="btn btn--sm btn--primary" href={rec.action.href}>
              {rec.action.label}
            </a>
          </div>
        </div>
      </Card>

      <Card>
        <h2>Módulo actual</h2>
        <p className="eyebrow">
          Etapa {stage.id} · {stage.title} ({stage.level})
        </p>
        <h3>{mod.title}</h3>
        <p className="muted">{mod.summary}</p>
        <p className="small">
          <Icon name="target" size={14} /> Próximo hito: {nextMilestone}
        </p>
        <a href="#/ruta" className="link">Ver la ruta completa →</a>
      </Card>

      <Card>
        <h2>Expresiones (chunks)</h2>
        <div className="chunk-counts">
          <div>
            <strong>{counts.learning}</strong>
            <span>aprendiendo</span>
          </div>
          <div>
            <strong>{counts.review}</strong>
            <span>en práctica</span>
          </div>
          <div>
            <strong>{counts.mastered}</strong>
            <span>dominadas</span>
          </div>
        </div>
        <p className="muted small">«Dominada» exige producirla sin ayuda, de forma espontánea, en contextos distintos y recordarla durante semanas. De {counts.total} expresiones del curso.</p>
        <a href="#/biblioteca" className="link">Abrir la biblioteca →</a>
      </Card>

      <Card>
        <h2>Competencias</h2>
        {(['listening', 'speaking', 'reading', 'writing'] as const).map((k) => {
          const s = skill(k);
          const label = { listening: 'Comprensión auditiva', speaking: 'Expresión oral', reading: 'Lectura', writing: 'Escritura' }[k];
          return (
            <div key={k} className="skill-row">
              <div className="row row--between">
                <span>{label}</span>
                <span className="muted small">{s.evidence ? `${Math.round(s.score * 100)} % · ${s.evidence} evidencias` : 'sin datos aún'}</span>
              </div>
              <Bar value={s.score} label={label} small tone={s.evidence ? 'accent' : 'muted'} />
            </div>
          );
        })}
        <p className="muted small">Rendimiento reciente en ejercicios sin ayuda. Detalle completo en Progreso.</p>
      </Card>

      {state.diagnostics.length === 0 && (
        <Card tone="warn">
          <h2>Haz el diagnóstico</h2>
          <p>Una prueba de 5–10 minutos para estimar tu punto de partida y recomendarte dónde empezar.</p>
          <a className="btn btn--primary btn--sm" href="#/diagnostico">Empezar diagnóstico</a>
        </Card>
      )}
    </div>
  );
}
