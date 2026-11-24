---
name: procedural-barista-assistant-3d-v3
description: Sistema completo de animacion procedural por escenas y estados en Three.js + @pixiv/three-vrm para Tami (asistente de cafeteria en Electron). Incluye articulacion individual de los 15 huesos de dedos por mano, estado THINKING_QUESTION (dedo indice en el menton analizando la pregunta del usuario), poses expresivas de referencia (mano en la frente buscando/observando, frotarse un ojo con sueno, sonrisa calida con cabeza ladeada, giros de perfil a ambos lados de pantalla, saludo inicial corregido) y transicion profesional/relajada.
---

# Procedural Barista Assistant 3D v3 (Escenas, Dedos y Personalidad Completa)

Especificacion tecnica detallada por escenas para que el agente CLI implemente y refine los modulos `assistant-state-controller.js`, `procedural-body-animator.js`, `procedural-face-controller.js` y `avatar.js` usando el esqueleto normalizado de `@pixiv/three-vrm`.

---

## 1. Mapa Completo de Huesos VRM (Incluyendo Articulacion de Dedos)

El rig humanoide VRM dispone de **3 falanges por dedo** en ambas manos (`left` y `right`):
- **Pulgar:** `ThumbMetacarpal` (o `ThumbProximal`), `ThumbIntermediate`, `ThumbDistal`
- **Indice:** `IndexProximal`, `IndexIntermediate`, `IndexDistal`
- **Medio:** `MiddleProximal`, `MiddleIntermediate`, `MiddleDistal`
- **Anular:** `RingProximal`, `RingIntermediate`, `RingDistal`
- **Menique:** `LittleProximal`, `LittleIntermediate`, `LittleDistal`

> NOTA del modelo real de Tami: no existe `ThumbIntermediate`; el pulgar tiene
> `ThumbMetacarpal`, `ThumbProximal` y `ThumbDistal` (14 falanges por mano, no 15).
> El codigo debe omitir huesos ausentes en vez de crearlos.

### Reglas de Flexion de Dedos en `three-vrm` (T-Pose Normalizada)
En pose T mirando a `+Z`, las palmas apuntan hacia abajo (`-Y`):
- **Cerrar/flexionar dedos (`Index`, `Middle`, `Ring`, `Little`):** Rotar alrededor del eje **`Z`** (`+` para mano derecha `right*`, `-` para mano izquierda `left*`) entre `0.0` rad (estirado) y `1.45` rad (cerrado en puno).
- **Abrir/separar dedos (abduccion):** Rotar ligeramente `Proximal.y` (`±0.08` a `±0.15` rad).
- **Pulgar (`Thumb`):** Combina rotacion en `Y` (oposicion hacia la palma) y `Z` (flexion).
- **Pose Base de Mano Relajada (NUNCA dejar dedos rigidos en 0):** En estado neutro/relajado, aplicar una curvatura natural progresiva:
  - Indice: `0.18` rad | Medio: `0.26` rad | Anular: `0.34` rad | Menique: `0.42` rad por falange.

---

## 2. Correccion Critica del Saludo Inicial (`greeting` / `CASUAL_HAND_WAVE`)

Para evitar que la mano derecha salga al reves (dorso hacia camara):
1. **`rightUpperArm`:** `x: -0.25`, `y: -0.15`, `z: 1.05` rad.
2. **`rightLowerArm`:** Flexion de codo `z: 1.90` rad + **supinacion axial** `x: -1.35` rad para girar la palma hacia `+Z` (camara).
3. **`rightHand`:** `x: -0.25`, `y: 0.0`, `z: 0.05` rad + vaiven `±0.18 * Math.sin(t * 6.0)`.
4. **Dedos en saludo:** Estirar ligeramente los 4 dedos (`0.08` rad) y separar apenas (`spread: 0.06` rad) con el pulgar hacia el lado medial (hacia la cara).

> Verificacion real: comparar `thumb.x < little.x` NO discrimina en este VRM (siempre se cumple).
> Medir la normal de la palma `(indice - muneca) x (menique - pulgar)`; debe dar `+Z` (> 0.6).

---

## 3. Escenas Comportamentales (`AssistantStateController`)

El controlador gestiona **4 estados principales** con pesos suavizados (`1 - Math.exp(-velocidad * dt)`):

