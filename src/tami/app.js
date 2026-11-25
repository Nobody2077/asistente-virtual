// app.js — junta todo en la página: avatar + voz + subtítulos + conversación + ciclo de feria.
//
// Ciclo de feria:
//   - nadie le habla → cada ~90 s invita a quien pase («¿Ya sabes qué carrera…?»)
//   - alguien conversa y luego se queda callado 90 s → se despide y empieza de cero para el siguiente

import { crearAvatar } from './avatar.js';
import { Voz } from './voz.js';
import { Oido } from './oido.js';
import { crearDemo } from './demo.js';

const INVITAR_CADA = 90_000;      // ms sin nadie → invita en voz alta (era 45 s: en un auditorio lleno cansaba;
                                  // entre medio, las poses de ocio llaman la atención sin ruido)
const DESPEDIRSE_TRAS = 90_000;   // ms sin respuesta en medio de una charla → se despide y reinicia
const UNIFORME = { Tops: '#1b1b1b', Bottoms: '#2a2a2a' }; // polera negra (colores de Unifranz)

const $ = (id) => document.getElementById(id);
// modo stand (pantalla completa en la feria) o escritorio (ventanita): lo dice main.js en la dirección
const STAND = new URLSearchParams(location.search).get('modo') === 'stand';
document.body.classList.toggle('stand', STAND);
// escala del modo stand (tami.css usa --z): 1 en una laptop 1366×768, más en monitores y TV grandes.
// Se toma el lado más justo (ancho o alto) para que nada se salga de la pantalla.
// VERTICAL (25/11): si la pantalla es más alta que ancha (monitor girado), el stand cambia solo a un diseño de
// «tótem»: Tami grande arriba, casi de cuerpo entero, y el texto abajo. Sin menú (en la feria un visitante podría
// desconfigurarlo). Se puede forzar con INICIAR_TAMI.bat --vertical / --horizontal (main.js → ?orientacion=).
const ORIENTACION = new URLSearchParams(location.search).get('orientacion'); // 'vertical' | 'horizontal' | null
const esVertical = () => (ORIENTACION ? ORIENTACION === 'vertical' : innerHeight > innerWidth * 1.1);
function escalar() {
  const vertical = esVertical();
  document.body.classList.toggle('vertical', vertical);
  // en vertical se mide contra un 768×1366 (la misma pantalla, girada): el texto queda del mismo tamaño
  const z = vertical ? Math.min(innerWidth / 768, innerHeight / 1366) : Math.min(innerWidth / 1366, innerHeight / 768);
  document.body.style.setProperty('--z', Math.max(0.8, z).toFixed(3));
}
if (STAND) { escalar(); addEventListener('resize', escalar); }
// modo feria (blindado): muestra el botón de minimizar
document.body.classList.toggle('feria', new URLSearchParams(location.search).get('feria') === '1');
let minimizada = false; // mientras está minimizada no habla ni invita (Juan está usando otra ventana)
const burbuja = $('burbuja');
const burbujaTexto = $('burbuja-texto');
const entrada = $('entrada');
const estado = $('estado');

const avatar = await crearAvatar($('avatar'), '../../avatar/tami.vrm', { uniforme: UNIFORME });
avatar.emocion('relaxed', 0.3);
// encuadre de la cámara según la orientación (y otra vez si giran el monitor con Tami abierta)
const encuadrar = () => avatar.encuadrar(STAND && esVertical() ? 'vertical' : 'normal');
encuadrar();
if (STAND) addEventListener('resize', encuadrar);
// las demos de cuando está sola (solo en el stand: en la ventanita de escritorio no hay lugar)
const demo = crearDemo($('demo-lienzo'), $('demo-titulo'), $('demo-sub'));

const voz = new Voz({
  alVolumen: (v) => avatar.boca(v),
  alEmpezar: () => { avatar.mirar(0, 0); avatar.emocion('happy', 0.35); },
  alTerminar: () => avatar.emocion('relaxed', 0.3),
});

