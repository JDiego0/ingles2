"""
Genera public/audio/<id>.mp3 para cada frase de scripts/audio-corpus.json con la voz
neuronal Kokoro (licencia Apache 2.0). Solo crea los archivos que faltan y borra los
que ya no están en el corpus, así que se puede volver a ejecutar tras cambiar el contenido.

Requisitos (una vez):
  pip install kokoro-onnx lameenc
  Descarga kokoro-v1.0.onnx y voices-v1.0.bin de
  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

Uso:
  node scripts/audio-corpus.mjs
  python scripts/make-audio.py --models <carpeta con los dos archivos>
"""
import argparse
import json
import sys
import time
from pathlib import Path

import lameenc
import numpy as np
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
# Mezcla de dos voces femeninas en-US: cálida y clara.
VOICE_FEMALE = {"af_heart": 0.7, "af_bella": 0.3}
# Mezcla de dos voces masculinas en-US: clara y cálida.
VOICE_MALE = {"am_michael": 0.7, "am_adam": 0.3}


def encode_mp3(samples: np.ndarray, rate: int) -> bytes:
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    enc = lameenc.Encoder()
    enc.set_bit_rate(40)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm.tobytes()) + enc.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True, type=Path)
    ap.add_argument("--limit", type=int, default=0, help="generar solo N frases (pruebas)")
    args = ap.parse_args()

    corpus: dict[str, str | dict] = json.loads((ROOT / "scripts" / "audio-corpus.json").read_text("utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)

    # Recopilar todos los ids válidos del corpus (incluye ids de voz etiquetados).
    valid_ids: set[str] = set()
    entries: list[tuple[str, str, dict[str, float]]] = []
    for i, val in corpus.items():
        if isinstance(val, str):
            # Formato original: {id: text}
            valid_ids.add(i)
            entries.append((i, val, VOICE_FEMALE))
        elif isinstance(val, dict):
            # Formato extendido: {id: {text, voice}}
            text = val.get("text", "")
            voice_key = val.get("voice", "female")
            voice = VOICE_MALE if voice_key == "male" else VOICE_FEMALE
            valid_ids.add(i)
            entries.append((i, text, voice))

    for f in OUT.glob("*.mp3"):
        if f.stem not in valid_ids:
            f.unlink()

    todo = [(i, t, v) for i, t, v in entries if not (OUT / f"{i}.mp3").exists()]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(entries)} frases, {len(todo)} por generar", flush=True)
    if not todo:
        return

    kokoro = Kokoro(str(args.models / "kokoro-v1.0.onnx"), str(args.models / "voices-v1.0.bin"))
    # Cachear estilos de voz por mezcla para no recalcular.
    style_cache: dict[str, object] = {}
    def get_style(voice_mix: dict[str, float]):
        key = str(sorted(voice_mix.items()))
        if key not in style_cache:
            style_cache[key] = sum(kokoro.get_voice_style(v) * w for v, w in voice_mix.items())
        return style_cache[key]

    start = time.time()
    for n, (i, text, voice_mix) in enumerate(todo, 1):
        try:
            style = get_style(voice_mix)
            samples, rate = kokoro.create(text, voice=style, speed=1.0, lang="en-us")
        except Exception as e:  # noqa: BLE001 — una frase rara no debe parar todo
            print(f"  error en «{text[:40]}»: {e}", file=sys.stderr, flush=True)
            continue
        # Un respiro de silencio al final evita que el último sonido se corte en algunos móviles.
        samples = np.concatenate([samples, np.zeros(int(rate * 0.15), dtype=samples.dtype)])
        tmp = OUT / f"{i}.mp3.tmp"
        tmp.write_bytes(encode_mp3(samples, rate))
        tmp.replace(OUT / f"{i}.mp3")
        if n % 50 == 0 or n == len(todo):
            el = time.time() - start
            print(f"  {n}/{len(todo)} ({el / n:.2f} s/frase, faltan ~{(len(todo) - n) * el / n / 60:.0f} min)", flush=True)


if __name__ == "__main__":
    main()
