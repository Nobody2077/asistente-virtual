// app.js — junta todo en la página: avatar + voz + subtítulos + conversación + ciclo de feria.
//
// Ciclo de feria:
//   - nadie le habla → cada ~45 s invita a quien pase («¿Ya sabes qué carrera…?»)
//   - alguien conversa y luego se queda callado 90 s → se despide y empieza de cero para el siguiente

import { crearAvatar } from './avatar.js';
import { Voz } from './voz.js';
import { Oido } from './oido.js';

const INVITAR_CADA = 45_000;      // ms sin nadie → invita
const DESPEDIRSE_TRAS = 90_000;   // ms sin respuesta en medio de una charla → se despide y reinicia
const UNIFORME = { Tops: '#1b1b1b', Bottoms: '#2a2a2a' }; // polera negra (colores de Unifranz)

const $ = (id) => document.getElementById(id);
const burbuja = $('burbuja');
const burbujaTexto = $('burbuja-texto');
const entrada = $('entrada');
const estado = $('estado');

const avatar = await crearAvatar($('avatar'), '../../avatar/tami.vrm', { uniforme: UNIFORME });
avatar.emocion('relaxed', 0.3);

const voz = new Voz({
  alVolumen: (v) => avatar.boca(v),
  alEmpezar: () => { avatar.mirar(0, 0); avatar.emocion('happy', 0.35); },
  alTerminar: () => avatar.emocion('relaxed', 0.3),
});

// --- subtítulos ----------------------------------------------------------------------------------
let ocultarBurbuja = null;
function mostrarBurbuja(contenido, { estudiante = false, html = false } = {}) {
  clearTimeout(ocultarBurbuja);
  burbuja.classList.remove('oculta');
  burbuja.classList.toggle('estudiante', estudiante);
  if (html) burbujaTexto.innerHTML = contenido; else burbujaTexto.textContent = contenido;
}
function ocultarLuego(ms = 12_000) {
  clearTimeout(ocultarBurbuja);
  ocultarBurbuja = setTimeout(() => burbuja.classList.add('oculta'), ms);
}
const PENSANDO = '<span class="pensando"><span></span><span></span><span></span></span>';
// lo que escribe o dice el estudiante nunca se mete como HTML tal cual (alguien podría escribir <img …>)
const escaparHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// --- conversación --------------------------------------------------------------------------------
let enCharla = false;       // ¿hay un estudiante conversando ahora?
let ultimaActividad = Date.now();
let ultimaInvitacion = 0;
let pensando = false;

// --- gestos según lo que dice ---------------------------------------------------------------------
// Como una persona: las manos acompañan las palabras. Se elige por frase (la frase llega justo antes de decirla).
const GESTO_POR_FRASE = [
  [/\bsoy tami\b|\bme llamo tami\b/i, 'yo'],
  [/admisiones|no tengo (ese|el|esos) dato|no est[aá] en (los|mis) datos|no (lo )?s[eé]\b|no tenemos esa/i, 'noSe'],
  [/te recomiendo|encaja(r[ií]a)? (perfecto|muy bien)|ideal para ti|qu[eé] (lindo|genial|emoci[oó]n)|me encanta/i, 'alegria'],
];
function gestoPara(frase) {
  return GESTO_POR_FRASE.find(([re]) => re.test(frase))?.[1] || null;
}
// entre frase y frase, si no está haciendo nada, a veces la mano acompaña («explicar»)
let proximoExplicar = 0;
setInterval(() => {
  if (!voz.hablando || avatar.ocupada() || Date.now() < proximoExplicar) return;
  avatar.gesto('explicar');
  proximoExplicar = Date.now() + 4000 + Math.random() * 4000; // cada 4 a 8 s, sin patrón fijo
}, 700);

let yaRespondio = false; // ¿llegó la primera frase de verdad (no la muletilla)?
window.cerebro.alDecirFrase(({ frase, muletilla }) => {
  if (muletilla) mostrarBurbuja(`${frase} ${PENSANDO}`, { html: true });
  else if (!yaRespondio) { yaRespondio = true; avatar.soltarGesto(); avatar.mirar(0, 0); } // deja de pensar y responde
  const g = muletilla ? null : gestoPara(frase);
  // el gesto empieza cuando ESA frase empieza a sonar (las frases llegan antes: la voz las tiene en cola)
  voz.decir(frase, g ? () => { avatar.gesto(g); proximoExplicar = Date.now() + 3000; } : null);
});
window.cerebro.alEscribir((todo) => {
  if (todo) mostrarBurbuja(todo);
});
// --- la ficha con QR -----------------------------------------------------------------------------
const FICHA_DURA = 90_000; // se cierra sola después de 1,5 min (o al llegar otro estudiante)
const ficha = $('ficha');
let cerrarFichaLuego = null;
let fichaAbierta = false;

