/**
 * Pruebas de integridad del contenido: ids únicos, referencias existentes,
 * ejercicios con respuesta, lecciones completas y prerrequisitos coherentes.
 */
import { describe, expect, it } from 'vitest';
import { CHUNKS, LESSONS, MODULES, allExercises, chunkById, chunkHome } from '../src/content/course';
import { descriptorById } from '../src/content/descriptors';
import { CONVERSATIONS } from '../src/content/conversations';
import { DIAGNOSTIC } from '../src/content/diagnostic';
import { MINIMAL_PAIRS } from '../src/content/pronunciation';
import { checkAnswer, expandTemplate, wordCount } from '../src/engine/answer';
import { findChunkInExample, usesChunk } from '../src/engine/generate';
import type { Exercise } from '../src/types/content';

const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

describe('chunks', () => {
  it('tienen ids únicos', () => {
    expect(dupes(CHUNKS.map((c) => c.id))).toEqual([]);
  });

  it('tienen todos los campos pedagógicos', () => {
    for (const c of CHUNKS) {
      expect(c.en.trim(), c.id).not.toBe('');
      expect(c.es.trim(), c.id).not.toBe('');
      expect(c.core.trim(), c.id).not.toBe('');
      expect(c.variants.length, `${c.id} variantes`).toBeGreaterThanOrEqual(2);
      expect(c.errors.length, `${c.id} errores`).toBeGreaterThanOrEqual(1);
      expect(c.ask.trim(), c.id).not.toBe('');
      expect(c.task.trim(), c.id).not.toBe('');
    }
  });

  it('su ejemplo contiene la expresión (para poder generar ejercicios)', () => {
    for (const c of CHUNKS) {
      expect(usesChunk(c.example.en, c), `${c.id}: «${c.example.en}» no contiene «${c.core}»`).toBe(true);
      expect(findChunkInExample(c), `${c.id}: no se localiza el chunk en el ejemplo`).not.toBeNull();
    }
  });

  it('la forma corregida de su error frecuente no se confunde con el error', () => {
    for (const c of CHUNKS) {
      for (const e of c.errors) expect(e.wrong, c.id).not.toBe(e.right);
    }
  });

  it('todos se enseñan en una lección o aparecen como extra de un módulo', () => {
    const orphan = CHUNKS.filter((c) => !chunkHome.has(c.id)).map((c) => c.id);
    expect(orphan).toEqual([]);
  });
});

