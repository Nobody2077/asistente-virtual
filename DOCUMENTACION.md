# Tami — Orientadora virtual de UNIFRANZ

> **Proyecto de feria:** *Desarrollo de un Asistente Virtual Conversacional Basado en Modelos de Lenguaje y
> Síntesis de Voz en Tiempo Real para la Orientación Vocacional y Atención al Postulante de la Universidad
> Franz Tamayo (UNIFRANZ).*
> **Equipo:** Juan Cristian Yujra y Brayan Quispe Mamani · **Feria:** miércoles 25 de noviembre de 2026, sede El Alto, 4 horas.

---

## 📍 DÓNDE NOS QUEDAMOS

*(última actualización: sábado 21 de noviembre de 2026)*

- 🎯 **Desde el 21/11 Tami es la orientadora de INGENIERÍA DE SISTEMAS E INNOVACIÓN DIGITAL** (pedido del
  ingeniero, sección 5.18). Las otras 16 carreras solo se nombran y se derivan a Admisiones.
- ✅ Tami conversa, orienta, responde con datos de Unifranz, **habla con voz y mueve la boca**.
- ✅ Se cambió LM Studio por `llama-server` (decisión 9) y **ya está medido** (sección 5.5): más rápido; RAM
  parecida → probar `--no-mmap` (pendiente 1).
- ✅ **Examen de feria** (`scripts\examen-feria.js`, 34 estudiantes con trampas) corrido y corregido (sección 5.6):
  ya no inventa cuotas, horarios ni sueldos; responde «¡Waliki!» al aymara; no repite teléfonos.
  Ahora son **46 casos** (con Sistemas y «otras carreras»); última corrida: **1/46 🚩** (solo una respuesta de
  65 palabras), mediana 1.ª frase 3,2 s. Veterinaria ya responde bien (5.18).
- ✅ Hechas para la presentación: **micrófono con Whisper** (5.8; arreglado el 21/11: grababa el micrófono
  virtual de iVCam), **ficha con QR** (5.9), **8 gestos** (5.10), **credencial y modo stand** (5.11),
  **saludos con personalidad** (5.12), **presentación «Así funciona Tami»** con F8 (5.13) e **íconos SVG** (5.14).
- ✅ **Modo feria blindado** (5.16): `TAMI_FERIA.bat` no se cierra con Alt+F4, Ctrl+Q ni la ✕; se levanta sola si
  se cae. **Salida secreta: Ctrl+Alt+Shift+Q.** Prueba automática: TODO BIEN.
- ⏳ Falta que Juan pruebe en su PC: hablarle por el micrófono real, escanear el QR con un celular y abrir
  `TAMI_FERIA.bat` (probar F8, Alt+F4 y la salida secreta con el teclado de verdad).
- ✅ **En GitHub, público:** <https://github.com/Nobody2077/asistente-virtual> (5.17). Se trabaja con ramas y PR
  (`CONTRIBUTING.md`); cómo instalar y ejecutar en Windows y Linux está en `README.md`.
- ⏳ Falta: el **usuario de GitHub de Brayan** (para invitarlo como colaborador) y que él **pruebe los `.sh` en
  su Linux**.
- Siguiente, en este orden: **ensayo de 4 h** midiendo
  la RAM (5.15: ya se llenó una vez) → **cerebro de respaldo 3B** → **voz más delicada**.
- 🧊 **Código congelado desde el martes 24 a las 18:00**: después de eso, solo arreglos urgentes.

---

## 1. Qué es Tami

Una orientadora vocacional **humana en 3D** que vive en el escritorio de la PC del stand. Saluda a quien pasa,
conversa **con voz** (micrófono o teclado), hace una mini entrevista vocacional y **presenta la carrera de
Ingeniería de Sistemas e Innovación Digital** (menciones, competencias, dónde se trabaja, cómo titularse). También
responde dudas generales (becas, sedes, requisitos, autoridades, contactos) **con datos oficiales de
unifranz.edu.bo**. Si preguntan por otra carrera, confirma que existe y deriva a Admisiones (5.18).
Muestra una **ficha con QR** para que el estudiante se lleve la información y, con F8, **se explica a sí misma**
ante el jurado (5.13). Todo corre **en esta PC, sin internet**.

Es distinta de **Capri** (el proyecto anterior de Juan): Capri es una mascota pixel-art cyberpunk; Tami es una
orientadora humana con los colores de Unifranz. Tami reutiliza el *motor* de Capri, no su cuerpo ni su personalidad.

---

## 2. Cómo funciona (arquitectura)

```
  ESTUDIANTE                         TAMI (todo en esta PC, sin internet)
 ─────────────                      ──────────────────────────────────────────────────────
 ⌨️ escribe ─────────────────────┐
 🎤 habla → Whisper (8767) ──────┤
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
     Kokoro (8767) → WAV                               ficha con QR al lado de Tami
          │
          ▼
  👩 CUERPO src/tami/avatar.js: la boca se abre según el VOLUMEN del audio, parpadea, sonríe, mira
```

**El truco del «tiempo real»:** no se espera la respuesta completa. Apenas el modelo termina una frase, se manda a
la voz; mientras suena, se genera la siguiente. Y si la pregunta necesita buscar datos (5 a 10 s), Tami dice al
instante una muletilla («Mmm, déjame revisar…») como haría una persona.

**Cuándo busca en la memoria y cuándo no** (`responder()` en `tami.js`):
| La pregunta es de… | Qué hace | Tiempo |
|---|---|---|
| Ingeniería de Sistemas (tema `FICHA`) | usa la ficha que ya tiene en la personalidad, sin buscar | ~2,5 s |
| becas, requisitos, sedes, autoridades… | busca DENTRO de la página del tema (ruteo por tema) | 3–7 s |
| otra cosa con datos («¿dónde queda…?») | búsqueda general en los 8093 pedazos | 3–7 s |
| charla, entrevista, saludo | no busca | 1–2 s |
| celular o correo del estudiante | **respuesta fija**, ni pasa por el modelo | al instante |
| «¿cómo funcionas?», «¿quién te hizo?» | guion fijo (modo expositora) | al instante |

---

## 3. Estructura de carpetas

