// avatar.js — el cuerpo de Tami: carga su modelo VRM y lo anima.
//
//   const tami = await crearAvatar(canvas, 'ruta/tami.vrm')
//   tami.boca(0..1)            cuánto abre la boca (lo maneja el volumen de su voz)
//   tami.emocion('happy', 0.5) sonrisa, sorpresa... (presets de VRM: happy, sad, surprised, relaxed, angry)
//   tami.mirar(x, y)           hacia dónde mira (-1..1)
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
  };
}