### Escena A: `THINKING_QUESTION` (Pensando la pregunta del usuario)
- **Cuando se activa:** Justo cuando el usuario envia una pregunta y el asistente esta procesando/pensando la respuesta (antes de empezar a hablar, o mediante `onThinkingStart()`).
- **Pose Corporal y Dedos (Dedo indice en el menton):**
  - **Brazo derecho:** Sube la mano hacia la barbilla (`rightUpperArm`: `x: -0.78`, `y: 0.52`, `z: 0.85`; `rightLowerArm`: `y: 1.75`, `x: -0.45`; `rightHand`: `x: 0.25`, `z: -0.35`).
  - **Articulacion de dedos (Clave):**
    - **`rightIndexProximal/Intermediate/Distal`:** Semi-extendido (`0.12`, `0.15`, `0.10` rad) apuntando suavemente hacia la comisura del menton/labio inferior.
    - **`rightMiddle`, `rightRing`, `rightLittle`:** Flexionados hacia la palma (`1.15`, `1.25`, `1.35` rad por falange) formando un puno suave bajo la barbilla.
    - **`rightThumb`:** Recogido lateralmente (`y: 0.45`, `z: 0.55` rad).
  - **Cabeza y Expresion:** Cabeza ladeada (`head.rotation.z: 0.13`, `head.rotation.y: -0.16`, `head.rotation.x: -0.06`), ojos mirando hacia arriba-lado (`lookUp: 0.62`, `lookLeft: 0.25`), cejas pensativas (`surprised: 0.14`, `relaxed: 0.25`, `ou: 0.18` boca fruncida pensando).

> AJUSTE medido en el VRM real: los angulos del spec dejaban la yema del indice a ~0.39 m del menton
> (junto a la sien). Los angulos finales `upper [-0.32,-0.03,1.00]`, `lower [0.13,-0.21,2.72]`,
> `hand [-0.39,0,0.27]` dejan el dedo a ~0.06-0.11 m del menton. Los valores de flexion del puno
> se reparten progresivamente ([0.65,0.95,1.15] etc.) para que las falanges no se atraviesen.

### Escena B: `PROFESSIONAL_ATTENTIVE` (Escuchando o respondiendo al usuario)
- **Cuando se activa:** Mientras el usuario habla/escribe o mientras Tami responde. Reinicia `inactivityTimer = 0` y cancela acciones idle en `~0.35s`.
- **Pose:** Columna erguida (`hips.rotation` centrada), mirada fija a camara con leve inclinacion atenta (`2° - 4°`), manos con gesticulacion explicativa contenida y dedos en curvatura natural.
- **Expresion:** Serena, amable y profesional (`neutral: 0.70`, `happy: 0.22`, `angry: 0.10` para firmeza de cejas).

### Escena C: `CAFE_RELAXED` (0s a 15s tras terminar de responder)
- **Pose:** Apoyo asimetrico en cadera con contrapeso en hombros, respiracion dual desfasada en `spine` y `chest`, mirada ambiental con ruido Perlin FBM y sonrisa calida (`happy: 0.45`, `relaxed: 0.35`).

### Escena D: `BORED_IDLE_ACTIONS` (Mas de 15s-30s sin preguntas - Repertorio de Escenas)
Cada `5s - 9s` ejecuta una escena distinta con envolvente suave `curva = Math.sin(suave(p) * Math.PI)`:

1. **`POSE_FOREHEAD_SALUTE_LOOK` (Mano en la frente mirando lejos + mano en cintura):**
   - **Brazo izquierdo (o derecho):** Sube la mano a la frente como visera (`leftUpperArm`: `x: -1.15`, `z: -0.75`; `leftLowerArm`: `z: -2.05`, `x: 0.65`; `leftHand`: `x: 0.35`) con los 4 dedos juntos y estirados (`0.06` rad) tocando ligeramente la frente.
   - **Brazo contrario:** Mano apoyada en la cintura (`upperArm`: `x: 0.22`, `z: 0.55`; `lowerArm`: `z: 1.45`) con dedos abiertos abrazando la cadera.
   - **Torso y Cara:** Gira ligeramente de perfil (`hips.rotation.y: 0.28`, `head.rotation.y: 0.22`), ojos curiosos (`surprised: 0.35`, `lookRight: 0.55`, `ou: 0.20`).
