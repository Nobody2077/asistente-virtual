// avatar.js — el cuerpo de Tami: carga su modelo VRM y lo anima.
//
//   const tami = await crearAvatar(canvas, 'ruta/tami.vrm')
//   tami.boca(0..1)            cuánto abre la boca (lo maneja el volumen de su voz)
//   tami.emocion('happy', 0.5) sonrisa, sorpresa... (presets de VRM: happy, sad, surprised, relaxed, angry)
//   tami.mirar(x, y)           hacia dónde mira (-1..1)
//   tami.gesto('saludar')      pensar · saludar · asentir · presentar (ver GESTOS) · tami.soltarGesto()
//
// Solo dibuja y anima. Qué dice y cuándo, lo decide otro archivo.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// Teñir la ropa: el modelo trae la polera blanca, así que multiplicar su color la pinta del tono que
// queramos sin tocar la textura. { Tops: '#1a1a1a' } → polera negra. Las claves son parte del nombre
// del material (Tops_01_CLOTH, Bottoms_01_CLOTH, Shoes_01_CLOTH).
function vestir(vrm, uniforme) {
  vrm.scene.traverse((obj) => {
    for (const m of [obj.material].flat().filter(Boolean)) {
      const clave = Object.keys(uniforme).find((k) => m.name?.includes(k));
      if (!clave) continue;
      const color = new THREE.Color(uniforme[clave]);
      m.color?.copy(color);                                                   // la parte iluminada
      m.shadeColorFactor?.copy(color.clone().multiplyScalar(0.55));          // la parte en sombra (MToon)
    }
  });
}

// --- Gestos ----------------------------------------------------------------------------------------
// Cada gesto es una POSE (cuánto girar cada hueso, en radianes [x, y, z]) a la que el cuerpo va suave, se queda
// un rato y vuelve. `onda` agrega un movimiento que se repite (la mano que saluda, la cabeza que asiente).
//   ida / vuelta: segundos para llegar y para volver · dura: cuánto se queda (Infinity = hasta soltarGesto())
// Tami mira a la cámara: su brazo DERECHO está a la izquierda de la pantalla (donde aparece la ficha).
const GESTOS = {
  // (valores ajustados mirando fotos: npx electron scripts/foto-gestos.js)
  pensar: {   // mano en la mejilla y el mentón, cabeza ladeada
    pose: { rightUpperArm: [-0.75, 0.55, 1.25], rightLowerArm: [0, 2.0, 0], rightHand: [0.3, 0.2, -0.9], head: [0.08, 0, 0.1] },
    ida: 0.6, dura: Infinity, vuelta: 0.6,
  },
  saludar: {  // codo pegado al cuerpo, antebrazo vertical, la mano va de lado a lado
    pose: { rightUpperArm: [1.57, 0, 1.3], rightLowerArm: [0, -2.8, 0] },
    orden: { rightUpperArm: 'ZYX' }, // primero gira el brazo sobre su eje → el codo dobla hacia arriba
    onda: (t) => ({ rightLowerArm: [0, Math.sin(t * 9) * 0.22, 0] }),
    ida: 0.45, dura: 1.8, vuelta: 0.5,
  },
  asentir: {  // «sí, te escucho»
    pose: {}, onda: (t) => ({ head: [Math.max(0, Math.sin(t * 7)) * 0.14, 0, 0] }),
    ida: 0.1, dura: 1.0, vuelta: 0.3,
  },
  // brazo IZQUIERDO (derecha de la pantalla): es el espejo del derecho → y, z con el signo cambiado
  explicar: { // la mano acompaña lo que dice, con la palma hacia arriba (gesto de conversación)
    pose: { leftUpperArm: [-0.35, -0.1, -1.25], leftLowerArm: [-1.4, -1.3, 0], leftHand: [0, 0, 0.2] },
    orden: { leftLowerArm: 'ZYX' }, // gira el antebrazo (como una perilla) → palma arriba
    onda: (t) => ({ leftLowerArm: [0, Math.sin(t * 3.2) * 0.12, 0] }),
    ida: 0.45, dura: 1.6, vuelta: 0.55,
  },
  noSe: {     // hombros arriba y palmas hacia arriba: «eso no lo sé, te lo confirman en Admisiones»
    pose: {
      rightUpperArm: [0, 0, 1.2], leftUpperArm: [0, 0, -1.2], rightLowerArm: [-1.5, 1.5, 0], leftLowerArm: [-1.5, -1.5, 0],
      rightShoulder: [0, 0, -0.15], leftShoulder: [0, 0, 0.15], head: [0, 0, 0.12],
    },
    orden: { rightLowerArm: 'ZYX', leftLowerArm: 'ZYX' },
    ida: 0.4, dura: 1.3, vuelta: 0.5,
  },
  yo: {       // mano al pecho: «soy Tami»
    pose: { leftUpperArm: [-0.75, -0.7, -1.35], leftLowerArm: [0, -1.75, 0], leftHand: [0, 0.9, -0.2], head: [0.05, 0, -0.06] },
    ida: 0.45, dura: 1.4, vuelta: 0.5,
  },
  alegria: {  // manos juntas frente al pecho: «¡qué lindo!», al recomendar una carrera
    // (con el codo en 1,8 las manos se cruzaban como «tiempo fuera»; 1,9 las junta bajo el mentón)
    pose: { rightUpperArm: [-0.6, 0.5, 1.3], rightLowerArm: [0, 1.9, 0], leftUpperArm: [-0.6, -0.5, -1.3], leftLowerArm: [0, -1.9, 0] },
    ida: 0.35, dura: 1.3, vuelta: 0.5,
  },
  presentar: { // brazo abierto hacia la izquierda de la pantalla, donde aparece la ficha
    pose: { rightUpperArm: [1.2, -0.5, 1.05], rightLowerArm: [0, -0.9, 0], spine: [0, -0.08, 0] },
    orden: { rightUpperArm: 'ZYX' },
    ida: 0.5, dura: 2.2, vuelta: 0.6,
  },
};
const suave = (x) => x * x * (3 - 2 * x); // empieza y termina despacio (no robótico)