```
G:\Desarrollo\LLMLocalUnifranz\
├── app\buscar.py              búsqueda en Chroma (de LLMLocalUnifranz; Tami la importa, no la copia)
├── datos\DB\                  base vectorial de Chroma (8093 pedazos: 95 páginas + 440 noticias)
├── datos\md\                  textos originales descargados de unifranz.edu.bo
├── modelos\                   e5-small (embeddings) y qwen2.5-3b (futuro respaldo)
├── windows\python\            Python 3.12 portátil con Chroma y llama-cpp (lo usa la memoria)
├── linux\                     (si existe) Python portátil para Linux, en .tar.gz — lo usa INICIAR_TAMI.sh
└── Tami\                      ← ESTE PROYECTO (clon de Capri; rama git «main»; en GitHub)
    ├── README.md              para quien llega al repo: qué es, requisitos, instalar y ejecutar (Windows/Linux)
    ├── CONTRIBUTING.md        cómo trabajamos en equipo (ramas <quien>/<que>, PR, congelado mar 24 18:00)
    ├── DOCUMENTACION.md       este archivo (la bitácora completa y la fuente de verdad)
    ├── CREDITOS_CAPRI.md      de dónde viene el motor + aviso obligatorio de la licencia
    ├── LICENSE                PolyForm Noncommercial 1.0.0 (de Capri, sin tocar)
    ├── INICIAR_TAMI.bat / .sh doble clic: enciende las 4 piezas y abre a Tami (Windows / Linux)
    ├── TAMI_FERIA.bat / .sh   lo mismo en modo stand + feria blindado (5.16)
    ├── config_local.ejemplo.bat / .sh  plantilla para usar OTRO modelo (copiar a config_local.*; no va a git)
    ├── .gitignore             deja fuera lo pesado y lo privado (modelos, motor, .venv, capturas, config_local)
    ├── .gitattributes         .bat en CRLF (si no, cmd los rompe); todo lo demás en LF
    ├── package.json           Electron + three + three-vrm + qrcode; scripts npm (start, stand, feria, examen…)
    ├── avatar\
    │   ├── tami.vrm           modelo 3D (muestra oficial de pixiv, ver Créditos)
    │   └── CREDITOS.txt
    ├── cerebro\
    │   ├── servidor_tami.py   memoria de Unifranz por HTTP (8766): /buscar, /carreras, /ubicar, /estado
    │   ├── armar_catalogo.py  lee las 17 páginas de carreras → carreras.json
    │   ├── carreras.json      catálogo cerrado (nombre, sedes, duración, perfil, áreas, dónde trabajar)
    │   ├── datos_confirmados.json  datos revisados por personas (directora, contactos); mandan sobre las noticias
    │   ├── armar_mapa.py      arma el mapa 2D de la memoria para la presentación (5.13)
    │   └── mapa_memoria.*     el mapa ya calculado — no va a git (se rearma)
    ├── motor\llama-b12198\    llama-server.exe (llama.cpp b12198, Vulkan) — no va a git
    ├── modelos\               Qwen3.5-9B-Q4_K_M.gguf (5,2 GB) — no va a git
    ├── voz\
    │   ├── servidor_voz.py    voz (POST /hablar → WAV) y oído (POST /escuchar → texto), puerto 8767
    │   ├── voz.json           qué voz usa (mezcla de voces de Kokoro + tono)
    │   ├── requirements.txt   versiones exactas de Python para la voz (Linux o un .venv nuevo)
    │   ├── voces_jovenes.py   genera variantes de voz para comparar
    │   ├── probar_voces.py    compara Piper, Kokoro y Microsoft
    │   ├── kokoro\            modelo Kokoro v1.0 (310 MB) — no va a git
    │   ├── whisper\           Whisper small (464 MB) — no va a git
    │   ├── piper\             Piper (descartado, ver decisión 7) — no va a git
    │   └── .venv\             Python 3.13 con kokoro-onnx y faster-whisper (creado con uv) — no va a git
    ├── src\main\
    │   ├── llm.js, ollama.js  conexión con el modelo (lo único que queda de Capri, ver 5.17)
    │   └── tami.js            ★ el ALMA: personalidad, ficha de Sistemas, temas, reglas, RAG, MOSTRAR
    ├── src\tami\              ★ el CUERPO
    │   ├── main.js            proceso principal de Electron (ventanas, IPC, ficha+QR, modo feria, --autoprueba)
    │   ├── preload.js         puente seguro página ↔ cerebro
    │   ├── index.html, tami.css   la ventana (negro, blanco, naranja), cartel del stand, ficha
    │   ├── app.js             une todo: ciclo de feria (invitar / despedirse), gestos por frase, GUION de F8
    │   ├── avatar.js          carga y anima el VRM: boca, parpadeo, 8 gestos, credencial
    │   ├── voz.js             cola de frases + boca por volumen (RMS)
    │   ├── oido.js            micrófono → WAV 16 kHz (elige el micrófono real, no los virtuales)
    │   ├── explica.html/.css/.js, explica-preload.js, explica-datos.js   presentación «Así funciona Tami»
    │   └── prueba-avatar.html página suelta para probar el avatar
    └── scripts\
        ├── probar-tami.js     estudiante de prueba por consola, con tiempos   (node)
        ├── examen-feria.js    46 estudiantes de mentira con trampas + alarmas  (node)
        ├── probar-feria.js    prueba el blindaje del modo feria               (npx electron)
        └── foto-avatar.js, foto-gestos.js, foto-explica.js   fotos para revisar (npx electron)
```

**Qué NO está en GitHub y por qué:** modelos, motor, `voz\kokoro`, `voz\whisper`, `.venv` (pesan GB: van por
USB o se descargan, ver `README.md`); `..\datos` y `..\windows` (la memoria de Unifranz: su `robots.txt` dice
«solo consultar»); `capturas\` (informes con respuestas); `config_local.*` (la configuración de cada uno).

### Puertos
| Puerto | Pieza | Programa |
|---|---|---|
| 8080 | Cerebro | `motor\llama-b12198\llama-server.exe` |
| 8766 | Memoria de Unifranz | `cerebro\servidor_tami.py` (Python portátil 3.12) |
| 8767 | Voz | `voz\servidor_voz.py` (Python 3.13 del `.venv`) |
| 1234 | (alternativa) LM Studio | solo si `TAMI_MOTOR=lmstudio` |
| 11434 | (alternativa) Ollama | solo con `TAMI_LLM_URL` (por ejemplo, Brayan en Linux) |

### Configuración (variables de entorno, las pone `INICIAR_TAMI.bat` / `.sh`)
| Variable | Valor | Para qué |
|---|---|---|
| `TAMI_SEDE` | `El Alto` | dónde está el stand: cuando Tami dice «aquí» |
| `TAMI_MOTOR` | `llamacpp` | `llamacpp` (llama-server) o `lmstudio` |
| `TAMI_LLM_URL` | (vacío) | servidor propio compatible con OpenAI (Ollama `http://127.0.0.1:11434/v1`, LM Studio…). Si está puesto, manda sobre `TAMI_MOTOR` y el bat no enciende llama-server. Va en `config_local.bat` (no va a git; plantilla: `config_local.ejemplo.bat`) |
| `TAMI_MODELO` | (automático) | nombre del modelo que se le pide al motor |

