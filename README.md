# Tami — Asistente virtual de UNIFRANZ

**Asistente Virtual Conversacional Basado en Modelos de Lenguaje y Síntesis de Voz en Tiempo Real para la
Orientación Vocacional y Atención al Postulante de UNIFRANZ.**

Tami es una orientadora virtual con avatar 3D que conversa con los postulantes por voz o teclado, responde con datos
reales de Unifranz (RAG) y funciona **100 % sin internet** en una PC con Windows.

**Equipo:** Juan Cristian Yujra · Brayan Quispe Mamani
**Feria:** miércoles 25 de noviembre de 2026, sede El Alto

> 📖 La documentación completa (arquitectura, decisiones, mediciones y **«DÓNDE NOS QUEDAMOS»**) está en
> [`DOCUMENTACION.md`](DOCUMENTACION.md). Es la fuente de verdad: léela antes de tocar algo.
> 🤝 Cómo trabajamos los dos con git: [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Cómo funciona (resumen)

```
 micrófono / teclado
        │
        ▼
 ┌──────────────┐   pregunta    ┌────────────────────┐  busca datos  ┌──────────────────────┐
 │  Cuerpo      │ ────────────▶ │  Alma              │ ────────────▶ │ Memoria (8766)       │
 │  Electron    │               │  src/main/tami.js  │               │ cerebro/servidor_... │
 │  src/tami/   │ ◀──────────── │                    │ ◀──────────── │ Chroma, 8093 pedazos │
 │  avatar VRM  │   respuesta   └─────────┬──────────┘               └──────────────────────┘
 └──────┬───────┘                         │ genera texto
        │ habla                           ▼
        ▼                       ┌────────────────────┐
 ┌──────────────┐               │ Cerebro (8080)     │
 │ Voz (8767)   │               │ llama-server       │
 │ Kokoro TTS   │               │ Qwen3.5-9B Q4_K_M  │
 └──────────────┘               └────────────────────┘
 Oído: Whisper small (CPU), dentro del servidor de voz → /escuchar
```

| Pieza | Carpeta | Tecnología |
|---|---|---|
| Cuerpo (ventana, avatar, boca, gestos) | `src/tami/` | Electron, three.js + three-vrm |
| Alma (personalidad, reglas, ruteo por tema) | `src/main/tami.js` | Node.js |
| Memoria de Unifranz (RAG) | `cerebro/` | Python, ChromaDB, e5-small |
| Cerebro | `motor/` + `modelos/` | llama.cpp (Vulkan) + Qwen3.5-9B |
| Voz y oído | `voz/` | Kokoro (TTS), faster-whisper (STT) |
| Motor de ventanas heredado | `src/main/` | de [Capri](CAPRI_README.md) |

## Estructura del repositorio

```
├── README.md              ← estás aquí
├── DOCUMENTACION.md       todo el detalle (léelo)
├── CONTRIBUTING.md        cómo trabajamos en equipo
├── INICIAR_TAMI.bat       enciende las 4 piezas y abre a Tami
├── TAMI_FERIA.bat         modo feria blindado (salida: Ctrl+Alt+Shift+Q)
├── src/tami/              cuerpo de Tami (nuevo)
├── src/main/              motor de Capri + tami.js (alma)
├── src/renderer/          interfaz original de Capri (no la usa Tami)
├── cerebro/               servidor de memoria, catálogo de carreras, datos confirmados
├── voz/                   servidor de voz/oído y configuración de voz (voz.json)
├── avatar/                tami.vrm + créditos
├── scripts/               pruebas: probar-tami, examen-feria, probar-feria, fotos
├── assets/, docs/         imágenes de Capri
└── tests/, tools/, hooks/ heredados de Capri
```

## Lo que NO está en git (pesa GB) y cómo conseguirlo

Git solo guarda el código. Estas carpetas se pasan **por USB o Drive** (pídeselas a Juan):

| Carpeta | Qué es | Tamaño aprox. |
|---|---|---|
| `Tami/modelos/` | `Qwen3.5-9B-Q4_K_M.gguf` | 5,2 GB |
| `Tami/motor/llama-b12198/` | `llama-server.exe` (llama.cpp Vulkan) | ~100 MB |
| `Tami/voz/kokoro/`, `Tami/voz/whisper/` | modelos de voz y de oído | ~800 MB |
| `Tami/voz/.venv/` | Python 3.13 con kokoro-onnx y faster-whisper (se puede rehacer con `uv`) | — |
| `../windows/`, `../datos/`, `../app/`, `../modelos/` | Python portátil 3.12, base Chroma, `buscar.py`, e5-small y qwen2.5-3b de respaldo (carpeta **LLMLocalUnifranz**, la de arriba) | ~2,5 GB |

**Importante:** el repo tiene que quedar **dentro** de `LLMLocalUnifranz\` con el nombre `Tami`, porque la
memoria usa el Python y la base de datos de la carpeta de arriba:

```
LLMLocalUnifranz\          ← copiada por USB
├── windows\  datos\  app\  modelos\
└── Tami\                  ← git clone aquí
```

## Puesta en marcha (PC nueva)

1. Copiar `LLMLocalUnifranz\` (sin `Tami`) por USB.
2. Dentro: `git clone https://github.com/Nobody2077/asistente-virtual.git Tami`
3. Copiar `modelos\`, `motor\` y `voz\kokoro`, `voz\whisper`, `voz\.venv` dentro de `Tami\`.
4. `cd Tami` → `npm install`
5. Doble clic en `INICIAR_TAMI.bat`. (Si usas tu propio modelo, no necesitas `modelos\` ni `motor\`: ver abajo.)

Requisitos: Windows 10/11, Node.js 20+, GPU con Vulkan y ~8 GB de VRAM (probado en RX 590), 16 GB de RAM.

## Usar tu propio modelo local (sin el Qwen de 5 GB)

Tami puede pensar con **cualquier servidor compatible con OpenAI**: Ollama, LM Studio u otro llama-server.

1. Copiar `config_local.ejemplo.bat` como **`config_local.bat`** (no se sube a git; cada uno tiene el suyo).
2. Descomentar una opción. Ejemplo con Ollama:
   ```bat
   set "TAMI_LLM_URL=http://127.0.0.1:11434/v1"
   set "TAMI_MODELO=qwen2.5:7b"
   ```
3. Encender tu servidor (`ollama serve` / «Start Server» en LM Studio) y abrir `INICIAR_TAMI.bat`
   o `TAMI_FERIA.bat`. Con `TAMI_LLM_URL` puesto, **no** se enciende el llama-server de `motor\`.

Sin `config_local.bat`, todo sigue igual que en la PC de la feria (llama-server + Qwen3.5-9B).
Los scripts de prueba también lo usan: `set TAMI_LLM_URL=...` antes de `node scripts/examen-feria.js`.
Ojo: con un modelo distinto las respuestas cambian; el examen de feria se calibró con Qwen3.5-9B.

## Pruebas rápidas

```bash
node scripts/probar-tami.js "¿hay becas?"      # cerebro por consola, con tiempos
node scripts/examen-feria.js                    # 34 estudiantes de prueba (~5 min)
node scripts/probar-feria.js                    # prueba el blindaje del modo feria
npx electron src/tami/main.js --autoprueba "¿qué carreras hay?"   # fotos en capturas/
```

## Créditos y licencias

- Basado en **[Capri](CAPRI_README.md)** de *mochiiwuff* — licencia **PolyForm Noncommercial 1.0.0**
  ([`LICENSE`](LICENSE)). Por eso este proyecto es **solo para uso no comercial** (académico).
- Avatar: muestra VRM oficial de pixiv (ver `avatar/CREDITOS.txt`).
- Modelos de terceros (no entrenados por nosotros): Qwen3.5 (Alibaba), Whisper (OpenAI), Kokoro, e5-small.
- Datos: páginas públicas de unifranz.edu.bo.
