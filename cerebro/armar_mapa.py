"""
armar_mapa.py — el «mapa de la memoria» de Tami: los 8093 pedazos de Unifranz como puntos en 2D.

Cada pedazo es un vector de 384 números (su significado). Para dibujarlo en una pantalla hay que bajarlo a 2
números (x, y) sin perder lo importante: que lo parecido quede cerca. Solo tenemos numpy, así que:

  1. K-means (coseno): agrupa los pedazos en GRUPOS temas reales (becas, medicina, noticias de deporte…).
  2. MDS clásico sobre los centros: ubica los temas en el plano (temas parecidos → cerca).
  3. PCA local: dentro de cada tema, reparte sus pedazos alrededor del centro.

Resultado (no se sube al repo: son datos de Unifranz):
  cerebro/mapa_memoria.json   puntos [x, y, grupo, tipo] + etiquetas de los temas  → lo dibuja la animación
  cerebro/mapa_memoria.npz    centros y ejes locales → el servidor ubica una pregunta nueva en el mapa

Uso (Python portátil, como el servidor de memoria):
  set PYTHONPATH=..\\windows\\libs;..\\windows\\rag_libs
  ..\\windows\\python\\python.exe cerebro\\armar_mapa.py
"""

import json
from collections import Counter
from pathlib import Path

import numpy as np

AQUI = Path(__file__).parent
RAIZ = AQUI.parent.parent
GRUPOS = 48
rng = np.random.default_rng(7)  # semilla fija: el mapa sale igual cada vez


def tipo_de(meta):
    url = meta.get("url", "")
    if "/blog/" in url:
        return 3  # noticias
    if "/carreras/" in url:
        return 0  # carreras
    if "/admisiones" in url or "beca" in url or "beneficio" in url or "preguntas" in url:
        return 1  # admisión y becas
    if "/sedes/" in url:
        return 2  # sedes
    return 4      # la universidad (autoridades, vida universitaria…)


VACIAS = set("""unifranz universidad franz tamayo privada bolivia boliviana como cómo para desde sobre entre
hacia porque cuando donde dónde están estudiantes estudiante jóvenes nuevo nueva nuevas nuevos través forma
cada más menos tiene tienen puede pueden hace hacen desarrollan presenta qué cuál cuáles esta este estos estas
solo también parte vida carrera carreras sede sedes primer crean deben lanza haciendo incluyen futures
permanente proteger humanas crítico circular habilidades práctica convierten nuestra estamos basado
alternativas adaptarse formarse ciudades clientes título""".split())


def palabras(titulo):
    t = titulo.split(" | ")[0].lower()
    return {w for w in (p.strip("¿?¡!.,:;«»\"'()") for p in t.split()) if len(w) > 4} - VACIAS if t else set()


def kmeans_coseno(X, k, vueltas=25):
    centros = X[rng.choice(len(X), k, replace=False)]
    for _ in range(vueltas):
        asignado = np.argmax(X @ centros.T, axis=1)
        for j in range(k):
            miembros = X[asignado == j]
            if len(miembros):
                c = miembros.mean(axis=0)
                centros[j] = c / np.linalg.norm(c)
    return centros, np.argmax(X @ centros.T, axis=1)


def mds_clasico(D, dims=2):
    n = len(D)
    J = np.eye(n) - np.ones((n, n)) / n
    B = -0.5 * J @ (D ** 2) @ J
    valores, vectores = np.linalg.eigh(B)
    orden = np.argsort(valores)[::-1][:dims]
    return vectores[:, orden] * np.sqrt(np.maximum(valores[orden], 1e-9))


def main():
    import chromadb
    col = chromadb.PersistentClient(path=str(RAIZ / "datos" / "DB")).get_collection("unifranz")
    r = col.get(include=["embeddings", "metadatas"])
    X = np.asarray(r["embeddings"], dtype=np.float32)
    X /= np.linalg.norm(X, axis=1, keepdims=True)
    metas = r["metadatas"]
    ids = r["ids"]
    print(f"{len(X)} pedazos de {X.shape[1]} números")

    total_palabras = Counter(p for t in set(m.get("titulo", "") for m in metas) for p in palabras(t))

    centros, grupo = kmeans_coseno(X, GRUPOS)
    D = np.sqrt(np.maximum(0, 2 - 2 * (centros @ centros.T)))  # distancia entre temas
    pos = mds_clasico(D)
    pos = (pos - pos.mean(axis=0)) / np.abs(pos).max()           # -1..1

    xy = np.zeros((len(X), 2), dtype=np.float32)
    medias = np.zeros_like(centros)
    ejes = np.zeros((GRUPOS, 2, X.shape[1]), dtype=np.float32)
    radios = np.zeros(GRUPOS, dtype=np.float32)
    etiquetas = []
    for j in range(GRUPOS):
        idx = np.where(grupo == j)[0]
        M = X[idx]
        medias[j] = M.mean(axis=0)
        if len(idx) > 2:
            _, _, Vt = np.linalg.svd(M - medias[j], full_matrices=False)
            ejes[j] = Vt[:2]
        local = (M - medias[j]) @ ejes[j].T
        escala = np.abs(local).max() + 1e-6
        radios[j] = 0.035 + 0.075 * np.sqrt(len(idx) / len(X) * GRUPOS) / 3  # temas grandes, nubes grandes
        xy[idx] = pos[j] + local / escala * radios[j]
        # nombre del tema: el título más repetido, si de verdad domina
        # nombre del tema: su palabra MÁS PROPIA (aparece mucho aquí y poco en el resto: la idea de TF-IDF)
        tipo_dominante, _ = Counter(tipo_de(metas[i]) for i in idx).most_common(1)[0]
        aqui = Counter(p for i in set(metas[k].get("titulo", "") for k in idx) for p in palabras(i))
        propia = max(aqui, key=lambda p: aqui[p] / (1 + total_palabras[p] - aqui[p]) * min(aqui[p], 4), default="")
        etiquetas.append({"grupo": j, "x": float(pos[j][0]), "y": float(pos[j][1]), "n": int(len(idx)),
                          "tipo": tipo_dominante, "nombre": propia if aqui.get(propia, 0) >= 2 else ""})
        ejes[j] /= escala / radios[j]  # para proyectar preguntas nuevas igual que los pedazos

    tipos = [tipo_de(m) for m in metas]
    salida = {
        "pedazos": len(X), "dimensiones": int(X.shape[1]), "grupos": GRUPOS,
        "tipos": ["Carreras", "Admisión y becas", "Sedes", "Noticias", "La universidad"],
        "puntos": [[round(float(a), 4), round(float(b), 4), int(g), t] for (a, b), g, t in zip(xy, grupo, tipos)],
        "etiquetas": etiquetas,
    }
    (AQUI / "mapa_memoria.json").write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    np.savez_compressed(AQUI / "mapa_memoria.npz", centros=centros, pos=pos.astype(np.float32), medias=medias,
                        ejes=ejes, ids=np.array(ids))
    print("temas con nombre:", ", ".join(e["nombre"] for e in etiquetas if e["nombre"])[:400])
    print("listo: cerebro/mapa_memoria.json y .npz")


if __name__ == "__main__":
    main()