async function mostrarFicha(f) {
  $('ficha-titulo').textContent = f.titulo;
  $('ficha-detalle').textContent = f.detalle;
  const chips = (id, lista) => $(id).replaceChildren(...lista.map((t) => Object.assign(document.createElement('span'), { textContent: t })));
  chips('ficha-puntos', f.puntos);
  chips('ficha-trabajo', f.trabajo);
  $('ficha-qr').innerHTML = f.qr; // SVG que arma main.js con la librería qrcode (no viene del estudiante)
  $('ficha-contacto').textContent = f.contacto;
  if (!fichaAbierta) {
    fichaAbierta = true;
    await window.cerebro.ficha(true); // primero crece la ventana…
    await new Promise((r) => requestAnimationFrame(r));
  }
  ficha.classList.remove('oculta'); // …y luego entra la tarjeta
  avatar.mirar(-0.35, -0.1); // la mira de reojo, como quien la presenta
  avatar.gesto('presentar'); // y le abre la mano: «mira, aquí está»
  setTimeout(() => avatar.mirar(0, 0), 1800);
  clearTimeout(cerrarFichaLuego);
  cerrarFichaLuego = setTimeout(cerrarFicha, FICHA_DURA);
}

async function cerrarFicha() {
  clearTimeout(cerrarFichaLuego);
  if (!fichaAbierta) return;
  fichaAbierta = false;
  ficha.classList.add('oculta');
  await new Promise((r) => setTimeout(r, 380)); // que termine de desvanecerse
  if (!fichaAbierta) window.cerebro.ficha(false);
}

window.cerebro.alMostrar((f) => mostrarFicha(f));
$('ficha-cerrar').addEventListener('click', cerrarFicha);
let yaInvito = false;
function alEstado({ listo, error }) {
  estado.textContent = listo ? '' : error;
  if (listo && !yaInvito) { yaInvito = true; setTimeout(invitar, 1500); }
}
window.cerebro.alEstado(alEstado);          // si el cerebro termina de calentar después
window.cerebro.estado().then(alEstado);     // si ya estaba listo antes de que cargara la página

async function preguntar(texto) {
  texto = texto.trim();
  if (!texto || pensando) return;
  voz.callar(); // si estaba hablando, se calla para escuchar
  enCharla = true;
  pensando = true;
  ultimaActividad = Date.now();
  // lo que dijo (o lo que Whisper entendió) + los puntitos de «pensando», hasta que ella empiece a responder
  mostrarBurbuja(`${escaparHtml(texto)} ${PENSANDO}`, { estudiante: true, html: true });
  avatar.emocion('relaxed', 0.2);
  avatar.mirar(0.25, 0.35); // mira hacia arriba, como quien piensa
  yaRespondio = false;
  // si tarda (más de 0,7 s), se lleva la mano al mentón; si responde rápido, no (sería un movimiento nervioso)
  const manoAlMenton = setTimeout(() => { if (pensando && !yaRespondio) avatar.gesto('pensar'); }, 700);
  try {
    await window.cerebro.preguntar(texto);
  } finally {
    clearTimeout(manoAlMenton);
    if (!yaRespondio) avatar.soltarGesto();
    pensando = false;
    avatar.mirar(0, 0);
    ultimaActividad = Date.now();
    ocultarLuego();
  }
}

async function invitar() {
  if (voz.hablando || pensando) return;
  ultimaInvitacion = Date.now();
  const frase = await window.cerebro.invitar();
  mostrarBurbuja(frase);
  voz.decir(frase);
  avatar.emocion('happy', 0.5);
  avatar.gesto('saludar'); // ¡hola, tú!
  ocultarLuego(10_000);
}

