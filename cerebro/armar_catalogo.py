# armar_catalogo.py — arma carreras.json leyendo las páginas de carreras de la web de Unifranz.
#
# Por qué existe: en la entrevista vocacional Tami SOLO puede recomendar carreras que Unifranz
# tiene de verdad. Si dejáramos que el modelo "recuerde" carreras, podría inventar una.
# Este catálogo es la lista cerrada que se le da al modelo.
#
# Uso:  ..\..\windows\python\python.exe armar_catalogo.py
#       (lee ..\..\datos\md\paginas\carreras_*.md y escribe carreras.json aquí al lado)

import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).parent
PAGINAS = AQUI.parent.parent / "datos" / "md" / "paginas"
SEDES = {"CBBA": "Cochabamba", "EA": "El Alto", "LPZ": "La Paz", "SCZ": "Santa Cruz"}


def leer(ruta):
    texto = ruta.read_text(encoding="utf-8")
    cabecera, cuerpo = texto.split("---", 2)[1:]
    meta = dict(re.findall(r'^(\w+): "?(.*?)"?$', cabecera, re.M))
    nombre = meta["titulo"].split(" | ")[0].strip()

    # «Disponible en:» y en la línea siguiente las siglas de las sedes
    m = re.search(r"Disponible en:\s*\n(.+)", cuerpo)
    sedes = [SEDES[s] for s in (m.group(1).split() if m else []) if s in SEDES]

    m = re.search(r"Programa de Estudios:\s*([^\n]+)", cuerpo)
    duracion = m.group(1).strip() if m else ""

    # el perfil: el primer párrafo largo que empieza con «El profesional…» o «La carrera…»
    perfil = next((p.strip() for p in cuerpo.split("\n")
                   if len(p.strip()) > 150 and not p.strip().startswith(("Las carreras transformadoras", "Este sitio"))), "")

    # áreas de formación: los ### entre «Áreas de Formación» y la sección siguiente
    areas = []
    m = re.search(r"Áreas de Formación(.*?)(?:\n## |\Z)", cuerpo, re.S)
    if m:
        areas = [a.strip() for a in re.findall(r"^###\s+(.+)$", m.group(1), re.M)]

    # dónde trabajar: las líneas cortas después de «¿Dónde podrás trabajar?»
    trabajo = []
    m = re.search(r"¿Dónde podrás trabajar\?(.*?)(?:\n## |\Z)", cuerpo, re.S)
    if m:
        trabajo = [re.sub(r"^[#\s*-]+", "", l).strip() for l in m.group(1).splitlines()]
        trabajo = [l for l in trabajo if 3 < len(l) < 160][:8]

    return {"nombre": nombre, "url": meta["url"], "sedes": sedes, "duracion": duracion,
            "perfil": perfil, "areas": areas, "trabajo": trabajo}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    carreras = [leer(r) for r in sorted(PAGINAS.glob("carreras_*.md"))]
    destino = AQUI / "carreras.json"
    destino.write_text(json.dumps(carreras, ensure_ascii=False, indent=2), encoding="utf-8")
    for c in carreras:
        avisos = [k for k in ("sedes", "duracion", "perfil", "areas") if not c[k]]
        print(f"- {c['nombre']}: {', '.join(c['sedes']) or '?'} | {c['duracion'] or '?'} | "
              f"{len(c['areas'])} áreas, {len(c['trabajo'])} trabajos" + (f"  ⚠ falta {avisos}" if avisos else ""))
    print(f"\n{len(carreras)} carreras → {destino}")


if __name__ == "__main__":
    main()