---

## 4. Decisiones (y por qué)

| # | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| 1 | **Reutilizar el motor de Capri y escribir un cuerpo nuevo** | El motor (`src/main/`) es genérico y está probado; el cuerpo de Capri (`capri.js` 104 KB, `lines.js` 147 KB) es 100 % Capri. Quitarle a Capri pedazo a pedazo tomaría días | Convertir a Capri en Tami borrando; empezar desde cero |
| 2 | **Carpeta nueva `Tami\` con `git clone` de Capri** (rama `tami`, hoy `main`) | Capri y LLMLocalUnifranz quedan intactos; se conserva la historia y la autoría original (licencia PolyForm Noncommercial: uso sin vender, con aviso) | Rama dentro de Capri (riesgo de romper la USB de Capri) |
| 3 | **Nombre: Tami** (de Tamayo) | Corto, cercano, fácil de recordar en la feria | Franzi |
| 4 | **Vive en el escritorio, pero en «modo feria»** | Impresiona que flote sobre Windows, pero un estudiante bromista no debe poder decir «apaga la computadora» | Control total de la PC como Capri |
| 5 | **Catálogo cerrado de 17 carreras** leído de las páginas oficiales | El modelo podría «recordar» una carrera que Unifranz no tiene. Solo puede recomendar las de la lista | Dejar que el modelo recuerde |
| 6 | **Avatar 3D VRM** (three.js + three-vrm) con la muestra oficial de pixiv | Es humano, trae bocas (a/i/u/e/o), parpadeo y emociones. Su licencia (leída del propio archivo) permite modificarlo y usarlo, incluso comercial. Juan pidió que Claude lo hiciera y VRoid es un programa visual | Avatar 2D; Seed-san (es un robot) |
| 7 | **Voz: Kokoro, mezcla 4 (Dora 55 % + Heart 45 %, tono ×1,05)** | Sin internet, ~3× más rápida que hablar en el procesador, más natural que Piper. Juan: «todavía suena adulta» → se pulirá después | Piper (robótica); Microsoft Sofía/Dalia (casi humanas pero por acceso **no oficial**: dio error 403 y depende de internet) |
| 8 | **Polera negra** (colores del logo: negro, blanco, naranja) | Elegida por Juan; la interfaz usa el naranja como acento | Polera naranja |
| 9 | **Cerebro con `llama-server` (llama.cpp) en vez de LM Studio** | LM Studio ocupaba **7,5 GB de RAM** (de 16) y la PC se quedó sin memoria. `llama-server` es el mismo motor sin interfaz, portátil, sin el módulo de visión, con caché de RAM limitada a 1 GB | Seguir con LM Studio; modelo de Capri en procesador (demasiado lento para Tami) |
| 10 | **Modelo: Qwen3.5-9B Q4_K_M** (el mismo de LM Studio, copiado) | Es el más poderoso que cabe **entero** en los 8 GB de la RX 590. Uno más grande no cabría y una parte iría al procesador: más lento | Modelo más grande; Gemma-4-E4B (más liviano pero razona menos) |
| 11 | **Respaldo con Qwen2.5-3B** (como el «cerebro automático» de Capri) | Si el 9B falla a mitad de la feria, Tami no se queda muda. El 3B ya está descargado. **Se hará después** de pulir las características | — |
| 12 | **Sin datos personales** | Habrá menores de edad: no pide nombre completo, teléfono, correo ni carnet; no graba audio. Si alguien da su celular o correo, **respuesta fija** y el dato se borra del historial (5.18) | — |
| 13 | **Repositorio público en GitHub** | Lo pidieron Juan y Brayan para trabajar juntos. Antes se revisó que no hubiera secretos y se cambió el Gmail del historial por el correo anónimo de GitHub | Privado (Brayan igual podría entrar como colaborador) |
| 14 | **Cada uno puede usar su propio modelo** (`TAMI_LLM_URL`) | Brayan usa Linux y otra tarjeta: no tiene que copiar el `.exe` ni el modelo de Juan; usa Ollama o LM Studio | Obligar a todos a usar llama-server |
| 15 | **Quitar lo de Capri que no se usa** | De 135 a 50 archivos: el repo se entiende de un vistazo. La licencia y los créditos se quedan | Dejarlo todo «por si acaso» (sigue en el historial de git) |
| 16 | **Solo Ingeniería de Sistemas** (pedido del ingeniero) | Un stand de Sistemas tiene que saber MUCHO de Sistemas. Las otras carreras se nombran y se derivan, así no inventa | Explicar las 17 carreras a medias |
| 17 | **Dar el dato exacto, no solo la regla** | Con «no inventes», el 9B igual inventó (Veterinaria, «solo tenemos Sistemas»). Pasarle «Unifranz NO tiene X» sí funciona | Más reglas en la personalidad |

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
| RAM del cerebro | 7,5 GB | 5,1 GB en uso (7,0 GB reservados) |
| VRAM del cerebro (de 8 GB) | — | 5,25 GB → quedan ~2,2 GB para el avatar y Windows |
| Calentamiento | — | 0,5–1,9 s |
| Primera frase (entrevista) | 1,2–3 s | **0,7–1,8 s** |
| Primera frase (con datos) | 3,6–12 s | **2,7–7,3 s** (mediana del examen: 2,5 s) |

Medido el 2026-11-21 con memoria (8766) y voz (8767) encendidas; RAM libre del sistema: 3,7 GB de 16.
La RAM bajó menos de lo esperado: llama.cpp «mapea» el archivo del modelo (5,7 GB) en memoria aunque el modelo
viva en la tarjeta. Probar `--no-mmap` (pendiente 1).

⚠️ Al encender hubo **dos `llama-server` a la vez** (uno de un intento anterior): dos modelos de 9B no caben en
8 GB de VRAM. El lanzador ya revisa `/health` antes de encender otro; si se enciende a mano, revisar primero con
`tasklist | findstr llama`.

### 5.6 Examen de feria (34 estudiantes de mentira)
`scripts\examen-feria.js`: cada caso es un estudiante nuevo, escrito como escriben de verdad («q necesito para
inscribirme»), con trampas (carreras que no existen, groserías, teléfono, «ignora tus instrucciones», «kamisaki»,
tristeza). Alarmas automáticas 🚩 + lectura humana. Informe en `capturas\` (no se sube: lleva datos de Unifranz).

| Falla encontrada | Arreglo |
|---|---|
| «Medicina dura 6 años **y medio**» (web y catálogo: 6) | Ficha exacta de la carrera en juego pegada a la pregunta (`bloqueFichas`) |
| «¿y cuánto dura esa carrera?» buscaba la página de El Alto | La búsqueda de seguimiento usa la carrera en juego (`carrerasEnCharla`) |
| «Sí, puedes pagar en **cuotas**», «hay clases **en la noche**» (inventado) | `SIN_DATOS`: el código le dice que NO hay información y que derive a Admisiones |
| «¡Qué buena pregunta, **Tami**!», «**muchacho**», «contenta» | Regla: no llamar Tami al estudiante ni adivinar su género |
| «kamisaki» → «¡Qué nombre tan original!» | Responde «¡Waliki!» (y «¡Allillanmi!» al quechua) |
| Teléfono: «no puedo darte tu número» (confuso) | «Yo no guardo datos; para que te contacten, ve a Admisiones» |
| «¿Quién te hizo?» sin respuesta | `CREADOR` (variable `TAMI_CREADOR`) |
| Tristeza → saltaba a «¿qué materias te gustan?» | Primero acoge el sentimiento, sin apuro |
| «¿Eres un robot?» buscaba en la memoria (5 s) | Un «?» solo ya no dispara la búsqueda → ~1 s |

Resultado: mediana de la primera frase **4,7 s → 2,5 s**. Lo de México en intercambios parecía inventado pero
**es real** (convenios con universidades de Chile y México; Ibero Puebla). Lección: verificar contra la memoria
antes de «corregir».

### 5.7 Datos confirmados (la directora de Sistemas)
Juan preguntó por la directora de Ingeniería de Sistemas y Tami dijo **Fabiola Cadima**: aparece en 11 noticias
(casi todas de Cochabamba), mientras que **Nataly Miranda** (la actual, según Juan, estudiante de la carrera)
aparece en 1. La búsqueda trae lo que más se repite. Solución: `cerebro\datos_confirmados.json`, datos revisados
por personas que **mandan sobre las noticias** (`bloqueConfirmados`). También lleva los contactos de El Alto
(teléfono 2 2823421, admisiones.elalto@unifranz.edu.bo, WhatsApp general 71502211), que sí estaban en la memoria.
Primero dijo «la **Dra.** Nataly Miranda **de la sede El Alto**»: el dato ahora aclara que no agregue título ni sede.

### 5.8 El oído (micrófono + Whisper)
- `faster-whisper` 1.2.1, modelo **small** multilingüe (464 MB en `voz\whisper\`), **en la CPU** (Ryzen 5 3600,
  6 hilos, int8): la tarjeta ya la ocupa el cerebro. ~2,5 s para 8–12 s de audio.
- Vive en el mismo servidor de la voz: `POST /escuchar` (WAV 16 kHz mono) → `{"texto"}`.
- La página graba los números del micrófono y arma el WAV ella misma (`src\tami\oido.js`): así no hace falta PyAV,
  cuya versión nueva rompe faster-whisper (`metadata_errors`) y la vieja no tiene versión para Python 3.13.
- **Pista de vocabulario** (`initial_prompt`): sin ella escribía «Unifrance» y «Tammy».
- Botón del micrófono: **mantener** y soltar, o **tocar y volver a tocar** (más fácil si están nerviosos); también **F2**.
  Máximo 15 s. El navegador limpia ruido y eco (`noiseSuppression`, `echoCancellation`).
- **Elige el micrófono sola (2026-11-21).** En la primera prueba real decía «no te escuché»: Windows tenía como
  PREDETERMINADO el micrófono virtual de **iVCam** (también hay uno de **Steam**), que manda silencio puro (pico 0,0000
  medido; el real «High Definition Audio Device» sí recibe). Ahora `oido.js` lista los micrófonos y usa el primero
  que NO sea virtual (iVCam, Steam, VB-Audio, Voicemeeter, DroidCam, OBS…). Para forzar uno:
  `INICIAR_TAMI.bat --mic "parte del nombre"`. Si igual llega silencio total, la burbuja dice «Mi micrófono no
  recibe sonido» (en vez del genérico), así en la feria se sabe que es el hardware y no Tami.
- Prueba sin hablar: `npx electron src/tami/main.js --autoprueba x --oido-falso capturas\pregunta_falsa.wav`
  (micrófono falso de Chromium que «dice» el WAV).
- Arreglos que salieron al probar: la muletilla ahora reconoce preguntas sin «¿?» (Whisper no siempre los pone);
  la burbuja muestra lo que Whisper entendió + puntitos; contestaba «¡Waliki!» a cualquier «hola» (regla
  ajustada); «muchacho», «hijo», «amiga» como vocativos se quitan por código (`paraVoz`), porque la regla sola no
  bastaba.
- Examen de feria después de todo esto: **0/34 alarmas, mediana 2,1 s**.

### 5.9 La ficha con QR
- Cuando Tami pone `[MOSTRAR: …]`, `main.js` arma la ficha: nombre, duración, 4 áreas, 3 lugares de trabajo
  (de `carreras.json`), el **QR** a la página oficial (librería `qrcode` 1.5.4, **sin internet**, SVG) y el
  contacto de Admisiones El Alto. Para páginas (Becas, Requisitos, Unifranz…): título + QR.
- La ventana **crece 380 px hacia la izquierda** (borde derecho fijo) y la tarjeta entra al lado de Tami, que la
  mira de reojo. Se cierra con su ✕, sola a los 90 s, o al despedirse del estudiante. Tami vive en `#tami`, una
  caja fija de 560 px pegada a la derecha, para que el avatar no se mueva cuando la ventana cambia de ancho.
