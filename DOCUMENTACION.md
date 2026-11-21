# Tami — Orientadora virtual de UNIFRANZ

> **Proyecto de feria:** *Desarrollo de un Asistente Virtual Conversacional Basado en Modelos de Lenguaje y
> Síntesis de Voz en Tiempo Real para la Orientación Vocacional y Atención al Postulante de la Universidad
> Franz Tamayo (UNIFRANZ).*
> **Autor:** Juan Cristian Yujra Quispe · **Feria:** miércoles 25 de noviembre de 2026, sede El Alto, 4 horas.

---

## 📍 DÓNDE NOS QUEDAMOS

*(última actualización: sábado 21 de noviembre de 2026)*

- ✅ Tami conversa, orienta, responde con datos de Unifranz, **habla con voz y mueve la boca**.
- ✅ Se cambió LM Studio por `llama-server` (decisión 9): código y lanzador listos, modelo copiado a `modelos\`.
- ⏳ **Falta medir** `llama-server` (velocidad y RAM) contra LM Studio: esperaba el permiso de Juan para ejecutar el
  `.exe` recién descargado.
- Siguiente, en este orden: **pulir características para la presentación** (micrófono, ficha de carrera con QR,
  modo feria, ensayo de 4 h) → después el **cerebro de respaldo 3B** → después una **voz más delicada**.

---

## 1. Qué es Tami

Una orientadora vocacional **humana en 3D** que vive en el escritorio de la PC del stand. Saluda a quien pasa,
conversa **con voz**, hace una mini entrevista vocacional, recomienda carreras **reales** de Unifranz y responde
dudas (becas, sedes, requisitos, autoridades) **con datos oficiales de unifranz.edu.bo**, citando de dónde salen.
Todo corre **en esta PC, sin internet**.

Es distinta de **Capri** (el proyecto anterior de Juan): Capri es una mascota pixel-art cyberpunk; Tami es una
orientadora humana con los colores de Unifranz. Tami reutiliza el *motor* de Capri, no su cuerpo ni su personalidad.

---

## 2. Cómo funciona (arquitectura)

```
  ESTUDIANTE                         TAMI (todo en esta PC, sin internet)
 ─────────────                      ──────────────────────────────────────────────────────
 ⌨️ escribe ─────────────────────┐
 🎤 habla (pendiente: Whisper) ──┤
                                 ▼
              ┌──────────────────────────────────┐   pregunta   ┌──────────────────────────┐
              │ ALMA  src/main/tami.js           │ ───────────► │ MEMORIA DE UNIFRANZ      │
              │ personalidad + entrevista +      │ ◄─────────── │ cerebro/servidor_tami.py │
              │ reglas de honestidad + catálogo  │   3 pedazos  │ Chroma + e5-small (8766) │
              └────────────────┬─────────────────┘              └──────────────────────────┘
                               │ mensajes (formato OpenAI)
                               ▼
              ┌──────────────────────────────────┐
              │ CEREBRO  llama-server (8080)     │  Qwen3.5-9B Q4_K_M en la RX 590 (Vulkan)
              └────────────────┬─────────────────┘
                               │ responde palabra por palabra → se corta en FRASES
          ┌────────────────────┼──────────────────────────┐
          ▼                    ▼                          ▼
  🔊 VOZ servidor_voz.py   💬 subtítulos            🖥️ [MOSTRAR: carrera]
     Kokoro (8767) → WAV                               (ficha con QR: pendiente)
          │
          ▼
  👩 CUERPO src/tami/avatar.js: la boca se abre según el VOLUMEN del audio, parpadea, sonríe, mira