export async function crearAvatar(canvas, url, { fondo = null, uniforme = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const escena = new THREE.Scene();
  if (fondo) escena.background = new THREE.Color(fondo);
  // plano medio: de la cintura para arriba, como una orientadora detrás de su escritorio
  const camara = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
  camara.position.set(0, 1.3, 1.9);
  camara.lookAt(0, 1.22, 0);

  const luz = new THREE.DirectionalLight(0xffffff, 2.2);
  luz.position.set(0.6, 1.8, 1.6);
  escena.add(luz, new THREE.AmbientLight(0xffffff, 0.9));

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm); // los VRM viejos (0.x) miran al revés
  if (uniforme) vestir(vrm, uniforme);
  escena.add(vrm.scene);

  const hueso = (n) => vrm.humanoid.getNormalizedBoneNode(n);
  const ex = vrm.expressionManager;

  // la mirada sigue a un punto invisible delante de la cámara
  const objetivo = new THREE.Object3D();
  camara.add(objetivo);
  escena.add(camara);
  if (vrm.lookAt) vrm.lookAt.target = objetivo;

  const estado = { boca: 0, bocaSuave: 0, emocion: null, emocionValor: 0, mirarX: 0, mirarY: 0 };
  let activos = []; // gestos en curso: { def, t, soltando, tSoltar, pesoAlSoltar, terminado }
  const soltarTodos = () => activos.forEach((g) => { if (!g.soltando) { g.soltando = true; g.tSoltar = g.t; } });
  let proximoParpadeo = 1.5;
  let parpadeo = 0;
  const reloj = new THREE.Clock();

  function ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(ajustarTamano).observe(canvas);
  ajustarTamano();

  function cuadro() {
    const dt = Math.min(reloj.getDelta(), 0.1);
    const t = reloj.elapsedTime;

    // pose de reposo: brazos abajo (el modelo viene en «T»), respiración y balanceo leve
    hueso('leftUpperArm').rotation.z = -1.2 + Math.sin(t * 0.8) * 0.015;
    hueso('rightUpperArm').rotation.z = 1.2 - Math.sin(t * 0.8) * 0.015;
    hueso('leftLowerArm').rotation.y = -0.25;
    hueso('rightLowerArm').rotation.y = 0.25;
    hueso('spine').rotation.x = Math.sin(t * 1.6) * 0.012;           // respira
    hueso('neck').rotation.y = Math.sin(t * 0.35) * 0.05 + estado.mirarX * 0.15;
    hueso('neck').rotation.x = Math.sin(t * 0.5) * 0.02 - estado.mirarY * 0.1;
    // al hablar, la cabeza acompaña un poquito
    hueso('head').rotation.z = Math.sin(t * 2.3) * 0.03 * estado.bocaSuave;
    hueso('head').rotation.x = estado.bocaSuave * 0.04 * Math.sin(t * 5.1);

    // gestos: mezcla entre la pose de reposo (lo de arriba) y la pose de cada gesto, según su «peso» (0..1).
    // Puede haber dos a la vez un momento: el anterior desvaneciéndose y el nuevo entrando (así el brazo no salta).
    for (const gesto of activos) {
      gesto.t += dt;
      const g = gesto.def;
      if (!gesto.soltando && gesto.t > g.ida + g.dura) { gesto.soltando = true; gesto.tSoltar = gesto.t; }
      // al ir: 0 → 1 · al volver: desde donde estaba → 0 (si lo sueltan a medio camino, no salta)
      const desdeSoltar = gesto.soltando ? (gesto.t - gesto.tSoltar) / g.vuelta : 0;
      const w = gesto.soltando
        ? gesto.pesoAlSoltar * (1 - suave(Math.min(1, desdeSoltar)))
        : (gesto.pesoAlSoltar = suave(Math.min(1, gesto.t / g.ida)));
      const extra = g.onda ? g.onda(gesto.t) : {};
      for (const nombre of new Set([...Object.keys(g.pose), ...Object.keys(extra)])) {
        const h = hueso(nombre);
        if (!h) continue;
        // orden de los giros: 'ZYX' gira primero sobre el eje del propio brazo (como girar la palma), lo que
        // permite que el codo doble hacia ARRIBA (saludar). El reposo solo usa z, así que el orden no lo cambia.
        h.rotation.order = g.orden?.[nombre] || 'XYZ';
        const p = g.pose[nombre];
        const e = extra[nombre] || [0, 0, 0];
        ['x', 'y', 'z'].forEach((eje, i) => {
          const meta = (p ? p[i] : h.rotation[eje]) + e[i];
          h.rotation[eje] += (meta - h.rotation[eje]) * w;
        });
      }
      if (gesto.soltando && desdeSoltar >= 1) gesto.terminado = true;
    }
    activos = activos.filter((g) => !g.terminado);

    // el punto está pegado a la cámara: en (0,0,0) mira a quien está frente a la pantalla
    objetivo.position.set(estado.mirarX * 0.6, estado.mirarY * 0.4, 0);

    // boca: suavizada para que no tiemble; mezcla «a» y «o» para que no sea siempre la misma forma
    estado.bocaSuave += (estado.boca - estado.bocaSuave) * Math.min(1, dt * 18);
    const b = estado.bocaSuave;
    ex.setValue('aa', b * 0.8);
    ex.setValue('oh', b * 0.35 * (0.5 + 0.5 * Math.sin(t * 7)));
    ex.setValue('ih', b * 0.2 * (0.5 + 0.5 * Math.cos(t * 5)));

    // parpadeo: cada 2 a 6 segundos, dura ~0,15 s
    proximoParpadeo -= dt;
    if (proximoParpadeo <= 0) { parpadeo = 0.15; proximoParpadeo = 2 + Math.random() * 4; }
    parpadeo = Math.max(0, parpadeo - dt);
    ex.setValue('blink', parpadeo > 0 ? Math.sin((parpadeo / 0.15) * Math.PI) : 0);

    for (const e of ['happy', 'sad', 'surprised', 'relaxed', 'angry']) {
      const meta = e === estado.emocion ? estado.emocionValor : 0;
      ex.setValue(e, ex.getValue(e) + (meta - ex.getValue(e)) * Math.min(1, dt * 6));
    }

    vrm.update(dt);
    renderer.render(escena, camara);
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  return {
    vrm,
    vestir: (u) => vestir(vrm, u),
    boca: (v) => { estado.boca = Math.max(0, Math.min(1, v)); },
    emocion: (nombre, valor = 0.6) => { estado.emocion = nombre; estado.emocionValor = valor; },
    mirar: (x, y) => { estado.mirarX = x; estado.mirarY = y; },
    // gesto('saludar') · gesto('pensar') (se queda hasta soltarGesto()) · gesto(nombre, {pose}) para probar poses
    gesto: (nombre, prueba = null) => {
      const def = prueba ? { ida: 0.3, dura: Infinity, vuelta: 0.3, ...prueba } : GESTOS[nombre];
      if (!def) return;
      if (activos.some((g) => g.def === def && !g.soltando)) return; // ya lo está haciendo
      soltarTodos(); // el anterior se desvanece mientras entra este
      activos.push({ def, t: 0, soltando: false, pesoAlSoltar: 0 });
    },
    soltarGesto: soltarTodos,
    ocupada: () => activos.some((g) => !g.soltando), // ¿está haciendo un gesto ahora?
    haciendo: () => activos.filter((g) => !g.soltando).map((g) => Object.keys(GESTOS).find((k) => GESTOS[k] === g.def) || 'prueba'),
    gestos: Object.keys(GESTOS),
  };
}