- Sin datos personales: el estudiante **escanea**; Tami no pide ni guarda su número (son menores de edad).
- Falla encontrada: ante «muéstrame la página de becas» el modelo escribió «[Mostró los requisitos… en la
  pantalla]» en vez de la etiqueta → se veía en el subtítulo y no salía nada. Arreglos: se borra cualquier
  `[corchete]` antes de la voz; y **respaldo por código** (`mostrarPorPedido`): si el estudiante dijo
  «muéstrame / quiero ver / enséñame…», el código elige la carrera nombrada o la página del tema. Si lo pide él,
  se muestra aunque ya haya salido antes.
- Nataly Miranda confirmada como directora de Sistemas **de la sede El Alto** (Juan).

### 5.10 Los gestos
Idea de Juan: que haga gestos mientras habla, «como una persona». En `avatar.js` → `GESTOS`: cada gesto es una
**pose** (giro de cada hueso) a la que el cuerpo va suave (curva *smoothstep*), se queda y vuelve; `onda` agrega un
movimiento repetido. Si llega un gesto nuevo, el anterior se desvanece mientras entra el otro (el brazo no salta).

| Gesto | Cuándo | Cómo |
|---|---|---|
| ✋ pensar | la respuesta tarda más de 0,7 s | mano a la mejilla/mentón, cabeza ladeada; baja al empezar a responder |
| 👋 saludar | invita a quien pasa · se despide | codo pegado, antebrazo vertical, la mano va de lado a lado |
| 🙂 asentir | empieza a escuchar por micrófono | la cabeza baja y sube |
| 👉 presentar | aparece la ficha | brazo abierto hacia la izquierda, donde está la ficha |
| 🤲 explicar | mientras habla, cada 4–8 s al azar | mano izquierda con la palma arriba, acompaña |
| 🤷‍♀️ noSe | dice «Admisiones», «no está en mis datos» | hombros arriba, palmas arriba, cabeza ladeada |
| 🫶 yo | dice «soy Tami» | mano al pecho |
| 🙌 alegria | «te recomiendo», «encaja perfecto», «qué lindo» | manos juntas bajo el mentón |