// --- subtítulos ----------------------------------------------------------------------------------
let ocultarBurbuja = null;
function mostrarBurbuja(contenido, { estudiante = false, html = false } = {}) {
  demo.ocultar(); // habla alguien (o ella): la demo se va para dejar lugar a la burbuja
  clearTimeout(ocultarBurbuja);
  burbuja.classList.remove('oculta');
  burbuja.classList.toggle('estudiante', estudiante);
  if (html) burbujaTexto.innerHTML = contenido; else burbujaTexto.textContent = contenido;
  // texto largo: mostrar el FINAL (lo que está diciendo ahora); lo de arriba se desvanece (tami.css .desborda)
  burbuja.scrollTop = burbuja.scrollHeight;
  burbuja.classList.toggle('desborda', burbuja.scrollHeight > burbuja.clientHeight + 2);
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
// La cara acompaña cada frase cuando EMPIEZA a sonar (25/11): si pregunta, sube las cejas (curiosa); si dice algo
// alegre, sonríe más. Valores elegidos con fotos: surprised > 0,3 abre la boca raro; happy > 0,45 cierra los ojos.
function caraPara(frase) {
  if (/\?\s*[)»"]?\s*$/.test(frase)) return ["surprised", 0.2];
  if (/qu[eé] (bien|lindo|genial|emoci[oó]n|bueno)|me encanta|genial|excelente|felicidades|incre[ií]ble|perfecto|¡qu[eé] gusto/i.test(frase)) return ["happy", 0.42];
  return ["happy", 0.32];
}
const alSonarFrase = (frase, g = null) => () => {
  avatar.emocion(...caraPara(frase));
  if (g) { avatar.gesto(g); proximoExplicar = Date.now() + 3000; }
};
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
  voz.decir(frase, alSonarFrase(frase, g));
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
  demo.ocultar(); // la ficha ocupa el mismo lugar
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
  document.body.classList.add('con-ficha');
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
  document.body.classList.remove('con-ficha');
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
  if (explicando) pararExplicacion(); // le hablan en medio de la presentación: atiende al estudiante
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
  voz.decir(frase, alSonarFrase(frase));
  avatar.emocion('happy', 0.5);
  // el gesto según la frase: ofrece la presentación → abre la mano · dato curioso → explica · si no → saluda
  avatar.gesto(/c[oó]mo funciono|c[oó]mo funcionas/i.test(frase) ? 'presentar'
    : /^dato curioso|^funciono sin internet/i.test(frase) ? 'explicar' : 'saludar');
  ocultarLuego(10_000);
}

async function despedirse() {
  enCharla = false;
  cerrarFicha(); // el siguiente estudiante empieza sin la ficha del anterior
  const frase = await window.cerebro.reiniciar();
  mostrarBurbuja(frase);
  voz.decir(frase, alSonarFrase(frase));
  avatar.emocion('happy', 0.6);
  avatar.gesto('saludar'); // chau
  ocultarLuego(8_000);
  ultimaActividad = ultimaInvitacion = Date.now();
}

// --- «Así funciona Tami»: la presentación guiada -------------------------------------------------------
// Se abre la ventana con la animación y Tami narra cada escena con un guion FIJO (no lo inventa el modelo: así
// lo que dice del proyecto siempre es exacto). Se activa si le preguntan «¿cómo funcionas?» o con F8 (para
// cuando llega el jurado). Si un estudiante le habla en medio, se detiene y lo atiende.
const GUION = [
  // {EQUIPO} se cambia por los nombres de src/main/equipo.js (+ equipo_local.json, que no va a GitHub)
  [0, 'Soy Tami, la orientadora virtual de Ingeniería de Sistemas e Innovación Digital. Me crearon {EQUIPO}, estudiantes de Unifranz, para contarte todo sobre la carrera y resolver tus dudas, con voz y sin internet.'],
  [1, 'Primero tuve que aprender sobre Unifranz. Un programa recolector recorrió la página web de la universidad, página por página, y fue guardando todo su texto: 95 páginas y 440 noticias.'],
  [2, 'Pero una página web trae mucha basura: menús, avisos de cookies y código. Así que limpiamos el texto y nos quedamos solo con lo que sirve.'],
  [3, 'Después partimos todo en pedacitos, como fichas de estudio. En total, 8093 pedazos.'],
  [4, 'Cada pedazo pasa por un modelo que lo convierte en 384 números: un vector que representa su significado. Los pedazos que hablan de lo mismo quedan cerca, como estrellas de una misma constelación. Esa galaxia es mi memoria.'],
  [5, 'Cuando me preguntas algo, por ejemplo si hay becas, convierto tu pregunta en vector y busco los pedazos más cercanos. Por eso te respondo con datos reales de Unifranz, y no invento.'],
  [6, 'Con esos pedazos, mi cerebro, un modelo de lenguaje llamado Qwen, escribe la respuesta aquí mismo, sin internet. Whisper me permite escucharte, Kokoro me da la voz, y este cuerpo mueve la boca y las manos mientras hablo.'],
  [7, 'Este proyecto es el resultado de lo que aprendimos en clases: redes neuronales con imágenes, limpieza de datos y Google Colab. Los modelos de lenguaje y de voz ya venían entrenados; nuestro trabajo fue elegirlos, unirlos y darles el conocimiento de Unifranz.'],
  [8, 'Y estos son mis resultados: empiezo a responder en unos tres segundos, pasé un examen con 46 estudiantes de prueba, y funciono sin internet. ¿Quieres probarme? ¡Pregúntame lo que quieras!'],
];
let explicando = false;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// dice un texto frase por frase (con sus gestos) y espera a que termine de sonar
async function decirYEsperar(texto) {
  const frases = texto.match(/[^.!?¿¡]*[¡¿]?[^.!?]*[.!?]+/g) || [texto];
  for (const f of frases.map((x) => x.trim()).filter(Boolean)) {
    const g = gestoPara(f);
    voz.decir(f, alSonarFrase(f, g));
  }
  await pausa(300);
  while (explicando && voz.hablando) await pausa(150);
}

async function explicarme() {
  if (explicando) return;
  explicando = true;
  enCharla = true;
  cerrarFicha();
  avatar.gesto('presentar');
  const nombres = await window.cerebro.equipo().catch(() => null) || ['Juan Cristian Yujra', 'Brayan Quispe Mamani'];
  const equipo = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
  try {
    for (const [n, guion] of GUION) {
      const texto = guion.replace('{EQUIPO}', equipo);
      if (!explicando) break;
      await window.cerebro.explica({ accion: 'escena', n, pregunta: '¿hay becas?' });
      mostrarBurbuja(texto);
      ultimaActividad = Date.now();
      await decirYEsperar(texto);
      if (!explicando) break;
      await pausa(n === 4 || n === 5 ? 1800 : 700); // un respiro para mirar la galaxia y la búsqueda
    }
  } finally {
    const termino = explicando;
    explicando = false;
    ultimaActividad = Date.now();
    if (termino) setTimeout(() => !explicando && window.cerebro.explica({ accion: 'cerrar' }), 25_000); // dejarla a la vista un rato
  }
}

function pararExplicacion() {
  explicando = false;
  voz.callar();
  window.cerebro.explica({ accion: 'cerrar' });
}

window.cerebro.alExplicar(() => explicarme());

// --- MODO FOTO: «Tami, te voy a tomar una foto» (o F9) ---------------------------------------------------
// El entorno cambia a «estudio de fotos» (marco, luz detrás de ella, cartelito «Soy Tami»), cuenta 3-2-1 en
// grande para que quien saca la foto sepa cuándo, y ella mantiene una pose 4 s (al azar: ✌️ o manos juntas).
let fotoActiva = false;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function modoFoto() {
  if (fotoActiva || explicando) return;
  fotoActiva = true;
  for (let i = 0; i < 40 && voz.hablando; i++) await espera(150); // que termine de decir «¡a la cuenta de tres!»
  demo.ocultar();
  cerrarFicha();
  document.body.classList.add("con-foto");
  avatar.mirar(0, 0);                 // mira a la cámara
  avatar.emocion("happy", 0.18);      // sonrisa (más alto, en este modelo cierra los ojos)
  avatar.gesto(Math.random() < 0.5 ? "fotoPaz" : "fotoManos");
  const cuenta = $("foto-cuenta");
  for (const n of ["3", "2", "1"]) {
    cuenta.className = ""; cuenta.textContent = n;
    void cuenta.offsetWidth; cuenta.className = "late"; // reinicia la animación
    await espera(1000);
  }
  cuenta.className = "listo"; cuenta.textContent = "¡Ahora!";
  await espera(4000);                 // 4 s quieta para la foto
  cuenta.textContent = "";
  document.body.classList.remove("con-foto");
  avatar.soltarGesto();
  avatar.emocion("relaxed", 0.3);
  ultimaActividad = Date.now();
  fotoActiva = false;
}
window.cerebro.alFoto?.(() => modoFoto());
window.cerebro.alExplicaCerrada(() => { if (explicando) { explicando = false; voz.callar(); } });

setInterval(() => {
  if (minimizada || voz.hablando || pensando || entrada.value || escuchando || explicando || fotoActiva) return;
  const ahora = Date.now();
  if (enCharla && ahora - ultimaActividad > DESPEDIRSE_TRAS) despedirse();
  else if (!enCharla && ahora - Math.max(ultimaActividad, ultimaInvitacion) > INVITAR_CADA) invitar();
}, 2000);

// --- ocio: si nadie le habla, no se queda quieta como estatua (escena D del SKILL de Brayan) --------
// Pasados 15 s sin nadie, cada 6 a 10 s hace una pose distinta (nunca la misma dos veces seguidas).
// Cualquier cosa de verdad (alguien escribe, habla, ella invita) la reemplaza: gesto() suelta la anterior.
const OCIO = ['visera', 'mirarIzquierda', 'mirarDerecha', 'ladear', 'estirarse', 'suspirar'];
const OCIO_TRAS = 15_000;
let proximoOcio = 0;
let ultimoOcio = null;
const DEMO_CADA = 40_000;
let ultimaDemo = 0;
let proximaDemo = 0;
setInterval(() => {
  if (minimizada || enCharla || voz.hablando || pensando || entrada.value || escuchando || explicando || fotoActiva) return;
  const ahora = Date.now();
  if (ahora - Math.max(ultimaActividad, ultimaInvitacion) < OCIO_TRAS || ahora < proximoOcio || avatar.ocupada() || demo.activa()) return;
  // en el stand, a veces (1 de cada ~3, y no más de una cada 40 s) en vez de una pose muestra una DEMO:
  // abre la mano hacia la izquierda y aparece la animación (red neuronal, memoria o el camino)
  if (STAND && !document.body.classList.contains('con-ficha') && ahora - ultimaDemo > DEMO_CADA && Math.random() < 0.35) {
    ultimaDemo = ahora;
    const nombre = demo.nombres[proximaDemo++ % demo.nombres.length]; // de a una, en orden
    avatar.mirar(-0.35, -0.1); // la mira de reojo, como quien la presenta
    avatar.gesto('presentar');
    demo.mostrar(nombre, 8000).then(() => avatar.mirar(0, 0));
    proximoOcio = ahora + 10_000;
    return;
  }
  const opciones = OCIO.filter((g) => g !== ultimoOcio);
  ultimoOcio = opciones[Math.floor(Math.random() * opciones.length)];
  if (ultimoOcio === 'ladear') { // sonrisita tierna (poca: en este modelo 'happy' alto cierra los ojos)
    avatar.emocion('happy', 0.2);
    setTimeout(() => { if (!voz.hablando) avatar.emocion('relaxed', 0.3); }, 3000);
  }
  if (ultimoOcio === 'suspirar') { // cara tranquila mientras suspira (sin sonido: el auditorio ya es ruidoso)
    avatar.emocion('relaxed', 0.55);
    setTimeout(() => { if (!voz.hablando) avatar.emocion('relaxed', 0.3); }, 3000);
  }
  avatar.gesto(ultimoOcio);
  proximoOcio = ahora + 6000 + Math.random() * 4000;
}, 1000);

// --- teclado -------------------------------------------------------------------------------------
$('barra').addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = entrada.value;
  entrada.value = '';
  preguntar(texto);
});
entrada.addEventListener('input', () => {
  ultimaActividad = Date.now();
  if (fotoActiva) return; // está posando: que escriba tranquilo, la pose termina sola en unos segundos
  if (demo.activa()) { demo.ocultar(); avatar.mirar(0, 0); } // llegó alguien: la demo se va y lo mira
  if (!pensando && !voz.hablando) avatar.soltarGesto(); // si estaba estirándose, deja la pose y atiende
});

