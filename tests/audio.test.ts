import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { audioId, audioKey } from '../src/speech/audio';

describe('audio pregrabado', () => {
  it('la misma frase con «…» o espacios extra usa el mismo archivo', () => {
    expect(audioKey('  I’d like…  a coffee ')).toBe('I’d like a coffee');
    expect(audioId('Let me check.')).toBe(audioId(' Let  me check. '));
    expect(audioId('Let me check.')).not.toBe(audioId('Let me check!'));
    expect(audioId('Let me check.')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('los ids del corpus coinciden con los que calcula la app', () => {
    const path = 'scripts/audio-corpus.json';
    if (!existsSync(path)) return;
    const corpus: Record<string, string> = JSON.parse(readFileSync(path, 'utf-8'));
    for (const [id, text] of Object.entries(corpus).slice(0, 200)) expect(audioId(text)).toBe(id);
  });
});
