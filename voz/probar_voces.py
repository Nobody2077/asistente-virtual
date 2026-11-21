# probar_voces.py — la misma frase con cada motor de voz, para comparar a oído y medir tiempos.
# Uso:  .venv\Scripts\python.exe probar_voces.py      → crea muestras\*.wav / *.mp3
import asyncio
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).parent
SALIDA = AQUI / "muestras"
SALIDA.mkdir(exist_ok=True)
FRASE = ("¡Hola! Soy Tami, tu orientadora de Unifranz. ¿Ya sabes qué carrera quieres estudiar? "
         "Si quieres, te hago unas preguntas y descubrimos juntos qué te apasiona.")


def medir(nombre, funcion):
    inicio = time.time()
    try:
        funcion()
        print(f"{nombre:38s} {time.time() - inicio:5.1f} s")
    except Exception as e:
        print(f"{nombre:38s} FALLÓ: {e}")


def piper_afinado():
    # noise_scale/noise_w más altos = entonación más variada; length_scale > 1 = un poco más pausada
    subprocess.run([str(AQUI / "piper" / "piper.exe"), "-m", str(AQUI / "es_MX-claude-high.onnx"),
                    "--noise_scale", "0.8", "--noise_w", "0.95", "--length_scale", "1.08",
                    "--sentence_silence", "0.25", "-f", str(SALIDA / "A_piper_afinado.wav")],
                   input=FRASE.encode("utf-8"), check=True, capture_output=True)


def kokoro(voz):
    def f():
        import soundfile as sf
        from kokoro_onnx import Kokoro
        k = Kokoro(str(AQUI / "kokoro" / "kokoro-v1.0.onnx"), str(AQUI / "kokoro" / "voices-v1.0.bin"))
        audio, sr = k.create(FRASE, voice=voz, speed=1.0, lang="es")
        sf.write(SALIDA / f"B_kokoro_{voz}.wav", audio, sr)
    return f


def edge(voz):
    def f():
        import edge_tts
        asyncio.run(edge_tts.Communicate(FRASE, voz).save(str(SALIDA / f"C_microsoft_{voz}.mp3")))
    return f


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    medir("A  Piper afinado (sin internet)", piper_afinado)
    medir("B  Kokoro ef_dora (sin internet)", kokoro("ef_dora"))
    medir("C1 Microsoft Sofía, Bolivia (internet)", edge("es-BO-SofiaNeural"))
    medir("C2 Microsoft Dalia, México (internet)", edge("es-MX-DaliaNeural"))