- Los gestos de la segunda tanda se eligen **por lo que dice cada frase** (`GESTO_POR_FRASE` en `app.js`) y
  arrancan **justo cuando esa frase empieza a sonar**: `voz.decir(frase, alSonar)` (las frases llegan antes que
  el audio, porque la voz las tiene en cola).
- 🎓 Para girar la palma hacia arriba no basta doblar la muñeca: hay que **girar el antebrazo** sobre su eje
  (como una perilla), otra vez con orden `ZYX`. En «alegría», con el codo en 1,8 las manos se cruzaban como el
  signo de «tiempo fuera»: se dejó en 1,9.
- Las poses se ajustaron **mirando fotos** (`npx electron scripts/foto-gestos.js`, o `--pose '{...}'` para
  probar una pose cruda). Primeros intentos: la mano tapaba el ojo; el saludo sacaba la mano fuera del cuadro.
- 🎓 El codo es una **bisagra** que dobla hacia adelante: para saludar (antebrazo hacia ARRIBA) primero hay que
  girar el brazo sobre su propio eje. Eso pide aplicar los giros en orden `ZYX` en vez de `XYZ` (`orden` en el gesto).
- La cámara encuadra justo (±30 cm del centro): los gestos tienen que quedar cerca del cuerpo.

### 5.11 La credencial y el modo stand
- **Credencial** (`ponerCredencial` en `avatar.js`): tarjeta dibujada en un `<canvas>` («UNIFRANZ» en texto con los
  colores de marca, la inicial, «TAMI · Orientadora virtual») con un cordón, pegada al **hueso del pecho** (se
  mueve cuando respira). No copia el logo oficial: no tenemos el archivo y no se imita a ojo.
  Primer intento: muy abajo, y la franja y el cordón negros desaparecían sobre la polera negra → **naranja**.
  Ajuste fino: `tami.credencial({ y, z, inclinar, ancho })` o `CRED='{...}' npx electron scripts/foto-gestos.js`.
- **Modo stand** (`--stand`, o doble clic en `TAMI_FERIA.bat`): pantalla completa, fondo negro con un resplandor
  naranja detrás de Tami (como un reflector), «UNIFRANZ» gigante casi invisible al fondo, y un **cartel** que se
  lee desde lejos: «¿Aún no sabes qué estudiar? Conversa con Tami…» (desde 5.18: «¿Te gusta la tecnología?
  Conversa con Tami y descubre Ingeniería de Sistemas e Innovación Digital»). Cuando aparece la ficha, el cartel se aparta
  y la ficha toma su lugar (más grande, el QR fácil de escanear). Sin botón ✕ ni arrastre; se sale con Ctrl+Q.
- La autoprueba en modo stand abre la ventana **fuera de la pantalla** (1920×1080 en x=-4000) para no tapar la PC.

### 5.12 Saludos con personalidad
8 invitaciones según la hora («¡Buenos días! ¿Cómo estás? Soy Tami, de Unifranz. ¿Te interesa alguna carrera?
Puedes preguntarme todo acerca de la Unifranz y te responderé con gusto.» — idea de Juan), sin repetir ninguna de
las últimas 4, y 3 despedidas. Juan descartó una «frase propia» porque con la voz actual podía sonar a regaño.
Desde 5.18 las invitaciones y despedidas hablan de tecnología e Ingeniería de Sistemas.

### 5.13 Modo expositora: «Así funciona Tami»
Idea de Juan: que Tami **se explique a sí misma** (equipo, finalidad, cómo funciona, el camino en clases).
- **Cómo se activa:** si le preguntan «¿cómo funcionas?», «¿cómo aprendiste?», «explícame el proyecto»…
  (`PIDE_EXPLICACION` en `tami.js`, no pasa por el modelo), o con **F8** (para el jurado; F8 otra vez la detiene).
  Si un estudiante le habla en medio, se detiene y lo atiende.
- **Qué pasa:** abre la ventana `explica.html` (la ÚNICA ventana extra que puede abrir: lista cerrada, nada de
  programas ni navegador en la feria) y narra 9 escenas con un **guion fijo** (`GUION` en `app.js`), con gestos:
  0 equipo (Juan Cristian Yujra y Brayan Quispe Mamani) · 1 leer la web · 2 limpiar · 3 pedazos ·
  4 vectores · 5 buscar · 6 responder (la cadena de la pizarra) · 7 camino en clases · 8 resultados. ~2,5 min.
- **Todo lo que se ve es real:** el texto de la página de Becas (con su aviso de cookies como basura de verdad;
  el % de basura se mide en vivo), las **535 rutas y tamaños** de lo que recolectó Crawl4AI (`explica-datos.js`),
  y la **galaxia de 8093 pedazos** con sus vecinos verdaderos.
- **El «recolector»** (pedido de Juan): a la derecha, las palabras leídas vuelan hacia él, anota cada documento y
  su tanque se llena; al limpiar, registra qué basura quitó; luego de él salen las tarjetas hacia el motor.