// --- micrófono -----------------------------------------------------------------------------------
// Dos formas de usarlo: MANTENER presionado y soltar al terminar, o TOCAR una vez y tocar otra vez para terminar
// (más fácil para quien está nervioso). F2 hace lo mismo desde el teclado.
const microfono = $('microfono');
const oido = new Oido({
  alNivel: (v) => microfono.style.setProperty('--nivel', v.toFixed(2)),
  pedido: new URLSearchParams(location.search).get('mic') || '', // INICIAR_TAMI.bat --mic "Realtek"
});
let escuchando = false;
let apretadoEn = 0;

async function empezarAEscuchar() {
  if (escuchando || pensando) return;
  if (explicando) pararExplicacion();
  voz.callar(); // si estaba hablando, se calla para escuchar
  try {
    await oido.empezar();
  } catch (err) {
    estado.textContent = 'No encuentro el micrófono: escríbeme.';
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
  avatar.emocion('relaxed', 0.2);
  // Whisper tarda ~2,5 s en pasar la voz a texto: que se note YA que la escuchó y está pensando
  // (antes se quedaba quieta esos segundos y parecía que no había oído nada)
  mostrarBurbuja(`Te escuché… ${PENSANDO}`, { html: true, estudiante: true });
  avatar.mirar(0.25, 0.35); // mira hacia arriba, como quien piensa
  avatar.gesto('pensar');   // índice al mentón (preguntar() lo mantiene: gesto() no repite uno en curso)
  try {
    const texto = await oido.terminar();
    if (texto) preguntar(texto);
    else { avatar.soltarGesto(); avatar.mirar(0, 0); mostrarBurbuja('No te escuché bien. ¿Me lo repites o me lo escribes?'); }
  } catch (err) {
    avatar.soltarGesto(); avatar.mirar(0, 0);
    console.log('[oido]', err.message);
    // micrófono mudo: casi siempre es que Windows eligió uno virtual o el micrófono está apagado
    mostrarBurbuja(err.mudo ? 'Mi micrófono no recibe sonido. ¿Me lo escribes mientras lo revisan?' : 'Uy, mi oído falló. ¿Me lo escribes?');
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
  // F8: la presentación «Así funciona Tami» (para cuando se acerca el jurado); otra vez F8 la detiene
  if (e.key === 'F8' && !e.repeat) { e.preventDefault(); explicando ? pararExplicacion() : explicarme(); }
  // F9: modo foto al instante (para Juan o Ximena, sin escribir nada)
  if (e.key === 'F9' && !e.repeat) { e.preventDefault(); modoFoto(); }
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

// --- minimizar (modo feria) ---------------------------------------------------------------------------
// Hay que MANTENER el botón 1 segundo (se va llenando de naranja): así un visitante que lo toca de pasada no
// esconde a Tami, pero Juan puede ir a otra ventana. Para volver: clic en Tami en la barra de tareas.
const botonMin = $('minimizar');
let cargaMin = null;
function soltarMin() {
  clearInterval(cargaMin); cargaMin = null;
  botonMin.classList.remove('apretando');
  botonMin.style.setProperty('--carga', '0%');
}
botonMin.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (cargaMin) return;
  const inicio = performance.now();
  botonMin.classList.add('apretando');
  // setInterval y no requestAnimationFrame: rAF se pausa si Windows cree que la ventana está tapada
  cargaMin = setInterval(() => {
    const p = Math.min(1, (performance.now() - inicio) / 1000);
    botonMin.style.setProperty('--carga', `${p * 100}%`);
    if (p >= 1) { soltarMin(); window.cerebro.minimizar(); }
  }, 30);
});
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) botonMin.addEventListener(ev, soltarMin);
window.cerebro.alMinimizar((si) => {
  minimizada = si;
  if (si) {
    voz.callar();
    if (explicando) pararExplicacion();
    if (escuchando) terminarDeEscuchar();
  } else {
    ultimaActividad = Date.now(); // al volver no invita de golpe
  }
});
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'q') window.cerebro.cerrar();
});
entrada.focus();
// En la feria casi todos ESCRIBEN. Si alguien tocó a Tami o cerró la ficha, el campo pierde el foco y lo que
// tecleaba el siguiente no aparecía en ningún lado (parecía rota). Ahora cualquier letra, número o Enter vuelve
// a poner el foco en el campo y la tecla cae ahí (el foco cambia ANTES de que el navegador escriba la letra).
window.addEventListener('keydown', (e) => {
  if (document.activeElement === entrada || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') entrada.focus();
}, true);

// para la autoprueba (main.js --autoprueba): preguntar sin teclado y saber qué está pasando
window.tamiPrueba = {
  preguntar,
  explicarme,
  explicando: () => explicando,
  demo: (nombre, ms = 60_000) => demo.mostrar(nombre, ms), // para fotos: tamiPrueba.demo('red')
  foto: () => { modoFoto(); return 0; },
  escuchar: async (ms) => { await empezarAEscuchar(); await new Promise((r) => setTimeout(r, ms)); await terminarDeEscuchar(); },
  estado: () => ({ hablando: voz.hablando, pensando, burbuja: burbujaTexto.textContent.slice(0, 60), gesto: avatar.haciendo().join(",") }),
};
