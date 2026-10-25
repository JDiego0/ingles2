/**
 * Grabación de audio local (MediaRecorder) como alternativa cuando no hay reconocimiento de voz:
 * permite escucharte y compararte con el modelo. El audio no sale del dispositivo.
 */

export function recorderAvailable(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export interface Recording {
  stop(): Promise<string>;
}

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) parts.push(e.data);
  };
  rec.start();
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(URL.createObjectURL(new Blob(parts, { type: rec.mimeType || 'audio/webm' })));
        };
        rec.stop();
      }),
  };
}