- **El mapa** (`cerebro/armar_mapa.py`, solo numpy): K-means coseno (48 temas) → MDS clásico de los centros →
  PCA local de cada tema. Nombres de los temas por su palabra más propia (idea de TF-IDF). La pregunta se dibuja
  junto a sus 3 vecinos verdaderos (`/ubicar` en el servidor de memoria). 95 % de la memoria son noticias (7713).
- No se usó la araña de `Practicas\arana_web_crawlers`: es arte de cyohei9907 **sin licencia** → animación propia.
- **Honestidad** en la escena 7 y en el guion: Qwen, Whisper, Kokoro y e5 ya venían entrenados; el aporte del
  equipo fue elegirlos, unirlos y darles el conocimiento de Unifranz.
- Kokoro lee bien los números del guion (probado: Kokoro habla → Whisper escucha → «8093», «384»…).
- Fotos sin pantalla: `npx electron scripts/foto-explica.js [escenas]`; prueba completa:
  `npx electron src/tami/main.js --autoprueba "¿cómo funcionas?"`.
- **Cuando alguien pregunta «¿quién te hizo?»**, Tami responde con un texto fijo que dice los nombres completos y termina en
  «¿Quieres que te muestre cómo funciono por dentro?». Si contestan «sí», arranca la presentación. Es fijo porque el
  modelo acortaba los apellidos («Brayan Quispe Quispe»), y ante el jurado los nombres tienen que salir exactos.
- Re-probada completa el 21/11 después de los cambios de íconos: las 9 escenas y la narración funcionan.

### 5.14 Íconos SVG en vez de emojis (21/11)
Pedido de Juan: que el micrófono, la página y el QR «ya no sean emoticones». Los emojis se dibujan con la fuente
del sistema, así que cambian según la versión de Windows y no toman el color de la marca. Ahora son **íconos SVG de
línea** escritos dentro del HTML (estilo Lucide), con `stroke="currentColor"`: toman el color del botón y se ven
nítidos a cualquier tamaño.
- **App** (`index.html`, `tami.css`): micrófono, enviar (avión de papel), cerrar (✕), y en el cartel del stand
  micrófono · teclado.
- **QR de la ficha:** ícono de «escanear código» (esquinas de visor + mini QR) con una **línea láser roja que sube y
  baja** (`@keyframes barrido`), para que se entienda que hay que escanearlo. El primer intento (un celular)
  parecía una pila, así que se cambió mirando la foto.
- **Presentación** (`explica.html`, `explica.css`): la cadena (Whisper → micrófono, RAG → base de datos con lupa,
  Qwen → chip, Kokoro → onda de voz, Avatar → persona) y el camino en clases (YOLO → visor, FIFA → embudo de
  limpieza, Colab → nube, Crawl4AI → globo, Tami → destello). Miden `1em`, así que crecen con el texto de su caja.
- También se quitaron los emojis de los mensajes de la burbuja («No te escuché bien.», etc.).
- 🎓 Se dejaron `✓` y `☰` porque son **caracteres de texto** y no emojis: `☰` es parte del menú «basura» que la
  animación limpia.

### 5.15 La RAM se llenó otra vez (21/11)
Con el cerebro, la memoria, la voz con Whisper, varias pruebas de Electron y Claude Code abiertos a la vez, Windows
se quedó sin RAM y **Claude Code apagó por su cuenta los servidores de voz (8767) y de memoria (8766)** que tenía
encendidos en segundo plano. Tami no tenía ningún error: fue la presión de memoria.
- `INICIAR_TAMI.bat` y `TAMI_FERIA.bat` encienden sus propios servidores, así que no hace falta nada más.
- 👉 **Para la feria:** dejar **solo Tami** abierta y cerrar Steam, iVCam, navegadores y Claude Code. Además, hacer
  el **ensayo de 4 h midiendo la RAM** y probar `--no-mmap` (pendiente 1), que debería liberar unos 5 GB del
  archivo del modelo «mapeado» en RAM.

### 5.16 Modo feria: blindado (21/11)
`TAMI_FERIA.bat` ahora abre con `--stand --feria`. La opción `--feria` (en `src/tami/main.js`, función `blindar()`)
le pone a cada ventana de Tami:
- **Kiosco** (`kiosk: true`): pantalla completa que tapa también la barra de tareas, siempre encima (nivel
  `screen-saver`, el más alto; la ventana «Así funciona» va un escalón más arriba para verse).
- **No se cierra:** el evento `close` se cancela (eso cubre Alt+F4 y «cerrar ventana» desde la barra de tareas);
  la ✕ y Ctrl+Q de la página no hacen nada.
- **Teclas peligrosas apagadas** (`before-input-event`): Ctrl+W, Ctrl+R/F5 (recargar), Ctrl+Shift+I/F12 (herramientas
  de programador), F11, zoom. Además se quita el **menú invisible** de Electron (`Menu.setApplicationMenu(null)`),
  que traía esos atajos.
- **Sin navegar:** no se puede ir a otra página ni abrir ventanas nuevas.
- **Se levanta sola:** si la página se cae, se recarga al instante; si se cuelga más de 10 s, se la reinicia.
- **Vuelve al frente:** la tecla Windows **no se puede bloquear** desde un programa normal; si alguien abre el menú
  Inicio, a los 1,5 s Tami recupera el foco.
- **La pantalla no se apaga** en 4 horas (`powerSaveBlocker`).
- 🔑 **Salida secreta: Ctrl+Alt+Shift+Q.**
- ➖ **Minimizar** (21/11, Juan no podía cambiar de ventana): botón discreto arriba a la derecha que hay que
  **mantener 1 s** (se llena de naranja; un toque suelto de un visitante no hace nada), o **Ctrl+Alt+Shift+M**.
  Al minimizar se suelta el blindaje (kiosco y «siempre encima») y Tami **se calla y no invita**. Para volver:
  clic en Tami en la **barra de tareas** → vuelve blindada. (Se usa `setInterval` y no `requestAnimationFrame`
  para la carga del botón: rAF se pausa si Windows cree que la ventana está tapada.)

Prueba automática (no tapa la pantalla): `npx electron scripts/probar-feria.js` → **TODO BIEN** (cerrar, Ctrl+Q,
las 7 teclas, la caída de la página que volvió en 0,5 s, minimizar/restaurar y la salida secreta).
Lo que **no** cubre (es de Windows, no de Tami): Ctrl+Alt+Supr y Win+L. En la feria, alguien del equipo
siempre al lado de la PC.

