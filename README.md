# Tami — Asistente virtual de UNIFRANZ

**Asistente Virtual Conversacional Basado en Modelos de Lenguaje y Síntesis de Voz en Tiempo Real para la
Orientación Vocacional y Atención al Postulante de UNIFRANZ.**

Tami es una orientadora virtual con **avatar 3D** que conversa con los postulantes **por voz o por teclado**, les
recomienda carreras según sus gustos y responde con **datos reales de Unifranz** (becas, sedes, contactos,
carreras). Todo corre **en la propia PC, sin internet**: el modelo de lenguaje, la búsqueda en la memoria (RAG),
la voz y el reconocimiento de voz.

**Equipo:** Juan Cristian Yujra · Brayan Quispe Mamani
**Presentación:** feria de Unifranz, miércoles 25 de noviembre de 2026, sede El Alto

> 📖 Detalle técnico, decisiones, mediciones y **«DÓNDE NOS QUEDAMOS»**: [`DOCUMENTACION.md`](DOCUMENTACION.md)
> 🤝 Cómo trabajamos en equipo con git: [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## Índice
1. [Qué hace](#1-qué-hace)
2. [Cómo funciona](#2-cómo-funciona)
3. [Requisitos](#3-requisitos)
4. [Qué trae el repo y qué no](#4-qué-trae-el-repo-y-qué-no)
5. [Instalación en Windows](#5-instalación-en-windows)
6. [Instalación en Linux](#6-instalación-en-linux)
7. [Usar tu propio modelo local](#7-usar-tu-propio-modelo-local)
8. [Cómo ejecutarlo](#8-cómo-ejecutarlo)
9. [Pruebas](#9-pruebas)
10. [Problemas comunes](#10-problemas-comunes)
11. [Estructura del repositorio](#11-estructura-del-repositorio)
12. [Créditos y licencias](#12-créditos-y-licencias)

---

## 1. Qué hace

- 🗣️ **Conversa** con voz femenina (Kokoro) y **mueve la boca** al hablar; muestra subtítulos.
- 🎤 **Escucha** por micrófono (Whisper) o por teclado (en la feria hay mucho ruido).
- 🎓 **Orienta**: pregunta qué te gusta y recomienda carreras del catálogo real (17 carreras).
- 📚 **Responde con datos de Unifranz** buscando en 8093 pedazos de la web oficial (RAG). No inventa cuotas,
  horarios ni sueldos: si no sabe, deriva a admisiones.
- 📇 **Ficha con QR** de cada carrera, para llevarse la información en el celular.
- 👋 **Toma la iniciativa**: invita a acercarse cada 45 s y se despide si el estudiante se va.
- 🧑‍🏫 **Modo expositora** (F8 o «¿cómo funcionas?»): explica en 9 escenas cómo está hecha.
- 🔒 **Modo feria**: pantalla completa que no se cierra con Alt+F4 y se levanta sola si se cae.

## 2. Cómo funciona

Tami son **4 programas** que se hablan por HTTP en la misma PC:

```
 micrófono / teclado
        │
        ▼
 ┌──────────────┐   pregunta    ┌────────────────────┐  busca datos  ┌──────────────────────┐
 │  CUERPO      │ ────────────▶ │  ALMA              │ ────────────▶ │ MEMORIA  :8766       │
 │  Electron    │               │  src/main/tami.js  │               │ cerebro/servidor_... │
 │  src/tami/   │ ◀──────────── │  personalidad,     │ ◀──────────── │ ChromaDB + e5-small  │
 │  avatar VRM  │   respuesta   │  reglas, ruteo     │               │ 8093 pedazos         │
 └──────┬───────┘   frase a     └─────────┬──────────┘               └──────────────────────┘
        │           frase                 │ genera el texto
        ▼                                 ▼
 ┌──────────────┐               ┌────────────────────┐
 │ VOZ   :8767  │               │ CEREBRO  :8080     │
 │ Kokoro (TTS) │               │ llama-server       │
 │ Whisper (STT)│               │ Qwen3.5-9B Q4_K_M  │  (o tu propio modelo, sección 7)
 └──────────────┘               └────────────────────┘
```

**El recorrido de una pregunta** («¿hay becas?»):
1. El **cuerpo** recibe el texto (o graba el audio y la **voz** lo transcribe con Whisper).
2. El **alma** decide el tema. Si la pregunta necesita datos, se los pide a la **memoria**, que busca los
   pedazos más parecidos de la web de Unifranz (búsqueda por significado con embeddings e5).
3. El alma arma el mensaje (personalidad + datos encontrados + conversación) y se lo manda al **cerebro**.
4. El cerebro escribe la respuesta palabra por palabra. Apenas termina una frase, el alma se la pasa a la
   **voz**, que la convierte en audio. Tami **empieza a hablar antes de terminar de pensar** (~2,5 s).
5. El cuerpo reproduce el audio y mueve la boca según el volumen (RMS).

| Pieza | Carpeta | Tecnología | Puerto |
|---|---|---|---|
| Cuerpo (ventana, avatar, gestos, QR) | `src/tami/` | Electron 44, three.js + three-vrm | — |
| Alma (personalidad, reglas, ruteo) | `src/main/tami.js` | Node.js | — |
| Memoria de Unifranz (RAG) | `cerebro/` | Python 3.12, Flask, ChromaDB, e5-small | 8766 |
| Voz y oído | `voz/` | Python 3.13, kokoro-onnx, faster-whisper | 8767 |
| Cerebro | `motor/` + `modelos/` | llama.cpp (Vulkan) + Qwen3.5-9B | 8080 |

## 3. Requisitos

| | Mínimo (con modelo propio chico) | Recomendado (como en la feria) |
|---|---|---|
| Sistema | Windows 10/11 o Linux x86_64 (Ubuntu, Mint…) | Windows 11 |
| RAM | 8 GB | 16 GB |
| Tarjeta de video | no obligatoria (modelo 3B en CPU, más lento) | 8 GB de VRAM con Vulkan (probado en RX 590) |
| Disco | ~4 GB | ~12 GB |
| Software | **Node.js 20+**, **git** | + **uv** (para crear el Python de la voz) |
| Extras | micrófono (opcional), parlantes | |

En Linux además: `curl`, `tar` y las librerías de audio de Electron (`sudo apt install libasound2 libsndfile1`).

## 4. Qué trae el repo y qué no

Git solo guarda **el código** (~10 MB). Lo pesado se pasa **por USB o Drive** (pídeselo a Juan):

| Carpeta | Qué es | Tamaño | ¿Obligatoria? |
|---|---|---|---|
| `../windows/` o `../linux/` | Python portátil + ChromaDB + llama-cpp (para la memoria) | 275 MB | **Sí** (según tu sistema) |
| `../datos/` | base vectorial Chroma (`DB/`) y textos de unifranz.edu.bo (`md/`) | 61 MB | **Sí** |
| `../app/` | `buscar.py`, la búsqueda que usa la memoria | 36 KB | **Sí** |
| `../modelos/` | e5-small (embeddings, **obligatorio**) y qwen2.5-3b (respaldo) | 2,1 GB | e5: **sí** |
| `voz/kokoro/` | `kokoro-v1.0.onnx` + `voices-v1.0.bin` | 338 MB | **Sí** |
| `voz/whisper/` | Whisper small (si falta y hay internet, se descarga solo) | 464 MB | para el micrófono |
| `modelos/` | `Qwen3.5-9B-Q4_K_M.gguf` | 5,2 GB | no, si usas tu modelo |
| `motor/` | `llama-server` (llama.cpp b12198 Vulkan para Windows) | 102 MB | no, si usas tu modelo |

Kokoro también se puede bajar de [kokoro-onnx (releases, model-files-v1.0)](https://github.com/thewh1teagle/kokoro-onnx/releases).

> ⚠️ **El repo tiene que quedar dentro de `LLMLocalUnifranz/` con el nombre `Tami`**: la memoria usa el
> Python, la base de datos y los modelos de la carpeta de arriba.
>
> ```
> LLMLocalUnifranz/           ← copiada por USB
> ├── app/  datos/  modelos/
> ├── windows/                ← Python para Windows
> ├── linux/                  ← Python para Linux (.tar.gz)
> └── Tami/                   ← git clone aquí
> ```

## 5. Instalación en Windows

```bat
:: 1. dentro de la carpeta LLMLocalUnifranz copiada por USB
git clone https://github.com/Nobody2077/asistente-virtual.git Tami
cd Tami
:: 2. copiar modelos\, motor\, voz\kokoro, voz\whisper y voz\.venv del USB dentro de Tami\
:: 3. dependencias de Electron
npm install
```

Si no tienes `voz\.venv`, créalo: `cd voz` → `uv venv -p 3.13 .venv` → `uv pip install -p .venv -r requirements.txt`.

## 6. Instalación en Linux

```bash
# 0. herramientas (Ubuntu/Mint)
sudo apt install git curl nodejs npm libasound2 libsndfile1
curl -LsSf https://astral.sh/uv/install.sh | sh          # uv, para el Python de la voz

# 1. dentro de la carpeta LLMLocalUnifranz copiada por USB
git clone https://github.com/Nobody2077/asistente-virtual.git Tami
cd Tami
npm install

# 2. voz: copiar voz/kokoro (y voz/whisper) del USB, y crear su Python
cd voz && uv venv -p 3.13 .venv && uv pip install -p .venv -r requirements.txt && cd ..

# 3. cerebro: lo más fácil en Linux es tu propio modelo con Ollama (sección 7)
cp config_local.ejemplo.sh config_local.sh   # y descomentar la opción de Ollama
```

La **memoria** no necesita instalar nada: `INICIAR_TAMI.sh` descomprime solo el Python de `../linux/` en
`~/.llmlocal_unifranz` la primera vez (~1 min).

¿Quieres el mismo cerebro que la feria en Linux? Baja `llama-server` de las
[releases de llama.cpp](https://github.com/ggml-org/llama.cpp/releases) (versión *ubuntu-vulkan*), ponlo en el
`PATH` o en `motor/<carpeta>/llama-server`, y copia `modelos/Qwen3.5-9B-Q4_K_M.gguf`.

## 7. Usar tu propio modelo local

Tami puede pensar con **cualquier servidor compatible con la API de OpenAI**: Ollama, LM Studio, otro
llama-server, vLLM… Cada uno pone el suyo en un archivo personal que **no se sube a git**.

| Sistema | Archivo personal | Plantilla |
|---|---|---|
| Windows | `config_local.bat` | `config_local.ejemplo.bat` |
| Linux | `config_local.sh` | `config_local.ejemplo.sh` |

Ejemplo con **Ollama**:

```bash
ollama pull qwen2.5:7b          # una vez
ollama serve                    # dejarlo encendido
```
```bash
# config_local.sh  (en Windows: set "TAMI_LLM_URL=..." en config_local.bat)
export TAMI_LLM_URL="http://127.0.0.1:11434/v1"
export TAMI_MODELO="qwen2.5:7b"
```

Con `TAMI_LLM_URL` puesto, **no** se enciende el llama-server de `motor/`. Sin archivo personal, todo funciona
como en la PC de la feria.

> Ojo: con otro modelo las respuestas cambian. El examen de feria (33/34) se calibró con Qwen3.5-9B; lo que
> cambies, compruébalo también en la PC de la feria. Modelos recomendados: Qwen 2.5/3.5 de 7B a 9B
> (hablan bien español). Desactiva el «modo pensamiento» si tu modelo lo tiene.

## 8. Cómo ejecutarlo

| Qué | Windows | Linux |
|---|---|---|
| Tami en ventana (para programar) | doble clic `INICIAR_TAMI.bat` | `bash INICIAR_TAMI.sh` |
| Pantalla completa sin blindaje (ensayos) | `INICIAR_TAMI.bat --stand` | `bash INICIAR_TAMI.sh --stand` |
| **Modo feria** blindado | doble clic `TAMI_FERIA.bat` | `bash TAMI_FERIA.sh` |
| Forzar un micrófono | `INICIAR_TAMI.bat --mic "nombre"` | `bash INICIAR_TAMI.sh --mic "nombre"` |

El script enciende las 4 piezas en orden, espera a que respondan (la primera vez el modelo tarda ~1 min) y abre
a Tami. En Linux, al cerrar la ventana se apagan también los servidores; los logs quedan en `capturas/*.log`.

**Atajos:**

| Tecla | Qué hace |
|---|---|
| **F2** o botón 🎤 | hablarle (mantener, o tocar y volver a tocar) |
| **F8** | presentación «Así funciona Tami» (F8 otra vez la detiene) |
| **Ctrl+Q** | cerrar (fuera del modo feria) |
| **Ctrl+Alt+Shift+M** | minimizar en modo feria (o mantener 1 s el botón de arriba a la derecha) |
| **Ctrl+Alt+Shift+Q** | 🔑 salida secreta del modo feria |

**Antes de abrir en la feria:** cerrar Steam, iVCam, navegadores y todo lo que use RAM o micrófonos virtuales.

## 9. Pruebas

Con las piezas encendidas (el script las deja encendidas mientras Tami está abierta):

```bash
node scripts/probar-tami.js "¿hay becas?"                         # una pregunta por consola, con tiempos
node scripts/examen-feria.js                                       # 34 estudiantes de prueba con trampas (~5 min)
node scripts/examen-feria.js trampa                                # solo un tema
node scripts/probar-feria.js                                       # prueba el blindaje del modo feria
npx electron src/tami/main.js --autoprueba "¿qué carreras hay?"    # saca fotos en capturas/
```

Para probar con tu modelo: `export TAMI_LLM_URL=... TAMI_MODELO=...` (Windows: `set ...`) antes de cada comando.

## 10. Problemas comunes

| Síntoma | Causa y arreglo |
|---|---|
| «Algo no arrancó en 2,5 minutos» | Mira qué pieza falta: en Windows, las ventanas minimizadas «Tami - …»; en Linux, `capturas/*.log`. |
| «Mi micrófono no recibe sonido» | Windows usa un micrófono virtual (iVCam, Steam). Revisa *Configuración → Sonido* o usa `--mic`. |
| Tami tarda mucho en responder | Modelo en CPU o RAM llena. Cierra programas; prueba un modelo más chico. |
| La memoria no arranca en Linux | ¿Está `../linux/` y `../datos/DB`? ¿Clonaste dentro de `LLMLocalUnifranz/` con el nombre `Tami`? |
| La voz no arranca | Falta `voz/.venv` o `voz/kokoro/`. Ver secciones 5 y 6. |
| Electron no abre en Linux (sandbox) | `npx electron src/tami/main.js --no-sandbox` para probar. |
| El cerebro propio no responde | ¿Está encendido? Prueba `curl $TAMI_LLM_URL/models`. |

## 11. Estructura del repositorio

```
Tami/
├── README.md                   ← estás aquí
├── DOCUMENTACION.md            detalle técnico y bitácora (la fuente de verdad)
├── CONTRIBUTING.md             cómo trabajamos en equipo
├── INICIAR_TAMI.bat / .sh      enciende todo y abre a Tami (Windows / Linux)
├── TAMI_FERIA.bat / .sh        modo feria blindado
├── config_local.ejemplo.*      plantilla para usar tu propio modelo
├── src/
│   ├── tami/                   ★ CUERPO: main.js (Electron), app.js, avatar.js, voz.js, oido.js,
│   │                             explica.html (modo expositora), tami.css
│   ├── main/tami.js            ★ ALMA: personalidad, reglas, RAG, ruteo por tema
│   ├── main/                   motor heredado de Capri (llm.js habla con el modelo)
│   └── renderer/               interfaz original de Capri (Tami no la usa)
├── cerebro/
│   ├── servidor_tami.py        memoria por HTTP (:8766): /buscar, /carreras, /estado
│   ├── carreras.json           catálogo cerrado de las 17 carreras
│   ├── datos_confirmados.json  datos corregidos a mano (mandan sobre la web)
│   └── armar_catalogo.py, armar_mapa.py   regeneran el catálogo y el mapa de la memoria
├── voz/
│   ├── servidor_voz.py         voz (:8767): POST /hablar → WAV, POST /escuchar → texto
│   ├── voz.json                qué voz usa (mezcla de voces de Kokoro + tono)
│   ├── requirements.txt        dependencias de Python de la voz
│   └── probar_voces.py, voces_jovenes.py  comparar voces
├── avatar/tami.vrm             modelo 3D + CREDITOS.txt
├── scripts/                    pruebas (probar-tami, examen-feria, probar-feria) y fotos
├── assets/, docs/              imágenes de Capri
└── tests/, tools/, hooks/      heredados de Capri
```

## 12. Créditos y licencias

- Basado en **[Capri](CAPRI_README.md)** de *mochiiwuff*, con licencia **PolyForm Noncommercial 1.0.0**
  ([`LICENSE`](LICENSE)). Por eso este proyecto es **solo para uso no comercial** (académico).
- Avatar: muestra VRM oficial de pixiv, VRM Public License 1.0 (ver `avatar/CREDITOS.txt`).
- Modelos de terceros, **no entrenados por nosotros**: Qwen3.5 (Alibaba), Whisper (OpenAI), Kokoro (hexgrad),
  multilingual-e5-small (Microsoft).
- Datos: páginas públicas de [unifranz.edu.bo](https://unifranz.edu.bo). Este proyecto no es oficial de Unifranz.