2. **`POSE_SLEEPY_EYE_RUB` (Frotarse un ojo con sueno / cansancio tierno):**
   - **Brazo derecho:** Eleva el dorso/nudillos de la mano derecha cerca del ojo derecho (`rightUpperArm`: `x: -0.95`, `y: 0.35`, `z: 0.90`; `rightLowerArm`: `z: 2.15`, `x: -0.35`).
   - **Dedos:** Todos los dedos flexionados suavemente en puno relajado (`0.95` a `1.15` rad por falange) haciendo un micro-vaiven circular (`±0.04` rad) frente al ojo derecho.
   - **Cara:** Cierra el ojo derecho (`blinkRight: 0.95`), deja el izquierdo semiabierto (`blinkLeft: 0.25`), boca pequena (`ou: 0.28`, `sad: 0.25`, `relaxed: 0.40`).
3. **`POSE_WARM_HEAD_TILT_SMILE` (Sonrisa coqueta con ojos cerrados y cabeza bien ladeada):**
   - **Postura:** Inclina fuertemente la cabeza hacia un hombro (`head.rotation.z: 0.26`, `neck.rotation.z: 0.12`), eleva ligeramente ambos hombros con ternura (`leftShoulder.z: -0.08`, `rightShoulder.z: 0.08`) e inclina el torso (`spine.rotation.x: 0.09`).
   - **Cara:** Ojos cerrados felices (`blink: 0.92`, `happy: 0.85`, `relaxed: 0.45`).
4. **`SIDE_PROFILE_LOOK_LEFT` / `SIDE_PROFILE_LOOK_RIGHT` (Giro de perfil hacia los costados de pantalla):**
   - Cadena cinematica `hips.rotation.y (±0.42)` -> `spine (±0.25)` -> `chest (±0.20)` -> `neck (±0.22)` -> `head (±0.30)`, guiado primero por los ojos (`lookLeft` / `lookRight: 0.75`).
5. **`CASUAL_HAND_WAVE` (Levantar una mano saludando casualmente):**
   - Saludo breve con palma corregida hacia el frente, sonrisa (`happy: 0.65`) e inclinacion de cabeza.
6. **`LEAN_FORWARD_WINDOW` (Acercar la cara mirando por la ventana):**
   - Inclina columna y cuello hacia `+Z` (`spine.x: 0.18`, `chest.x: 0.14`, `neck.x: 0.12`, `head.x: -0.24`) entrecerrando ojos (`ee: 0.30`).
7. **`STRETCH_WARMUP` (Estiramiento de hombros y brazos):**
   - Eleva ambos brazos estirando espalda (`chest.x: -0.14`), dedos abiertos (`0.05` rad) y ojos cerrados (`blink: 0.65`, `relaxed: 0.75`).
8. **`HAIR_ADJUST` (Acomodarse el cabello tras la oreja):**
   - Sube mano derecha al lateral de la cabeza con indice y medio ligeramente extendidos (`0.15` rad) y los demas recogidos (`0.85` rad).
9. **`SUBTLE_DANCE` (Baile ritmico de cafeteria a 118 BPM):**
   - Balanceo sincronizado de cadera, hombros, rodillas y cabeza con manos relajadas al ritmo.
10. **`LOOK_AROUND_CEILING_SIGH` (Mirar al techo y suspirar):**
    - Eleva mirada (`lookUp: 0.75`), expande pecho y lo suelta con expresion `relaxed: 0.65`, `ou: 0.25`.

---

## 4. Reglas Inquebrantables de Implementacion (VRM / Three.js)

1. **NUNCA modificar `hips.position`:** Mantener `hips.position` intacto para no sacar el VRM de camara.
2. **Pose Base + Mezcla Absoluta:** Reescribir la pose base de cuerpo y dedos cada frame, aplicando la escena activa con `hueso.rotation[eje] += (objetivo - hueso.rotation[eje]) * k` donde `k = suave(this._pesoAccion)`.
3. **Actualizar `progreso` cada frame:** `progreso = 1 - Math.max(0, duracionRestante) / duracionTotal`.
4. **Habla como Delta:** Sumar oscilaciones de voz en `avatar.js` como delta (`nuevo - anterior`) para no pisar inclinaciones de cabeza.

---

## 5. Verificacion por el Agente CLI

1. Probar en DevTools o test Node que `THINKING_QUESTION` posiciona el dedo indice derecho en el menton con los otros 4 dedos flexionados y la mirada hacia arriba.
2. Verificar que las 3 nuevas poses (`POSE_FOREHEAD_SALUTE_LOOK`, `POSE_SLEEPY_EYE_RUB`, `POSE_WARM_HEAD_TILT_SMILE`) articulan tanto brazos como falanges de dedos sin colisiones ni inversiones.
3. Confirmar que `greeting` muestra la palma derecha hacia la camara y que `hips.position` nunca cambia.