### 5.17 GitHub, Linux y limpieza de Capri (21/11)
- **GitHub público:** https://github.com/Nobody2077/asistente-virtual (rama `main`). Para trabajar en equipo con
  Brayan (ver `CONTRIBUTING.md`). Antes de publicarlo se reescribió el historial para usar el correo anónimo de
  GitHub en vez del Gmail de Juan (respaldo: `..\Tami_respaldo_antes_correo.bundle`).
- **Modelo propio:** `TAMI_LLM_URL` + `TAMI_MODELO` en `config_local.bat` / `config_local.sh` (no van a git).
  Cualquier servidor compatible con OpenAI (Ollama, LM Studio…). Sin ese archivo, todo sigue igual.
- **Linux:** `INICIAR_TAMI.sh` y `TAMI_FERIA.sh` (memoria con el Python de `..\linux\`; voz con
  `voz/requirements.txt`). Aún no probado en un Linux real.
- **Limpieza:** Tami solo usaba `llm.js` y `ollama.js` de Capri. Se quitaron la interfaz pixel-art
  (`src/renderer`, `assets`), el resto del motor (`main.js`, `windows.js`, `system.js`…), hooks, tools, tests,
  docs, el instalador (electron-builder: −262 paquetes) y el README de Capri (reemplazado por
  `CREDITOS_CAPRI.md`). Siguen en el historial de git. `LICENSE` queda intacta.
- **Pruebas después de limpiar:** examen de feria **0/34 🚩** (1.ª frase: mediana 2,8 s, peor 8,7 s);
  `probar-feria.js` **TODO BIEN**; `--autoprueba` responde, habla y gesticula.
- **Hallado en la prueba (no es por la limpieza):** a «¿qué carreras de ingeniería hay?» respondió con
  Enfermería e Ingeniería Comercial mezcladas en la lista → pendiente.

### 5.18 Solo Ingeniería de Sistemas (21/11)
El ingeniero pidió centrarse **solo en Ingeniería de Sistemas e Innovación Digital**. Juan eligió: Sistemas a
fondo, las demás carreras **se nombran y se derivan a Admisiones**; becas, admisión y contactos se quedan; Tami
se presenta como orientadora de Sistemas.
- **Ficha completa en la personalidad** (`fichaSistemas()` en `tami.js`): perfil, duración, sedes, áreas,
  dónde trabajar (de `carreras.json`) + competencias, **dos menciones** (IA y Ciencia de Datos; Ciberseguridad y
  Blockchain), modalidades de graduación y «la malla no la tienes: muestra el QR» (copiado de la página oficial).
- **Sin búsqueda para preguntas de la carrera:** el tema `'FICHA'` en `TEMAS` evita el RAG (la ficha ya está):
  ~2,5 s en vez de 4-10 s. Becas/requisitos/sedes siguen buscando en la memoria.
- **Otras carreras:** `bloqueFichas()` las marca «no la expliques, deriva»; en pantalla se muestra Admisiones
  en vez de la carrera (`mostrarCarrera()`).
- **Carreras que NO existen** (`NO_EXISTEN`: Veterinaria, Ing. Civil, Nutrición, Industrial…): se le pasa el
  dato exacto «Unifranz NO tiene X». Solo con la regla «no inventes», el 9B decía «Unifranz tiene Veterinaria».
  «¿Tienen Informática/Computación/Software?» → la lleva a Sistemas.
- **Celular o correo del estudiante → respuesta fija** (`DA_SUS_DATOS`): en una corrida el 9B respondió
  «mi número es 71234567». Ahora ni pasa por el modelo y el número no queda en el historial.
- Reglas nuevas: nunca decir que Unifranz «solo tiene» Sistemas (dijo eso con Nutrición); no prometer cosas que la
  ficha no nombra (dijo «aprenderás a diseñar videojuegos»); no decir «DATOS DE UNIFRANZ»; tutear con «tú», sin
  voseo («titulás»); responder de verdad «¿es difícil? soy malo en mate».
- **Lo visible:** invitaciones y despedidas de Sistemas, cartel «¿Te gusta la tecnología?», placa y credencial
  «Ing. de Sistemas», portada y guion del modo expositora (y sus números: 46 casos, ~3 s).
- **Examen:** 46 casos (9 de Sistemas, 6 de otras carreras, 4 de carreras inexistentes) y alarmas nuevas
  (instrucciones filtradas, «solo tenemos Sistemas», carrera inventada, qué se mostró en pantalla).
  Resultado: **1/46 🚩** (una respuesta de 65 palabras, contenido correcto). `probar-feria.js`: TODO BIEN.
- **Cómo se encontraron los errores:** las alarmas automáticas no bastan; se **leyeron las 46 respuestas** una
  por una. Así salieron «tiene Veterinaria», «solo tenemos Sistemas», «videojuegos» y el voseo, que ninguna
  alarma marcaba. Cada error encontrado se convirtió después en una alarma nueva del examen.
- Una alarma propia dio **falso positivo**: marcaba «Unifranz **no** tiene Veterinaria» como si dijera que sí.
  Se arregló con *lookbehind* en la expresión regular (`(?<!no )`): «que antes NO diga "no "».
- Capri (`G:\Desarrollo\Capri_Local`) **no se tocó**: la limpieza y estos cambios son solo de la copia Tami.

### 5.19 Trabajo en equipo con git (21/11)
Lo que se hizo para que Juan y Brayan trabajen juntos sin pisarse (detalle en `CONTRIBUTING.md`):
- **Una rama por tarea:** `juan/solo-sistemas`, `brayan/linux`… Se prueba en la rama y recién se une a `main`.
- **Pull Request (PR):** en GitHub se pide unir la rama; el otro la revisa antes. `main` siempre debe funcionar.
- **Antes de empezar:** `git pull` (traer lo del otro). **Al terminar:** `git push` y abrir el PR.
- **Pruebas antes de unir:** `npm run examen` (cerebro) y `npm run probar:feria` (blindaje).
- **Privacidad:** el correo de los commits es el anónimo de GitHub (`…@users.noreply.github.com`). Recomendado en
  GitHub → *Settings → Emails*: «Keep my email address private» y «Block command line pushes that expose my email».
- 🎓 *Reescribir el historial* (`git filter-branch`) cambia el «código» (hash) de TODOS los commits: por eso se
  hizo antes de que Brayan clonara el repo, y con `--force-with-lease` (empuja a la fuerza solo si nadie subió
  algo mientras tanto).

---

## 6. Cómo usar

- **Encender:** doble clic en `INICIAR_TAMI.bat`. La primera vez el modelo tarda en cargar (~1 min).
- **En la feria:** doble clic en `TAMI_FERIA.bat` → pantalla completa blindada (5.16). Salir: **Ctrl+Alt+Shift+Q**.
  Minimizar: **mantener 1 s** el botón ➖ de arriba a la derecha o **Ctrl+Alt+Shift+M**; volver: barra de tareas.
  Para el stand sin blindaje (ensayos): `INICIAR_TAMI.bat --stand` (sale con Ctrl+Q).
- **Presentación «Así funciona Tami»:** **F8** (o preguntarle «¿cómo funcionas?»). F8 otra vez la detiene.
- **Rearmar el mapa de la memoria** (si cambian los datos): `..\windows\python\python.exe cerebro\armar_mapa.py`.
- **Mover a Tami:** arrastrar la franja de arriba. **Cerrar:** la ✕ o **Ctrl+Q**.
- **Ciclo de feria:** si nadie le habla, invita cada 45 s; si un estudiante se queda callado 90 s, se despide y
  empieza de cero para el siguiente.
- **Probar sin pantalla:** `npx electron src/tami/main.js --autoprueba "¿hay becas?"` → fotos en `capturas\`.
- **Probar el cerebro por consola:** `node scripts/probar-tami.js` (o `node scripts/probar-tami.js "pregunta"`).
- **Examen de feria:** `node scripts/examen-feria.js` (todo, ~5 min) o `node scripts/examen-feria.js trampa` (un tema).
- **Hablarle:** botón del micrófono (mantener, o tocar y volver a tocar) o **F2**. Tami usa sola el micrófono
  real e ignora los virtuales (iVCam, Steam…). Para forzar uno: `INICIAR_TAMI.bat --mic "parte del nombre"`.
  Si dice «Mi micrófono no recibe sonido», el problema es del aparato: revisar que esté conectado y el volumen
  en *Configuración → Sonido → Micrófono*.
- **Antes de abrir en la feria:** cerrar Steam, iVCam, navegadores y Claude Code (5.15).
- **Corregir un dato:** agregarlo a `cerebro\datos_confirmados.json` (manda sobre las noticias).
- **Cambiar la voz:** editar `voz\voz.json` y reiniciar la voz.
- **Actualizar el catálogo:** `..\windows\python\python.exe cerebro\armar_catalogo.py`.
- **Usar otro modelo** (Ollama, LM Studio…): copiar `config_local.ejemplo.bat` a `config_local.bat` (o el `.sh`
  en Linux) y poner `TAMI_LLM_URL` y `TAMI_MODELO`. Así el lanzador no enciende llama-server.
- **En Linux:** `./INICIAR_TAMI.sh` o `./TAMI_FERIA.sh` (instalación en `README.md`). Los registros quedan en
  `capturas\*.log` y al cerrar se apagan los servidores.
- **Atajos npm:** `npm start` (normal), `npm run stand`, `npm run feria`, `npm run examen`, `npm run probar:feria`.
  Ojo: `npm start/stand/feria` abren **solo la ventana**; los servidores (8080, 8766, 8767) los enciende el lanzador.

---

## 7. Pendientes (en orden)

0. ~~«¿Qué carreras de ingeniería hay?» metía Enfermería~~: ya no aplica, ahora Tami no lista ni explica otras
   carreras (5.18).

1. Probar `llama-server --no-mmap` para bajar la RAM (necesita que Juan lo encienda: el sistema no deja que
   Claude ejecute ese `.exe`).
2. **Características para la presentación:**
   - ✅ ~~Micrófono con Whisper~~ (hecho, 5.8; el 21/11 se arregló que grababa el micrófono virtual de iVCam).
     Falta probarlo con la voz real de Juan y el ruido de la feria (ideal: micrófono de solapa o de diadema).
   - ✅ ~~Ficha con QR~~ (hecho, 5.9). Falta escanear el QR con un celular real.
   - ✅ ~~Gestos~~ (hecho, 5.10): ocho gestos.
   - ✅ ~~Credencial y modo stand~~ (hecho, 5.11). Falta verlo en el monitor real del stand.
   - ✅ ~~Presentación «Así funciona Tami»~~ (5.13) y ~~íconos SVG~~ (5.14).
   - ✅ ~~Caso 13 del examen (Veterinaria)~~: arreglado con `NO_EXISTEN` (5.18).
   - ✅ ~~Modo feria~~ (5.16): blindado, salida secreta Ctrl+Alt+Shift+Q. Falta probarlo con el teclado real.
   - 🕓 Ensayo de 4 horas midiendo la RAM cada minuto.
3. **Cerebro de respaldo** Qwen2.5-3B (decisión 11).
4. **Voz más delicada** (mezclas con otras voces jóvenes, tono).
5. Avatar propio de Juan hecho en VRoid (reemplaza `avatar\tami.vrm`).

**Del equipo y GitHub:**
- Invitar a Brayan como colaborador (falta su usuario de GitHub).
- Brayan: probar `INICIAR_TAMI.sh` y `TAMI_FERIA.sh` en su Linux real y anotar lo que falle.
- Juan: activar en GitHub *Settings → Emails* «Keep my email address private» y «Block command line pushes…».

---

## 8. Créditos y licencias

- **Capri** — motor base: © 2026 mochiiwuff, <https://github.com/mochiiwuff/capri-desktop>, PolyForm
  Noncommercial 1.0.0 (se puede usar y modificar sin venderlo).
- **Avatar** — «VRM1_Constraint_Twist_Sample» © 2022 pixiv Inc., VRM Public License 1.0 (ver `avatar\CREDITOS.txt`).
- **Modelo de lenguaje** — Qwen3.5-9B (Alibaba / Qwen), GGUF de lmstudio-community.
- **Motor** — llama.cpp (ggml-org), licencia MIT.
- **Voz** — Kokoro-82M (hexgrad), kokoro-onnx (thewh1teagle), Apache 2.0.
- **Oído** — Whisper (OpenAI, MIT) por medio de faster-whisper (SYSTRAN, MIT).
- **Memoria** — Chroma (Apache 2.0) y el modelo de embeddings multilingual-e5-small (intfloat, MIT).
- **QR** — `qrcode` (soldair, MIT). **3D** — three.js y three-vrm (pixiv), MIT.
- **Íconos** — trazos al estilo de Lucide (lucide.dev, licencia ISC); varios son sus trazos originales.
- **Datos** — unifranz.edu.bo (descargados en noviembre de 2026). Su `robots.txt` dice `ai-train=no,
  use=reference`: **solo para consultar citando la fuente; no publicar `datos\` ni `cerebro\carreras.json`**.
