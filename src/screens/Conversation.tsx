import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../state/ProgressContext';
import { CONVERSATIONS } from '../content/conversations';
import { chunkById, moduleById } from '../content/course';
import { maxDepth, nextNode, nodeById, tooShort } from '../engine/conversation';
import { detectErrors, topErrors, type DetectedError } from '../engine/errors';
import { wordOverlap } from '../engine/answer';
import { moduleUnlocked } from '../engine/unlock';
import { speak, ttsAvailable } from '../speech/tts';
import { Icon } from '../components/Icon';
import { Card, Chip, Empty, PageHeader, Verdict } from '../components/ui';
import { VoiceInput } from '../components/VoiceInput';
import { navigate } from '../router';

export function ConversationList() {
  const { state } = useProgress();
  return (
    <div className="stack">
      <PageHeader title="Conversación" subtitle="Practica sin guion: responde con tus palabras." back="#/practicar" />
      <Verdict kind="info">
        Son <strong>simulaciones con diálogos predefinidos</strong>, no inteligencia artificial: el interlocutor elige su respuesta según palabras clave de lo que digas.
        Por eso a veces no reaccionará a todo lo que escribas.
      </Verdict>
      <ul className="conv-list">
        {CONVERSATIONS.map((c) => {
          const m = moduleById.get(c.module)!;
          const open = moduleUnlocked(state, m);
          const history = state.conversations[c.id] ?? [];
          return (
            <li key={c.id}>
              {open ? (
                <a className="conv-item" href={`#/conversar/${c.id}`}>
                  <div>
                    <strong>{c.title}</strong>
                    <span className="muted small">{c.situation}</span>
                  </div>
                  <div className="conv-item__meta">
                    <Chip tone="accent">{c.level}</Chip>
                    {history.length > 0 && <span className="small muted">{history.length}× hecha</span>}
                  </div>
                </a>
              ) : (
                <div className="conv-item is-locked">
                  <div>
                    <strong>
                      <Icon name="lock" size={14} /> {c.title}
                    </strong>
                    <span className="muted small">Se abre con el módulo «{m.title}».</span>
                  </div>
                  <Chip>{c.level}</Chip>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface Turn {
  who: 'partner' | 'me' | 'note';
  text: string;
  es?: string;
  helped?: boolean;
}

export function ConversationPlayer({ id }: { id: string }) {
  const { state, act } = useProgress();
  const conv = CONVERSATIONS.find((c) => c.id === id);
  const [nodeId, setNodeId] = useState<string | null>(conv?.start ?? null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [help, setHelp] = useState(0);
  const [canHelp, setCanHelp] = useState(false);
  const [askedMore, setAskedMore] = useState(false);
  const [listenMode, setListenMode] = useState(false);
  const [showEs, setShowEs] = useState(false);
  const [mustRephrase, setMustRephrase] = useState(false);
  const [errors, setErrors] = useState<DetectedError[]>([]);
  const [stats, setStats] = useState({ turns: 0, independent: 0, chunks: new Set<string>() });
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const node = conv && nodeId ? nodeById(conv, nodeId) : undefined;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, help]);

  // Mostrar la intervención del interlocutor al llegar a un nodo.
  useEffect(() => {
    if (!started || !node) return;
    setTurns((t) => [...t, { who: 'partner', text: node.say, es: node.sayEs }]);
    setHelp(0);
    setCanHelp(false);
    setAskedMore(false);
    setMustRephrase(false);
    if (state.settings.autoplay && ttsAvailable()) speak(node.say, { rate: state.settings.rate, voiceURI: state.settings.voiceURI });
    const t = setTimeout(() => setCanHelp(true), 20_000);
    return () => clearTimeout(t);
  }, [nodeId, started]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!conv) return <Empty icon="alert" title="Conversación no encontrada" text="" action={<a className="btn" href="#/conversar">Volver</a>} />;
  const m = moduleById.get(conv.module)!;
  if (!moduleUnlocked(state, m)) return <Empty icon="lock" title="Todavía no disponible" text={`Se abre con el módulo «${m.title}».`} action={<a className="btn" href="#/conversar">Volver</a>} />;

  if (!started) {
    return (
      <div className="stack">
        <PageHeader title={conv.title} back="#/conversar" />
        <Card>
          <p className="eyebrow">Situación</p>
          <p>{conv.situation}</p>
          <p className="eyebrow">Tu objetivo</p>
          <p>{conv.goal}</p>
          <p className="muted small">~{maxDepth(conv)} intervenciones. Si te bloqueas, la ayuda aparece después de intentarlo.</p>
        </Card>
        <label className="toggle">
          <input type="checkbox" checked={listenMode} onChange={(e) => setListenMode(e.target.checked)} disabled={!ttsAvailable()} /> Modo escucha: ocultar el texto de {conv.partner}
        </label>
        <button className="btn btn--primary btn--block btn--lg" onClick={() => setStarted(true)}>
          <Icon name="chat" /> Empezar
        </button>
      </div>
    );
  }

  const send = () => {
    if (!node || !text.trim()) return;
    const answer = text.trim();
    setCanHelp(true);
    if (help >= 3 && wordOverlap(answer, node.model) > 0.85) {
      setMustRephrase(true);
      return;
    }
    if (tooShort(node, answer) && !askedMore) {
      setTurns((t) => [...t, { who: 'me', text: answer }, { who: 'partner', text: 'Sorry, can you tell me a little more?', es: 'Perdón, ¿me cuentas un poco más?' }]);
      setAskedMore(true);
      setText('');
      return;
    }
    const helped = help > 0;
    const found = act.recordFreeText(`conv.${conv.id}.${node.id}`, answer, {
      targets: node.targets,
      helped,
      ctx: 'conversation',
      prompt: node.say,
      mode: 'text',
      skills: ['fluency', 'speaking'],
    });
    setErrors((e) => [...e, ...detectErrors(answer)]);
    setStats((s) => ({ turns: s.turns + 1, independent: s.independent + (helped ? 0 : 1), chunks: new Set([...s.chunks, ...found]) }));
    const tr = nextNode(node, answer);
    const newTurns: Turn[] = [{ who: 'me', text: answer, helped }];
    if (tr.react) newTurns.push({ who: 'partner', text: tr.react });
    setTurns((t) => [...t, ...newTurns]);
    setText('');
    if (tr.next) setNodeId(tr.next);
    else {
      setNodeId(null);
      setFinished(true);
      act.recordConversation(conv.id, { t: Date.now(), turns: stats.turns + 1, independent: stats.independent + (helped ? 0 : 1) });
    }
  };

  if (finished) {
    const top = topErrors(errors, 3);
    const used = [...stats.chunks].map((cid) => chunkById.get(cid)?.en).filter(Boolean);
    return (
      <div className="stack">
        <div className="victory">
          <Icon name="chat" size={32} />
          <h2>Conversación terminada</h2>
          <p>
            Respondiste {stats.independent} de {stats.turns} intervenciones sin ayuda.
          </p>
        </div>
        <Card>
          <h3>Expresiones que usaste</h3>
          <p lang="en">{used.length ? used.join(' · ') : 'No detectamos expresiones del curso. ¡Intenta usarlas la próxima vez!'}</p>
        </Card>
        <Card>
          <h3>Los errores más importantes</h3>
          {top.length ? (
            top.map((e) => (
              <p key={e.key}>
                <del lang="en">{e.found}</del> → <ins lang="en">{e.fix}</ins>
                <br />
                <span className="muted small">{e.why}</span>
              </p>
            ))
          ) : (
            <p className="muted">No detectamos errores frecuentes. (La detección es automática y limitada.)</p>
          )}
        </Card>
        <details className="details">
          <summary>Ver la conversación completa</summary>
          <Transcript turns={turns} listenMode={false} showEs={false} />
        </details>
        <button className="btn btn--primary btn--block" onClick={() => navigate('#/conversar')}>
          Otra conversación
        </button>
        <button
          className="btn btn--ghost btn--block"
          onClick={() => {
            setTurns([]);
            setErrors([]);
            setStats({ turns: 0, independent: 0, chunks: new Set() });
            setFinished(false);
            setNodeId(conv.start);
          }}
        >
          Repetir con otras respuestas
        </button>
      </div>
    );
  }

  return (
    <div className="chat-screen">
      <header className="player__top">
        <a className="icon-btn" href="#/conversar" aria-label="Salir de la conversación">
          <Icon name="x" />
        </a>
        <div className="player__title">
          <strong>{conv.partner}</strong>
          <span className="muted small">{conv.title}</span>
        </div>
        <button className="icon-btn" onClick={() => setShowEs((v) => !v)} aria-pressed={showEs} aria-label="Mostrar traducción">
          <Icon name="translate" />
        </button>
      </header>
      <Transcript turns={turns} listenMode={listenMode} showEs={showEs} />
      <div ref={endRef} />
      {node && (
        <div className="composer">
          {help >= 1 && (
            <div className="help-box">
              <p>
                <Icon name="bulb" size={14} /> {node.hint}
              </p>
              {help >= 2 && <p className="frame" lang="en">{node.frame}</p>}
              {help >= 3 && (
                <p className="reveal__text" lang="en">
                  {node.model}
                  <br />
                  <span className="muted small">Ahora respóndelo con tus palabras (no copies el ejemplo).</span>
                </p>
              )}
              {node.targets && help >= 1 && (
                <p className="small muted" lang="en">
                  Útil: {node.targets.map((t) => chunkById.get(t)?.en).join(' · ')}
                </p>
              )}
            </div>
          )}
          {mustRephrase && <Verdict kind="close">Cámbialo un poco: usa tus propios datos.</Verdict>}
          <div className="row">
            <textarea
              className="input grow"
              rows={2}
              lang="en"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tu respuesta en inglés…"
              aria-label="Tu respuesta"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
          </div>
          <div className="row">
            <VoiceInput compact onText={(t) => setText((p) => (p ? p + ' ' : '') + t)} />
            <button className="btn btn--ghost" onClick={() => setHelp((h) => Math.min(3, h + 1))} disabled={!canHelp || help >= 3}>
              <Icon name="bulb" size={16} /> {help === 0 ? (canHelp ? 'Pista' : 'Inténtalo…') : help === 1 ? 'Estructura' : 'Ejemplo'}
            </button>
            {ttsAvailable() && (
              <button className="btn btn--ghost btn--icon" onClick={() => speak(node.say, { rate: state.settings.rate - 0.2, voiceURI: state.settings.voiceURI })} aria-label="Escuchar otra vez, despacio">
                <Icon name="ear" size={18} />
              </button>
            )}
            <button className="btn btn--primary grow" onClick={send} disabled={!text.trim()}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Transcript({ turns, listenMode, showEs }: { turns: Turn[]; listenMode: boolean; showEs: boolean }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  return (
    <ol className="dialogue chat" aria-live="polite">
      {turns.map((t, i) => (
        <li key={i} className={`bubble ${t.who === 'me' ? 'bubble--right bubble--me' : ''}`}>
          {t.who === 'partner' && listenMode && !revealed[i] ? (
            <button className="link-btn" onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}>
              <Icon name="ear" size={14} /> Mostrar texto
            </button>
          ) : (
            <p lang="en">{t.text}</p>
          )}
          {showEs && t.es && <p className="bubble__es">{t.es}</p>}
          {t.helped && <span className="small muted">con ayuda</span>}
        </li>
      ))}
    </ol>
  );
}

