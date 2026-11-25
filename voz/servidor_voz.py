"""
servidor_voz.py — la voz de Tami (Kokoro, sin internet).

    POST /hablar    {"texto": "Hola, soy Tami."}   →  audio/wav           (la boca: Kokoro)
    POST /escuchar  audio/wav (16 kHz, mono)       →  {"texto": "..."}    (el oído: Whisper)
    GET  /estado    →  {"lista": true, "oido": true, "voz": {...}}

El oído usa faster-whisper «small» en la CPU (la tarjeta de video ya la ocupa el cerebro de 9B). La página
manda el audio YA decodificado (WAV 16 kHz mono), así no hace falta PyAV (su versión nueva rompe faster-whisper).

Qué voz usa lo dice voz.json (mezcla de voces de Kokoro + tono), para cambiarla sin tocar código:
    {"mezcla": {"ef_dora": 0.6, "af_bella": 0.4}, "tono": 1.04, "velocidad": 1.03}
Ver voces_jovenes.py: ahí se explica la mezcla y el truco del tono.

Uso (lo hace INICIAR_TAMI.bat):  .venv\\Scripts\\python.exe servidor_voz.py
"""

import io
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

AQUI = Path(__file__).parent
PUERTO = 8767
CONFIG = {"mezcla": {"ef_dora": 1.0}, "tono": 1.07, "velocidad": 1.03}
if (AQUI / "voz.json").exists():
    CONFIG.update(json.loads((AQUI / "voz.json").read_text(encoding="utf-8")))

kokoro = Kokoro(str(AQUI / "kokoro" / "kokoro-v1.0.onnx"), str(AQUI / "kokoro" / "voices-v1.0.bin"))
ESTILO = sum(peso * kokoro.get_voice_style(voz) for voz, peso in CONFIG["mezcla"].items())
bloqueo = threading.Lock()  # una frase a la vez: la CPU es la misma

# --- el oído (Whisper) ---------------------------------------------------------------------------
# Palabras que Whisper no conoce y confundiría («Unifrance», «Tammy»): se las damos como pista.
PISTA = ("Conversación con Tami, la orientadora de Unifranz en la sede El Alto. Carreras: Medicina, Odontología, "
         "Psicología, Derecho, Ingeniería de Sistemas, Ingeniería Comercial, Bioquímica, Gastronomía. Becas, admisión.")
oido = None
bloqueo_oido = threading.Lock()


def cargar_oido():
    global oido
    # Ya descargado → que NO intente ir a internet (en la feria no hay; si lo intenta puede fallar y dejarla sorda)
    if (AQUI / "whisper" / "models--Systran--faster-whisper-small").exists():
        os.environ["HF_HUB_OFFLINE"] = "1"
    # Se reintenta (25/11): al encender, el cerebro y la memoria se comen la RAM a la vez y la 1.ª carga puede fallar
    for intento in range(1, 9):
        try:
            from faster_whisper import WhisperModel
            oido = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=6,
                                download_root=str(AQUI / "whisper"))
            print("[oido] Whisper listo", flush=True)
            return
        except Exception as e:  # sin oído Tami sigue funcionando con teclado
            print(f"[oido] intento {intento}: NO se pudo cargar Whisper: {e}", flush=True)
            time.sleep(15)


def transcribir(wav_bytes):
    audio, sr = sf.read(io.BytesIO(wav_bytes), dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != 16000:
        n = int(len(audio) * 16000 / sr)
        audio = np.interp(np.linspace(0, len(audio), n, endpoint=False), np.arange(len(audio)), audio).astype(np.float32)
    with bloqueo_oido:
        segmentos, _ = oido.transcribe(audio, language="es", beam_size=1, vad_filter=True,
                                       initial_prompt=PISTA, condition_on_previous_text=False)
        return " ".join(s.text.strip() for s in segmentos).strip()


def sintetizar(texto):
    tono = CONFIG["tono"]
    audio, sr = kokoro.create(texto, voice=ESTILO, speed=CONFIG["velocidad"] / tono, lang="es")
    if tono != 1:  # más agudo acortando el audio (como reproducirlo más rápido)
        audio = np.interp(np.arange(0, len(audio) - 1, tono), np.arange(len(audio)), audio).astype(np.float32)
    salida = io.BytesIO()
    sf.write(salida, audio, sr, format="WAV", subtype="PCM_16")
    return salida.getvalue()


class Manejador(BaseHTTPRequestHandler):
    def _responder(self, codigo, cuerpo, tipo):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Access-Control-Allow-Origin", "*")  # la página de Tami es file://
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/estado":
            estado = {"lista": True, "oido": oido is not None, "voz": CONFIG}
            return self._responder(200, json.dumps(estado).encode(), "application/json")
        self._responder(404, b"{}", "application/json")

    def do_POST(self):
        if self.path == "/escuchar":
            return self._escuchar()
        if self.path != "/hablar":
            return self._responder(404, b"{}", "application/json")
        try:
            datos = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            texto = str(datos.get("texto", "")).strip()[:400]
            if not texto:
                return self._responder(400, b'{"error":"falta el texto"}', "application/json")
            inicio = time.time()
            with bloqueo:
                wav = sintetizar(texto)
            print(f"[voz] {time.time() - inicio:.2f} s  «{texto[:60]}»", flush=True)
            self._responder(200, wav, "audio/wav")
        except Exception as e:
            self._responder(500, json.dumps({"error": str(e)}).encode(), "application/json")

    def _escuchar(self):
        if oido is None:
            return self._responder(503, b'{"error":"el oido aun no esta listo"}', "application/json")
        try:
            wav = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            inicio = time.time()
            texto = transcribir(wav)
            print(f"[oido] {time.time() - inicio:.2f} s  «{texto[:60]}»", flush=True)
            self._responder(200, json.dumps({"texto": texto}, ensure_ascii=False).encode(), "application/json")
        except Exception as e:
            self._responder(500, json.dumps({"error": str(e)}).encode(), "application/json")

    def log_message(self, *args):  # sin una línea por cada pedido
        pass


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sintetizar("Hola.")  # calienta el modelo
    threading.Thread(target=cargar_oido, daemon=True).start()  # el oído carga mientras la voz ya atiende
    print(f"[voz] Tami habla en http://127.0.0.1:{PUERTO}  voz={CONFIG}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PUERTO), Manejador).serve_forever()
