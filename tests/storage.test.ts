import { describe, expect, it } from 'vitest';
import { createInitialState, exportBackup, loadState, parseBackup, saveState, STORAGE_KEY, validateState } from '../src/storage/store';
import { completeLesson, introduceChunks, recordAttempt } from '../src/engine/progress';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('almacenamiento', () => {
  it('guarda y recupera el progreso', () => {
    const mem = new MemoryStorage();
    let s = createInitialState(1000);
    s = introduceChunks(s, ['hi-im'], 1000);
    s = recordAttempt(s, { ref: 'x', skills: ['writing'], score: 1, grade: 'unaided', chunks: [{ id: 'hi-im', grade: 'unaided' }] }, 2000);
    s = completeLesson(s, 'a1-l1', { score: 0.8, recalled: ['hi-im'], hinted: [], missed: [] }, 3000);
    expect(saveState(s, mem)).toBe(true);
    const loaded = loadState(mem);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.fresh).toBe(false);
      expect(loaded.state.lessons['a1-l1'].score).toBe(0.8);
      expect(loaded.state.chunks['hi-im'].counts.unaided).toBe(1);
    }
  });

  it('detecta datos dañados sin lanzar excepciones', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORAGE_KEY, '{not json');
    const r = loadState(mem);
    expect(r.ok).toBe(false);
    mem.setItem(STORAGE_KEY, JSON.stringify({ version: 1, chunks: 'x' }));
    const r2 = loadState(mem);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.problems.length).toBeGreaterThan(0);
  });

  it('valida un estado nuevo', () => {
    expect(validateState(createInitialState())).toEqual([]);
  });

  it('exporta e importa una copia de seguridad', () => {
    let s = createInitialState(1000);
    s = { ...s, name: 'Diego' };
    const text = exportBackup(s);
    const r = parseBackup(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.name).toBe('Diego');
  });

  it('rechaza copias de otra aplicación o dañadas', () => {
    expect(parseBackup('hola').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'otra', state: createInitialState() })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'english-journey', state: { version: 1 } })).ok).toBe(false);
  });

  it('completa campos que falten al migrar', () => {
    const mem = new MemoryStorage();
    const s = createInitialState(1000) as unknown as Record<string, unknown>;
    s.settings = { theme: 'dark' };
    mem.setItem(STORAGE_KEY, JSON.stringify(s));
    const r = loadState(mem);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.settings.theme).toBe('dark');
      expect(r.state.settings.rate).toBeGreaterThan(0);
    }
  });
});
