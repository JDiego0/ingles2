import { describe, expect, it } from 'vitest';
import { cleanTranscript, prepareAudio } from '../src/speech/stt';

const RATE = 16000;
/** Señal de prueba: tramos de silencio (0) y de «voz» (seno) en segundos. */
function signal(parts: [number, number][]): Float32Array {
  const out: number[] = [];
  for (const [secs, amp] of parts) for (let i = 0; i < secs * RATE; i++) out.push(amp * Math.sin(i / 5));
  return Float32Array.from(out);
}

describe('micrófono en el teléfono: preparar la grabación', () => {
  it('si solo hay silencio o ruido muy bajo, avisa de que no te escuchó', () => {
    expect(prepareAudio(signal([[3, 0]]))).toBeNull();
    expect(prepareAudio(signal([[3, 0.003]]))).toBeNull();
  });

  it('quita el silencio del principio y del final', () => {
    const chunks = prepareAudio(signal([[2, 0], [1.5, 0.3], [3, 0]]))!;
    expect(chunks).toHaveLength(1);
    const secs = chunks[0].length / RATE;
    expect(secs).toBeGreaterThan(1.5);
    expect(secs).toBeLessThan(2.3);
  });

  it('una pausa en medio de la respuesta se conserva', () => {
    const chunks = prepareAudio(signal([[1, 0.3], [2, 0], [1, 0.3]]))!;
    expect(chunks[0].length / RATE).toBeGreaterThan(3.9);
  });

  it('parte las grabaciones largas en trozos de 20 s como máximo, por una pausa', () => {
    const chunks = prepareAudio(signal([[14, 0.3], [0.5, 0], [14, 0.3]]))!;
    expect(chunks.length).toBe(2);
    for (const c of chunks) expect(c.length / RATE).toBeLessThanOrEqual(20);
    expect(chunks[0].length / RATE).toBeGreaterThan(13.9);
  });

  it('limpia las marcas de ruido del modelo', () => {
    expect(cleanTranscript(' [BLANK_AUDIO] ')).toBe('');
    expect(cleanTranscript('I work (coughs) from home.')).toBe('I work from home.');
  });
});