```

**El truco del «tiempo real»:** no se espera la respuesta completa. Apenas el modelo termina una frase, se manda a
la voz; mientras suena, se genera la siguiente. Y si la pregunta necesita buscar datos (5 a 10 s), Tami dice al
instante una muletilla («Mmm, déjame revisar…») como haría una persona.

---

## 3. Estructura de carpetas

```
G:\Desarrollo\LLMLocalUnifranz\
├── app\buscar.py              búsqueda en Chroma (de LLMLocalUnifranz; Tami la importa, no la copia)
├── datos\DB\                  base vectorial de Chroma (8093 pedazos: 95 páginas + 440 noticias)
├── datos\md\                  textos originales descargados de unifranz.edu.bo
├── modelos\                   e5-small (embeddings) y qwen2.5-3b (futuro respaldo)
├── windows\python\            Python 3.12 portátil con Chroma y llama-cpp (lo usa la memoria)
└── Tami\                      ← ESTE PROYECTO (clon de Capri, rama git «tami»)
    ├── INICIAR_TAMI.bat       doble clic: enciende las 4 piezas y abre a Tami
    ├── DOCUMENTACION.md       este archivo
    ├── avatar\
    │   ├── tami.vrm           modelo 3D (muestra oficial de pixiv, ver Créditos)
    │   └── CREDITOS.txt
    ├── cerebro\
    │   ├── servidor_tami.py   memoria de Unifranz por HTTP (8766): /buscar, /carreras, /estado
    │   ├── armar_catalogo.py  lee las 17 páginas de carreras → carreras.json
    │   └── carreras.json      catálogo cerrado (nombre, sedes, duración, perfil, áreas, dónde trabajar)
    ├── motor\llama-b12198\    llama-server.exe (llama.cpp b12198, Vulkan) — no va a git
    ├── modelos\               Qwen3.5-9B-Q4_K_M.gguf (5,2 GB) — no va a git
    ├── voz\
    │   ├── servidor_voz.py    voz de Tami (8767): POST /hablar → WAV
    │   ├── voz.json           qué voz usa (mezcla de voces de Kokoro + tono)
    │   ├── voces_jovenes.py   genera variantes de voz para comparar
    │   ├── probar_voces.py    compara Piper, Kokoro y Microsoft
    │   ├── kokoro\            modelo Kokoro v1.0 (310 MB) — no va a git
    │   ├── piper\             Piper (descartado, ver decisión 7) — no va a git
    │   └── .venv\             Python 3.13 con kokoro-onnx (creado con uv) — no va a git
    ├── src\main\              MOTOR heredado de Capri (llm.js, system.js, windows.js…)
    │   └── tami.js            ★ el ALMA de Tami (nuevo)
    ├── src\tami\              ★ el CUERPO de Tami (nuevo)
    │   ├── main.js            proceso principal de Electron (ventana, IPC, --autoprueba)
    │   ├── preload.js         puente seguro página ↔ cerebro
    │   ├── index.html, tami.css   la ventana (negro, blanco, naranja)
    │   ├── app.js             une todo + ciclo de feria (invitar / despedirse)
    │   ├── avatar.js          carga y anima el VRM (three.js + three-vrm)
    │   └── voz.js             cola de frases + boca por volumen (RMS)
    └── scripts\
        ├── probar-tami.js     estudiante de prueba por consola, con tiempos
        └── foto-avatar.js     fotos del avatar para revisarlo
