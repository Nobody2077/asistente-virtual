"""
servidor_voz.py — la voz de Tami (Kokoro, sin internet).

    POST /hablar   {"texto": "Hola, soy Tami."}   →  audio/wav
    GET  /estado   →  {"lista": true, "voz": {...}}

Qué voz usa lo dice voz.json (mezcla de voces de Kokoro + tono), para cambiarla sin tocar código:
    {"mezcla": {"ef_dora": 0.6, "af_bella": 0.4}, "tono": 1.04, "velocidad": 1.03}
Ver voces_jovenes.py: ahí se explica la mezcla y el truco del tono.

Uso (lo hace INICIAR_TAMI.bat):  .venv\\Scripts\\python.exe servidor_voz.py
"""

import io
import json
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
            return self._responder(200, json.dumps({"lista": True, "voz": CONFIG}).encode(), "application/json")
        self._responder(404, b"{}", "application/json")

    def do_POST(self):
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

    def log_message(self, *args):  # sin una línea por cada pedido
        pass


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sintetizar("Hola.")  # calienta el modelo
    print(f"[voz] Tami habla en http://127.0.0.1:{PUERTO}  voz={CONFIG}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PUERTO), Manejador).serve_forever()