async function despedirse() {
  enCharla = false;
  cerrarFicha(); // el siguiente estudiante empieza sin la ficha del anterior
  const frase = await window.cerebro.reiniciar();
  mostrarBurbuja(frase);
  voz.decir(frase);
  avatar.emocion('happy', 0.6);
  avatar.gesto('saludar'); // chau
  ocultarLuego(8_000);
  ultimaActividad = ultimaInvitacion = Date.now();
}

setInterval(() => {
  if (voz.hablando || pensando || entrada.value || escuchando) return;
  const ahora = Date.now();
  if (enCharla && ahora - ultimaActividad > DESPEDIRSE_TRAS) despedirse();
  else if (!enCharla && ahora - Math.max(ultimaActividad, ultimaInvitacion) > INVITAR_CADA) invitar();
}, 2000);

// --- teclado -------------------------------------------------------------------------------------
$('barra').addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = entrada.value;
  entrada.value = '';
  preguntar(texto);
});
entrada.addEventListener('input', () => { ultimaActividad = Date.now(); });

// --- micrófono -----------------------------------------------------------------------------------
// Dos formas de usarlo: MANTENER presionado y soltar al terminar, o TOCAR una vez y tocar otra vez para terminar
// (más fácil para quien está nervioso). F2 hace lo mismo desde el teclado.
const microfono = $('microfono');
const oido = new Oido({ alNivel: (v) => microfono.style.setProperty('--nivel', v.toFixed(2)) });
let escuchando = false;
let apretadoEn = 0;

async function empezarAEscuchar() {
  if (escuchando || pensando) return;
  voz.callar(); // si estaba hablando, se calla para escuchar
  try {
    await oido.empezar();
  } catch (err) {
    estado.textContent = 'No encuentro el micrófono: escríbeme 🙂';
    console.log('[oido] micrófono:', err.message);
    return;
  }
  escuchando = true;
  ultimaActividad = Date.now();
  microfono.classList.add('escuchando');
  mostrarBurbuja('Te escucho… <span class="pensando"><span></span><span></span><span></span></span>', { html: true, estudiante: true });
  avatar.mirar(0, 0);
  avatar.emocion('surprised', 0.15); // cejas un poco arriba: atenta
  avatar.gesto('asentir');           // «sí, te escucho»
}

async function terminarDeEscuchar() {
  if (!escuchando) return;
  escuchando = false;
  microfono.classList.remove('escuchando');
  avatar.emocion('relaxed', 0.3);
  try {
    const texto = await oido.terminar();
    if (texto) preguntar(texto);
    else mostrarBurbuja('No te escuché bien 🙈 ¿Me lo repites o me lo escribes?');
  } catch (err) {
    console.log('[oido] whisper:', err.message);
    mostrarBurbuja('Uy, mi oído falló. ¿Me lo escribes?');
  }
  ocultarLuego();
}
oido.alLimite = terminarDeEscuchar; // 15 s como máximo

microfono.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  apretadoEn = Date.now();
  if (escuchando) terminarDeEscuchar(); else empezarAEscuchar();
});
microfono.addEventListener('pointerup', () => {
  // si lo mantuvo apretado más de medio segundo, soltar = terminar (modo «mantener»)
  if (escuchando && Date.now() - apretadoEn > 500) terminarDeEscuchar();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'F2' && !e.repeat) { e.preventDefault(); escuchando ? terminarDeEscuchar() : empezarAEscuchar(); }
});
// se habilita cuando el servidor de voz dice que el oído (Whisper) cargó
(async function esperarOido() {
  try {
    const r = await fetch('http://127.0.0.1:8767/estado');
    if ((await r.json()).oido) { microfono.disabled = false; return; }
  } catch { /* la voz aún no enciende */ }
  setTimeout(esperarOido, 3000);
})();
$('cerrar').addEventListener('click', () => window.cerebro.cerrar());
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'q') window.cerebro.cerrar();
});
entrada.focus();

// para la autoprueba (main.js --autoprueba): preguntar sin teclado y saber qué está pasando
window.tamiPrueba = {
  preguntar,
  escuchar: async (ms) => { await empezarAEscuchar(); await new Promise((r) => setTimeout(r, ms)); await terminarDeEscuchar(); },
  estado: () => ({ hablando: voz.hablando, pensando, burbuja: burbujaTexto.textContent.slice(0, 60), gesto: avatar.haciendo().join(",") }),
};