```

### Puertos
| Puerto | Pieza | Programa |
|---|---|---|
| 8080 | Cerebro | `motor\llama-b12198\llama-server.exe` |
| 8766 | Memoria de Unifranz | `cerebro\servidor_tami.py` (Python portátil 3.12) |
| 8767 | Voz | `voz\servidor_voz.py` (Python 3.13 del `.venv`) |
| 1234 | (alternativa) LM Studio | solo si `TAMI_MOTOR=lmstudio` |

### Configuración (variables de entorno, las pone `INICIAR_TAMI.bat`)
| Variable | Valor | Para qué |
|---|---|---|
| `TAMI_SEDE` | `El Alto` | dónde está el stand: cuando Tami dice «aquí» |
| `TAMI_MOTOR` | `llamacpp` | `llamacpp` (llama-server) o `lmstudio` |
| `TAMI_MODELO` | (automático) | nombre del modelo que se le pide al motor |

---

## 4. Decisiones (y por qué)

| # | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| 1 | **Reutilizar el motor de Capri y escribir un cuerpo nuevo** | El motor (`src/main/`) es genérico y está probado; el cuerpo de Capri (`capri.js` 104 KB, `lines.js` 147 KB) es 100 % Capri. Quitarle a Capri pedazo a pedazo tomaría días | Convertir a Capri en Tami borrando; empezar desde cero |
| 2 | **Carpeta nueva `Tami\` con `git clone` de Capri** (rama `tami`) | Capri y LLMLocalUnifranz quedan intactos; se conserva la historia y la autoría original (licencia PolyForm Noncommercial: uso sin vender, con aviso) | Rama dentro de Capri (riesgo de romper la USB de Capri) |
| 3 | **Nombre: Tami** (de Tamayo) | Corto, cercano, fácil de recordar en la feria | Franzi |
| 4 | **Vive en el escritorio, pero en «modo feria»** | Impresiona que flote sobre Windows, pero un estudiante bromista no debe poder decir «apaga la computadora» | Control total de la PC como Capri |
| 5 | **Catálogo cerrado de 17 carreras** leído de las páginas oficiales | El modelo podría «recordar» una carrera que Unifranz no tiene. Solo puede recomendar las de la lista | Dejar que el modelo recuerde |
| 6 | **Avatar 3D VRM** (three.js + three-vrm) con la muestra oficial de pixiv | Es humano, trae bocas (a/i/u/e/o), parpadeo y emociones. Su licencia (leída del propio archivo) permite modificarlo y usarlo, incluso comercial. Juan pidió que Claude lo hiciera y VRoid es un programa visual | Avatar 2D; Seed-san (es un robot) |
| 7 | **Voz: Kokoro, mezcla 4 (Dora 55 % + Heart 45 %, tono ×1,05)** | Sin internet, ~3× más rápida que hablar en el procesador, más natural que Piper. Juan: «todavía suena adulta» → se pulirá después | Piper (robótica); Microsoft Sofía/Dalia (casi humanas pero por acceso **no oficial**: dio error 403 y depende de internet) |
| 8 | **Polera negra** (colores del logo: negro, blanco, naranja) | Elegida por Juan; la interfaz usa el naranja como acento | Polera naranja |
| 9 | **Cerebro con `llama-server` (llama.cpp) en vez de LM Studio** | LM Studio ocupaba **7,5 GB de RAM** (de 16) y la PC se quedó sin memoria. `llama-server` es el mismo motor sin interfaz, portátil, sin el módulo de visión, con caché de RAM limitada a 1 GB | Seguir con LM Studio; modelo de Capri en procesador (demasiado lento para Tami) |
| 10 | **Modelo: Qwen3.5-9B Q4_K_M** (el mismo de LM Studio, copiado) | Es el más poderoso que cabe **entero** en los 8 GB de la RX 590. Uno más grande no cabría y una parte iría al procesador: más lento | Modelo más grande; Gemma-4-E4B (más liviano pero razona menos) |
| 11 | **Respaldo con Qwen2.5-3B** (como el «cerebro automático» de Capri) | Si el 9B falla a mitad de la feria, Tami no se queda muda. El 3B ya está descargado. **Se hará después** de pulir las características | — |
| 12 | **Sin datos personales** | Habrá menores de edad: no pide nombre completo, teléfono, correo ni carnet; no graba audio | — |

### Cómo es Capri por dentro (referencia)
Capri tiene **dos cerebros** y elige solo al arrancar (`autoBrain()` en `Capri_Local\capri-desktop\src\main\main.js:673`):
si LM Studio responde usa el **Qwen3.5-9B en la tarjeta**; si no, el **Qwen2.5-3B de la USB** con
`servidor_capri.py` (llama-cpp-python, `n_gpu_layers=0`: **solo procesador**, para funcionar en cualquier PC).
Ese servidor también hace la búsqueda de Unifranz en `/v1/unifranz/buscar`.

---

## 5. Proceso y mediciones (bitácora)

### 5.1 El alma (personalidad + RAG) — primera prueba: lenta e inventaba
Conversación de 8 mensajes con `scripts\probar-tami.js`:

| Problema | Causa encontrada | Arreglo |
|---|---|---|
| **17 s** antes de la primera palabra | La RX 590 **lee** el prompt a ~110–330 tokens/s (Polaris, 2018): 3600 tokens = 33 s. Escribir es rápido (~17 tokens/s). No era el «modo pensamiento» (medido: 0 tokens de razonamiento) | 1 sola ranura (`--parallel 1`) para reaprovechar la caché; buscar datos **solo** si la pregunta los necesita; 3 pedazos recortados en vez de 4 enteros; «calentar» al encender |
| **Inventó** «becas con promedio 85» | El buscador e5-small trajo «Intercambio internacional» en vez de la página de Becas, y el modelo rellenó | **Ruteo por tema**: si dice «beca» se busca DENTRO de la página de Becas (dato real: **promedio mínimo 70**, sin deudas) |
| «Medicina dura seis años **y medio**» | Mezcló una noticia | Regla: la duración sale **siempre** del catálogo |
| Las noticias le ganaban a las páginas | 440 noticias vs 95 páginas | Las páginas oficiales tienen una pequeña ventaja al ordenar |
| Mostraba una página en cada respuesta | — | Solo cuando lo piden o al recomendar por primera vez; nunca dos veces la misma |
| «Aquí en La Paz…» a alguien de El Alto | No sabía dónde está el stand | `TAMI_SEDE=El Alto` en su personalidad |

**Resultado:** respuestas de la entrevista en **1,2–3 s**; con datos de Unifranz **4–12 s** (con muletilla inmediata).
Todos los datos de la prueba final fueron correctos (duración, becas, mensualidad → «confírmalo en Admisiones»,
vicerrectora de El Alto: Lic. Clara Eve Gomez Ferrufino).

### 5.2 La voz
| Motor | Tiempo | Resultado |
|---|---|---|
| Piper (es_MX claude / es_AR daniela) | ~10 s de audio en 2–3,5 s | Funciona, pero **suena robótica** (Juan) |
| Piper afinado (más entonación, más pausado) | 1,8 s | Sigue siendo Piper |
| **Kokoro ef_dora** | **~3× más rápido que el tiempo real** | Elegido, pero «suena a señora mayor» (Juan) |
| Microsoft Sofía 🇧🇴 / Dalia 🇲🇽 (edge-tts) | ~3 s | Casi humanas, pero **error 403** con la versión 7.0.2 (acceso no oficial) y necesitan internet → descartadas |
| Kokoro **rejuvenecida**: mezcla de vectores de voz + tono más alto (6 variantes) | igual | Elegida la **4 (Dora + Heart)**; aún suena adulta → pendiente |

### 5.3 El cuerpo
- La primera foto mostraba la boca cerrada aunque se mandaba abrir: **Electron frena las animaciones de las
  ventanas ocultas**. Medir el valor real (`aa=0.17` en vez de `0.9`) llevó a la causa. Las fotos se sacan con la
  ventana visible fuera de la pantalla.
- Miraba hacia un costado: el punto que sigue con la mirada estaba **detrás** de ella; se pegó a la cámara.

### 5.4 La app
- **Condición de carrera:** el cerebro avisaba «listo» antes de que la página terminara de cargar el 3D, el
  aviso se perdía y Tami nunca invitaba. Arreglo: la página **pregunta** el estado cuando está lista.
- **CSP** (seguridad): la página solo puede conectarse con la voz local; el `importmap` se autoriza por su hash.
  Al principio bloqueó las texturas del modelo (`blob:`) y hubo que permitirlas.
- **Lanzador `.bat`:** `timeout` falla si la ventana no tiene teclado → se usa `ping -n 2 127.0.0.1`. Los `.bat`
  van en CRLF y solo ASCII (si no, `cmd` rompe los comandos).
- Autoprueba de «¿hay becas en unifranz?»: invita sola, muletilla al instante, texto a los ~4 s, termina de hablar
  a los 13 s, dato correcto.

### 5.5 La memoria RAM
Con todo encendido quedaban **1,1 GB libres de 16** y Claude Code cerró la ventana de Tami.
**LM Studio usaba 7,5 GB** (copia del modelo en RAM + módulo de visión + su interfaz). Cerrarlo liberó **7,2 GB**.
→ Decisión 9.

| Medición `llama-server` vs LM Studio | LM Studio | llama-server |
|---|---|---|
| RAM del cerebro | 7,5 GB | ⏳ por medir |
| Primera frase (entrevista) | 1,2–3 s | ⏳ por medir |
| Primera frase (con datos) | 3,6–12 s | ⏳ por medir |

---

## 6. Cómo usar

- **Encender:** doble clic en `INICIAR_TAMI.bat`. La primera vez el modelo tarda en cargar (~1 min).
- **Mover a Tami:** arrastrar la franja de arriba. **Cerrar:** la ✕ o **Ctrl+Q**.
- **Ciclo de feria:** si nadie le habla, invita cada 45 s; si un estudiante se queda callado 90 s, se despide y
  empieza de cero para el siguiente.
- **Probar sin pantalla:** `npx electron src/tami/main.js --autoprueba "¿hay becas?"` → fotos en `capturas\`.
- **Probar el cerebro por consola:** `node scripts/probar-tami.js` (o `node scripts/probar-tami.js "pregunta"`).
- **Cambiar la voz:** editar `voz\voz.json` y reiniciar la voz.
- **Actualizar el catálogo:** `..\windows\python\python.exe cerebro\armar_catalogo.py`.

---

## 7. Pendientes (en orden)

1. ⏳ **Medir `llama-server`** (velocidad y RAM) — necesita el permiso de Juan.
2. **Características para la presentación:**
   - 🎤 Micrófono: botón «mantener para hablar» con Whisper sin internet (en la feria hay mucho ruido).
   - 📄 Ficha de carrera con **QR** a la página oficial cuando Tami recomienda (sin internet; el estudiante se lo
     lleva en el celular).
   - 🔒 Modo feria: sin apagar, cerrar ni cambiar ajustes; atajo secreto para salir.
   - 🕓 Ensayo de 4 horas midiendo la RAM cada minuto.
3. **Cerebro de respaldo** Qwen2.5-3B (decisión 11).
4. **Voz más delicada** (mezclas con otras voces jóvenes, tono).
5. Avatar propio de Juan hecho en VRoid (reemplaza `avatar\tami.vrm`).

---

## 8. Créditos y licencias

- **Capri** — motor base: © 2026 mochiiwuff, <https://github.com/mochiiwuff/capri-desktop>, PolyForm
  Noncommercial 1.0.0 (se puede usar y modificar sin venderlo).
- **Avatar** — «VRM1_Constraint_Twist_Sample» © 2022 pixiv Inc., VRM Public License 1.0 (ver `avatar\CREDITOS.txt`).
- **Modelo de lenguaje** — Qwen3.5-9B (Alibaba / Qwen), GGUF de lmstudio-community.
- **Motor** — llama.cpp (ggml-org), licencia MIT.
- **Voz** — Kokoro-82M (hexgrad), kokoro-onnx (thewh1teagle), Apache 2.0.
- **Datos** — unifranz.edu.bo (descargados en noviembre de 2026). Su `robots.txt` dice `ai-train=no,
  use=reference`: **solo para consultar citando la fuente; no publicar `datos\` ni `cerebro\carreras.json`**.
