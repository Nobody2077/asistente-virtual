# voces_jovenes.py — variantes de Kokoro para que Tami suene como una joven y no como una señora.
# Dos trucos:
#   1. MEZCLA: cada voz de Kokoro es un vector de números («estilo»). Promediar el de Dora (español)
#      con el de una voz joven da una voz nueva: pronuncia en español con un timbre más joven.
#   2. TONO: reproducir el audio un poco más rápido sube el tono (más agudo = suena más joven).
#      Para que no hable apurada, se genera un poco más lenta antes. En la app es solo playbackRate.
# Uso:  .venv\Scripts\python.exe voces_jovenes.py   → muestras\joven_*.wav
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

AQUI = Path(__file__).parent
SALIDA = AQUI / "muestras"
FRASE = ("¡Hola! Soy Tami, tu orientadora de Unifranz. ¿Ya sabes qué carrera quieres estudiar? "
         "Si quieres, te hago unas preguntas y descubrimos juntos qué te apasiona.")

VARIANTES = [
    # nombre,                    mezcla de voces,                         tono (1 = igual)
    ("1_dora_tono_mas_alto",      {"ef_dora": 1.0},                         1.07),
    ("2_dora_tono_bastante_alto", {"ef_dora": 1.0},                         1.12),
    ("3_dora_con_bella",          {"ef_dora": 0.6, "af_bella": 0.4},        1.04),
    ("4_dora_con_heart",          {"ef_dora": 0.55, "af_heart": 0.45},      1.05),
    ("5_dora_con_sara",           {"ef_dora": 0.5, "if_sara": 0.5},         1.05),
    ("6_dora_con_nicole",         {"ef_dora": 0.6, "af_nicole": 0.4},       1.05),
]


def subir_tono(audio, factor):
    """Más agudo por `factor` acortando el audio (como reproducirlo más rápido)."""
    if factor == 1:
        return audio
    nuevo = np.arange(0, len(audio) - 1, factor)
    return np.interp(nuevo, np.arange(len(audio)), audio).astype(np.float32)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    k = Kokoro(str(AQUI / "kokoro" / "kokoro-v1.0.onnx"), str(AQUI / "kokoro" / "voices-v1.0.bin"))
    for nombre, mezcla, tono in VARIANTES:
        inicio = time.time()
        estilo = sum(peso * k.get_voice_style(voz) for voz, peso in mezcla.items())
        # se genera más lenta en la misma proporción en que luego se acelera: el ritmo final queda ~1,03
        audio, sr = k.create(FRASE, voice=estilo, speed=1.03 / tono, lang="es")
        sf.write(SALIDA / f"joven_{nombre}.wav", subir_tono(audio, tono), sr)
        print(f"{nombre:28s} {time.time() - inicio:4.1f} s")


if __name__ == "__main__":
    main()