describe('lecciones y módulos', () => {
  it('tienen ids únicos', () => {
    expect(dupes(MODULES.map((m) => m.id))).toEqual([]);
    expect(dupes(MODULES.flatMap((m) => m.units.map((u) => u.id)))).toEqual([]);
    expect(dupes(LESSONS.map((l) => l.lesson.id))).toEqual([]);
  });

  it('los ejercicios tienen ids únicos en todo el curso', () => {
    expect(dupes(allExercises().map((e) => e.id))).toEqual([]);
  });

  it('cada lección está completa', () => {
    for (const { lesson: l } of LESSONS) {
      expect(l.newChunks.length, `${l.id} chunks nuevos`).toBeGreaterThanOrEqual(3);
      expect(l.newChunks.length, `${l.id} chunks nuevos`).toBeLessThanOrEqual(5);
      expect(l.context.lines.length, `${l.id} diálogo`).toBeGreaterThanOrEqual(4);
      expect(l.context.gist.length, `${l.id} comprensión`).toBeGreaterThanOrEqual(1);
      expect(l.production.length, `${l.id} producción`).toBeGreaterThanOrEqual(1);
      expect(l.assessment.length, `${l.id} evaluación`).toBeGreaterThanOrEqual(3);
      expect(l.victory.targets.length, `${l.id} victoria`).toBeGreaterThanOrEqual(1);
      for (const d of l.descriptors) expect(descriptorById.has(d), `${l.id} descriptor ${d}`).toBe(true);
    }
  });

  it('no hay referencias a chunks inexistentes', () => {
    const refs: [string, string][] = [];
    for (const m of MODULES) {
      for (const id of m.extraChunks ?? []) refs.push([m.id, id]);
      for (const u of m.units) {
        for (const l of u.lessons) {
          for (const id of [...l.newChunks, ...l.victory.targets]) refs.push([l.id, id]);
        }
      }
    }
    for (const e of allExercises()) {
      for (const id of e.chunks ?? []) refs.push([e.id, id]);
      if (e.kind === 'open') for (const id of e.targets ?? []) refs.push([e.id, id]);
    }
    const missing = refs.filter(([, id]) => !chunkById.has(id));
    expect(missing).toEqual([]);
  });

  it('un chunk nuevo no se vuelve a presentar como nuevo en otra lección', () => {
    expect(dupes(LESSONS.flatMap((l) => l.lesson.newChunks))).toEqual([]);
  });

  it('cada unidad y módulo tienen evaluación', () => {
    for (const m of MODULES) {
      expect(m.assessment.length, m.id).toBeGreaterThanOrEqual(5);
      expect(m.assessment.some((e) => e.kind === 'open'), `${m.id} producción libre`).toBe(true);
      expect(m.assessment.some((e) => e.kind === 'listen' || (e.kind === 'choice' && e.audio)), `${m.id} audio`).toBe(true);
      for (const u of m.units) expect(u.checkpoint.length, u.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('los prerrequisitos existen y apuntan a módulos anteriores', () => {
    MODULES.forEach((m, i) => {
      for (const p of m.prereq) {
        const j = MODULES.findIndex((x) => x.id === p);
        expect(j, `${m.id} → ${p}`).toBeGreaterThanOrEqual(0);
        expect(j, `${m.id} → ${p}`).toBeLessThan(i);
      }
      if (i > 0) expect(m.prereq.length, `${m.id} sin prerrequisito`).toBeGreaterThan(0);
    });
  });

  it('la opción múltiple no domina las lecciones', () => {
    for (const { lesson: l } of LESSONS) {
      const all = [...l.context.gist, ...(l.practice ?? []), ...l.production, ...l.assessment];
      const choices = all.filter((e) => e.kind === 'choice').length;
      expect(choices / all.length, l.id).toBeLessThanOrEqual(0.4);
    }
  });
});

function checkExercise(e: Exercise) {
  switch (e.kind) {
    case 'type':
      expect(e.accept.length, e.id).toBeGreaterThan(0);
      for (const a of e.accept) expect(expandTemplate(a).length, `${e.id} plantilla`).toBeLessThan(256);
      break;
    case 'choice':
      expect(e.options.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.answer, e.id).toBeGreaterThanOrEqual(0);
      expect(e.answer, e.id).toBeLessThan(e.options.length);
      expect(dupes(e.options), e.id).toEqual([]);
      break;
    case 'order':
      expect(wordCount(e.sentence), e.id).toBeGreaterThanOrEqual(3);
      break;
    case 'listen':
      expect(e.text.trim(), e.id).not.toBe('');
      expect(checkAnswer(e.text, e.accept ?? [e.text]).result, `${e.id}: el texto debe aceptarse`).toBe('correct');
      break;
    case 'open':
      expect(e.model.trim(), e.id).not.toBe('');
      expect(e.minWords, e.id).toBeGreaterThan(0);
      if (e.targets?.length) {
        const ok = e.targets.some((t) => usesChunk(e.model, chunkById.get(t)!));
        expect(ok, `${e.id}: el modelo no usa ninguno de sus chunks objetivo`).toBe(true);
      }
      break;
    case 'speak':
      expect(e.text.trim(), e.id).not.toBe('');
      break;
  }
}

describe('ejercicios', () => {
  it('todas las preguntas tienen respuesta válida', () => {
    for (const e of allExercises()) checkExercise(e);
  });

  it('las plantillas de respuesta están bien formadas', () => {
    const bad: string[] = [];
    for (const e of allExercises()) {
      const list = e.kind === 'type' ? e.accept : e.kind === 'listen' || e.kind === 'order' ? e.accept ?? [] : [];
      for (const a of list) {
        // «|» solo dentro de {…}; paréntesis y llaves equilibrados; sin anidar.
        if (/\([^)]*\|[^)]*\)/.test(a) || /\{[^}]*[({][^}]*\}/.test(a)) bad.push(`${e.id}: ${a}`);
        if ((a.match(/\(/g) ?? []).length !== (a.match(/\)/g) ?? []).length) bad.push(`${e.id}: ${a}`);
        if ((a.match(/\{/g) ?? []).length !== (a.match(/\}/g) ?? []).length) bad.push(`${e.id}: ${a}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('la primera respuesta aceptada de cada ejercicio se reconoce como correcta', () => {
    for (const e of allExercises()) {
      if (e.kind !== 'type') continue;
      const first = expandTemplate(e.accept[0])[0];
      if (first.includes('*') || first.includes('#')) continue;
      expect(checkAnswer(first, e.accept, e.keys, e.anyOf).result, e.id).toBe('correct');
    }
  });
});

describe('diagnóstico, conversación y pronunciación', () => {
  it('el diagnóstico tiene preguntas abiertas y no solo opción múltiple', () => {
    expect(DIAGNOSTIC.length).toBeGreaterThanOrEqual(10);
    expect(DIAGNOSTIC.filter((d) => d.ex.kind === 'open').length).toBeGreaterThanOrEqual(2);
    expect(DIAGNOSTIC.filter((d) => d.ex.kind === 'choice').length / DIAGNOSTIC.length).toBeLessThan(0.5);
    expect(dupes(DIAGNOSTIC.map((d) => d.ex.id))).toEqual([]);
    for (const d of DIAGNOSTIC) checkExercise(d.ex);
  });

  it('las conversaciones ramificadas no tienen nodos rotos', () => {
    expect(dupes(CONVERSATIONS.map((c) => c.id))).toEqual([]);
    for (const c of CONVERSATIONS) {
      const ids = new Set(c.nodes.map((n) => n.id));
      expect(ids.has(c.start), c.id).toBe(true);
      expect(dupes(c.nodes.map((n) => n.id)), c.id).toEqual([]);
      for (const n of c.nodes) {
        if (n.next) expect(ids.has(n.next), `${c.id}/${n.id} → ${n.next}`).toBe(true);
        for (const b of n.branches ?? []) expect(ids.has(b.next), `${c.id}/${n.id} → ${b.next}`).toBe(true);
        for (const t of n.targets ?? []) expect(chunkById.has(t), `${c.id}/${n.id} chunk ${t}`).toBe(true);
      }
      expect(c.nodes.some((n) => !n.next && !n.branches?.length), `${c.id} sin final`).toBe(true);
      expect(MODULES.some((m) => m.id === c.module), `${c.id} módulo`).toBe(true);
    }
  });

  it('los pares mínimos están completos', () => {
    expect(dupes(MINIMAL_PAIRS.map((p) => p.id))).toEqual([]);
    for (const p of MINIMAL_PAIRS) {
      expect(p.pairs.length, p.id).toBeGreaterThanOrEqual(4);
      for (const [a, b] of p.pairs) expect(a, p.id).not.toBe(b);
    }
  });
});

describe('resumen', () => {
  it('muestra el tamaño del contenido', () => {
    const byLevel: Record<string, number> = {};
    for (const c of CHUNKS) byLevel[c.level] = (byLevel[c.level] ?? 0) + 1;
    const units = MODULES.reduce((a, m) => a + m.units.length, 0);
    console.log(`Contenido: ${MODULES.length} módulos, ${units} unidades, ${LESSONS.length} lecciones, ${CHUNKS.length} chunks ${JSON.stringify(byLevel)}, ${allExercises().length} ejercicios escritos, ${CONVERSATIONS.length} conversaciones`);
    expect(LESSONS.length).toBeGreaterThan(0);
  });
});
