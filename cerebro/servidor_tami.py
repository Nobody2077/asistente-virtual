"""
servidor_tami.py — la "memoria de Unifranz" de Tami.

Tami (Electron, JavaScript) no puede abrir la base de datos de Chroma directamente: Chroma y el
modelo de embeddings viven en Python. Este servidor pequeño hace de puente.

    GET  /estado     -> {"listo": true} cuando Chroma y el modelo de embeddings ya cargaron
    POST /buscar     -> {"pregunta": "...", "k": 4}  =>  {"resultados": [{texto, titulo, url, distancia, ...}]}
    GET  /carreras   -> el catálogo cerrado de carreras (carreras.json, lo arma armar_catalogo.py)

No carga ningún modelo de lenguaje: el que conversa es Qwen3.5-9B en LM Studio.
La búsqueda es la misma de LLMLocalUnifranz (app/buscar.py): no se copia, se importa.

Uso (lo hace INICIAR_TAMI.bat):
    set PYTHONPATH=..\\..\\windows\\libs;..\\..\\windows\\rag_libs
    ..\\..\\windows\\python\\python.exe servidor_tami.py
"""

import json
import os
import sys
import threading
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent                      # G:\Desarrollo\LLMLocalUnifranz
os.environ.setdefault("CAPRI_RAG_DB", str(RAIZ / "datos" / "DB"))
os.environ.setdefault("CAPRI_RAG_MODELO", str(RAIZ / "modelos" / "multilingual-e5-small-Q8_0.gguf"))
sys.path.insert(0, str(RAIZ / "app"))

from flask import Flask, jsonify, request  # noqa: E402
import buscar as rag  # noqa: E402

PUERTO = int(os.environ.get("TAMI_PUERTO", "8766"))
CARRERAS = json.loads((AQUI / "carreras.json").read_text(encoding="utf-8"))

app = Flask(__name__)
bloqueo = threading.Lock()   # Chroma + embeddings: una búsqueda a la vez
listo = False


def precargar():
    """Carga Chroma y el modelo de embeddings apenas arranca, para que la 1.ª pregunta no tarde."""
    global listo
    inicio = time.time()
    with bloqueo:
        rag.buscar("¿Qué carreras tiene Unifranz?", 1)
    listo = True
    print(f"[tami] Memoria de Unifranz lista en {time.time() - inicio:.1f} s", flush=True)


def dentro_de(url, pregunta, k):
    """Los pedazos de UNA página (por su url) más parecidos a la pregunta. Mismo formato que rag.buscar."""
    import numpy as np
    rag._cargar()
    v = np.array(rag._modelo.embed("query: " + pregunta, truncate=True), dtype=np.float32)
    r = rag._col.query(query_embeddings=[(v / np.linalg.norm(v)).tolist()], n_results=k, where={"url": url})
    return [dict(texto=d, distancia=round(x, 3), **m)
            for d, m, x in zip(r["documents"][0], r["metadatas"][0], r["distances"][0])]


@app.get("/estado")
def estado():
    return jsonify({"listo": listo, "carreras": len(CARRERAS)})


@app.get("/carreras")
def carreras():
    return jsonify(CARRERAS)


@app.post("/buscar")
def buscar():
    datos = request.get_json(force=True) or {}
    pregunta = str(datos.get("pregunta") or "").strip()[:500]
    if not pregunta:
        return jsonify({"error": "falta la pregunta"}), 400
    k = max(1, min(int(datos.get("k") or 4), 8))
    url = str(datos.get("url") or "").strip()
    try:
        with bloqueo:
            if url:  # buscar SOLO dentro de esa página («¿hay becas?» → la página de Becas, no una noticia)
                return jsonify({"resultados": dentro_de(url, pregunta, k)})
            return jsonify({"resultados": rag.buscar(pregunta, k)})
    except Exception as e:  # que Tami diga «no pude revisar los datos», no que se cuelgue
        return jsonify({"error": f"sin datos de Unifranz: {e}"}), 503


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    threading.Thread(target=precargar, daemon=True).start()
    print(f"[tami] Memoria de Unifranz en http://127.0.0.1:{PUERTO}  ({len(CARRERAS)} carreras)", flush=True)
    app.run(host="127.0.0.1", port=PUERTO, debug=False, threaded=True)
