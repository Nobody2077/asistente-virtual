'use strict';

// main.js — el proceso principal de Tami (Electron).
//   - abre su ventana: transparente, sin marco, siempre encima, en la esquina inferior derecha
//   - conversa: la página manda lo que dijo el estudiante, aquí se llama al alma (tami.js) y se le
//     devuelven las frases una por una (para la voz) y el texto (para los subtítulos)
//
// Uso:  npx electron src/tami/main.js        (con LM Studio, servidor_tami.py y servidor_voz.py encendidos)

const path = require('node:path');
const { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker, screen, session } = require('electron');
const QRCode = require('qrcode');
const tami = require('../main/tami');
const equipo = require('../main/equipo'); // quiénes la hicieron (+ equipo_local.json, que no va a GitHub)

// Tami habla sola (invita a quien pasa) sin que nadie haya tocado la pantalla antes
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// --oido-falso archivo.wav: el micrófono «escucha» ese archivo (para probar Whisper sin hablarle de verdad)
// --mic "parte del nombre": obliga a usar ese micrófono (si no, Tami elige el primero que no sea virtual)
// --vertical / --horizontal: fuerza la orientación del stand (si no, se elige sola por el tamaño de la pantalla)
const ORIENTACION = process.argv.includes('--vertical') ? 'vertical' : process.argv.includes('--horizontal') ? 'horizontal' : '';
const MIC = (() => { const i = process.argv.indexOf('--mic'); return i > 0 ? String(process.argv[i + 1] || '') : ''; })();
const OIDO_FALSO = (() => { const i = process.argv.indexOf('--oido-falso'); return i > 0 ? path.resolve(process.argv[i + 1]) : null; })();
if (OIDO_FALSO) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-file-for-fake-audio-capture', OIDO_FALSO);
}

let ventana = null;
let conversacion = tami.nuevaConversacion();
let enCurso = null; // AbortController de la respuesta que se está generando

// Dos formas de vivir:
//   escritorio (por defecto): ventanita transparente abajo a la derecha, sobre el escritorio
//   --stand: pantalla completa con fondo de marca, para el monitor del stand de la feria
//   --feria: el stand BLINDADO (implica --stand). Nadie la cierra ni sale a Windows por accidente.
//            Salida secreta para Juan y Brayan: Ctrl+Alt+Shift+Q.
const FERIA = process.argv.includes('--feria');
const STAND = FERIA || process.argv.includes('--stand');
let salidaPermitida = !FERIA; // en feria solo la combinación secreta deja cerrar

// Teclas que en la feria NO deben hacer nada: cerrar (Alt+F4, Ctrl+W, Ctrl+Q), recargar (Ctrl+R, F5),
// herramientas de programador (Ctrl+Shift+I, F12), zoom (Ctrl +/-/0) y pantalla completa (F11).
function teclaBloqueada(t) {
  const k = (t.key || '').toLowerCase();
  if (t.alt && k === 'f4') return true;
  if (t.control && ['w', 'q', 'r', '+', '-', '=', '0'].includes(k)) return true;
  if (t.control && t.shift && ['i', 'j', 'c'].includes(k)) return true;
  return ['f5', 'f11', 'f12'].includes(k);
}

// Pantalla completa DE VERDAD (25/11): la ventana toma el tamaño de la pantalla donde está. Se llama al girar el
// monitor (vertical ↔ horizontal), al cambiar la resolución, al volver de minimizar y con F11. Antes la ventana
// se quedaba con el tamaño del arranque y por un costado se veía el escritorio.
function ajustarPantalla() {
  if (!STAND || !ventana || ventana.isDestroyed() || ventana.isMinimized()) return;
  if (process.argv.includes('--autoprueba') || process.argv.includes('--fuera')) return;
  const { bounds } = screen.getDisplayMatching(ventana.getBounds());
  if (FERIA) ventana.setKiosk(false);  // el kiosco «congela» el tamaño: se suelta, se ajusta y se vuelve a poner
  ventana.setFullScreen(false);
  ventana.setBounds(bounds);
  if (FERIA) ventana.setKiosk(true); else ventana.setFullScreen(true);
  if (FERIA) ventana.setAlwaysOnTop(true, 'screen-saver');
  ventana.focus();
}

function salirDeVerdad() {
  salidaPermitida = true;
  app.quit();
}

// Minimizar en feria: se SUELTA el blindaje (kiosco y «siempre encima») para poder usar otras ventanas,
// y al restaurarla desde la barra de tareas se vuelve a poner (ver el evento 'restore' en crearVentana()).
function minimizar() {
  if (!ventana || ventana.isDestroyed()) return;
  ventanaExplica?.close();
  if (FERIA) {
    ventana.setAlwaysOnTop(false);
    ventana.setKiosk(false); // una ventana en kiosco no se deja minimizar
  }
  ventana.minimize();
  enviar('tami:minimizada', true);
}

// Se le pone a CADA ventana de Tami (la principal y la de «Así funciona Tami»)
function blindar(v) {
  if (!FERIA) return;
  v.webContents.on('before-input-event', (e, t) => {
    if (t.type !== 'keyDown') return;
    if (t.control && t.alt && t.shift && (t.key || '').toLowerCase() === 'q') { e.preventDefault(); salirDeVerdad(); return; }
    if (t.control && t.alt && t.shift && (t.key || '').toLowerCase() === 'm') { e.preventDefault(); minimizar(); return; }
    if ((t.key || '').toLowerCase() === 'f11') { e.preventDefault(); ajustarPantalla(); return; } // re-llenar la pantalla
    if (teclaBloqueada(t)) e.preventDefault();
  });
  v.on('close', (e) => { if (!salidaPermitida && v === ventana) e.preventDefault(); }); // Alt+F4 llega aquí
  // nada de navegar a otra página ni abrir ventanas nuevas (p. ej. si alguien toca un enlace)
  v.webContents.on('will-navigate', (e) => e.preventDefault());
  v.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // si la página se cae o se cuelga, Tami se levanta sola en vez de quedarse en negro
  v.webContents.on('render-process-gone', (_e, d) => {
    console.error('[feria] la página se cayó:', d.reason, '→ recargando');
    if (!v.isDestroyed()) v.reload();
  });
  let reloj = null;
  v.on('unresponsive', () => {
    if (reloj) return;
    console.error('[feria] la página no responde → recargando en 10 s si sigue así');
    reloj = setTimeout(() => { reloj = null; if (!v.isDestroyed()) v.webContents.forcefullyCrashRenderer(); }, 10000);
  });
  v.on('responsive', () => { clearTimeout(reloj); reloj = null; }); // se recuperó sola: no se la tumba
}

function crearVentana() {
  const { workArea, bounds } = screen.getPrimaryDisplay();
  const ancho = ANCHO_TAMI;
  const alto = Math.min(860, workArea.height);
  // las pruebas (--autoprueba, --fuera) no tapan la pantalla de Juan
  const fotoFuera = STAND && (process.argv.includes('--autoprueba') || process.argv.includes('--fuera'));
  const lugar = STAND
    ? (fotoFuera ? { x: -4000, y: 0, width: 1920, height: 1080 } : { ...bounds, fullscreen: true })
    : { width: ancho, height: alto, x: workArea.x + workArea.width - ancho - 16, y: workArea.y + workArea.height - alto };
  ventana = new BrowserWindow({
    ...lugar,
    backgroundColor: STAND ? '#0b0b0b' : '#00000000',
    transparent: !STAND,
    frame: false,
    resizable: false,
    alwaysOnTop: !STAND || FERIA,
    kiosk: FERIA && !fotoFuera, // kiosco: pantalla completa que tapa también la barra de tareas
    skipTaskbar: false, // en la barra de tareas: por ahí se la restaura después de minimizarla
    hasShadow: false,
    title: 'Tami — orientadora de Unifranz',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false, // que siga animando aunque otra ventana tenga el foco
    },
  });
  blindar(ventana);
  if (FERIA) {
    // «screen-saver» es el nivel más alto: queda encima incluso de la ventana de Así funciona
    // Si alguien abre el menú Inicio (la tecla Windows no se puede bloquear), Tami vuelve al frente sola.
    ventana.setAlwaysOnTop(true, 'screen-saver');
    ventana.on('blur', () => setTimeout(() => {
      const otra = BrowserWindow.getFocusedWindow();
      if (ventana && !ventana.isDestroyed() && !ventana.isMinimized() && !salidaPermitida && (!otra || otra !== ventanaExplica)) {
        ventana.show();
        ventana.focus();
      }
    }, 1500));
    // volvió desde la barra de tareas → blindada otra vez
    ventana.on('restore', () => {
      if (!fotoFuera) ventana.setKiosk(true); // (en las pruebas no: taparía la pantalla de Juan)
      ventana.setAlwaysOnTop(true, 'screen-saver');
      ventana.focus();
      enviar('tami:minimizada', false);
      setTimeout(ajustarPantalla, 300); // por si mientras estaba minimizada giraron el monitor
    });
  }
  if (STAND && !fotoFuera) {
    // giraron el monitor o cambió la resolución → la ventana vuelve a tapar TODA la pantalla
    let reloj = null;
    const alCambiar = () => { clearTimeout(reloj); reloj = setTimeout(ajustarPantalla, 800); };
    screen.on('display-metrics-changed', alCambiar);
    screen.on('display-added', alCambiar);
    screen.on('display-removed', alCambiar);
    setTimeout(ajustarPantalla, 2500);
  }
  ventana.loadFile(path.join(__dirname, 'index.html'), { query: { modo: STAND ? 'stand' : 'escritorio', mic: MIC, feria: FERIA ? '1' : '', orientacion: ORIENTACION } });
  if (process.argv.includes('--dev')) ventana.webContents.openDevTools({ mode: 'detach' });
}

const enviar = (canal, datos) => ventana && !ventana.isDestroyed() && ventana.webContents.send(canal, datos);

// --- La ficha con QR ---------------------------------------------------------------------------------
// Cuando Tami dice «mira, aquí te la muestro», la ventana crece hacia la izquierda y aparece una tarjeta
// con lo importante + un QR a la página oficial. El QR se calcula AQUÍ (librería qrcode): sin internet, y sin
// pedirle datos al estudiante: él escanea y se lleva el enlace en su celular.
const ANCHO_TAMI = 560;
const ANCHO_FICHA = 380;
const CONTACTO = 'Admisiones El Alto · 2 2823421 · admisiones.elalto@unifranz.edu.bo';

async function armarFicha(m) {
  const qr = await QRCode.toString(m.tipo === 'carrera' ? m.carrera.url : m.url, {
    type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' },
  });
  if (m.tipo === 'carrera') {
    const c = m.carrera;
    return {
      tipo: 'carrera', titulo: c.nombre, detalle: `Duración: ${c.duracion}`,
      puntos: (c.areas || []).slice(0, 4), trabajo: (Array.isArray(c.trabajo) ? c.trabajo : []).slice(0, 3),
      qr, contacto: CONTACTO,
    };
  }
  return { tipo: 'pagina', titulo: m.nombre, detalle: 'Página oficial de Unifranz', puntos: [], trabajo: [], qr, contacto: CONTACTO };
}

// la página avisa si la ficha se abre o se cierra → la ventana crece/se achica sin mover a Tami (borde derecho fijo)
ipcMain.handle('tami:ficha', (_e, abierta) => {
  if (!ventana || ventana.isDestroyed() || STAND) return; // en el stand la ficha ya tiene su lugar fijo
  const b = ventana.getBounds();
  const ancho = abierta ? ANCHO_TAMI + ANCHO_FICHA : ANCHO_TAMI;
  if (b.width === ancho) return;
  ventana.setBounds({ x: b.x + b.width - ancho, y: b.y, width: ancho, height: b.height });
});

// El estudiante dijo algo (por voz o teclado)
ipcMain.handle('tami:preguntar', async (_e, texto) => {
  enCurso?.abort();
  const control = new AbortController();
  enCurso = control;
  // ¿primera pregunta de esta charla? (anotarTami deja un «se acerca alguien» sin texto: ese no cuenta)
  if (!conversacion.historial.some((m) => m.role === 'user' && m.texto)) contarAtendido();
  try {
    const r = await tami.responder(conversacion, texto, {
      signal: control.signal,
      onFrase: (frase, info) => enviar('tami:frase', { frase, muletilla: Boolean(info?.muletilla) }),
      onTexto: (todo) => enviar('tami:texto', todo),
    });
    if (r.mostrar) enviar('tami:mostrar', await armarFicha(r.mostrar));
    if (r.accion === 'explicar') enviar('tami:explicar'); // «¿cómo funcionas?» → la presentación guiada
    if (r.accion === 'foto') enviar('tami:foto');         // «te voy a tomar una foto» → posa (app.js)
    if (r.accion === 'jurado') enviar('tami:jurado');     // «explica el proyecto al jurado» → láminas (app.js)
    return { ok: true, texto: r.texto };
  } catch (err) {
    if (control.signal.aborted) return { ok: false, cancelado: true };
    console.error('[tami]', err);
    const disculpa = 'Uy, se me trabó el pensamiento. ¿Me lo repites, por favor?';
    enviar('tami:frase', { frase: disculpa });
    return { ok: false, texto: disculpa };
  } finally {
    if (enCurso === control) enCurso = null;
  }
});

// Nadie le habla hace rato: invita a quien pase (frase fija, sale al instante)
// --- cuántas personas atendió HOY (25/11) ------------------------------------------------------------
// Se cuenta una persona cuando hace su PRIMERA pregunta de una charla nueva. Se guarda en capturas\ (ignorada por
// git) con la fecha: si Tami se reinicia a media feria, no pierde la cuenta; al día siguiente vuelve a 0.
const fsAtendidos = require('node:fs');
const ARCHIVO_ATENDIDOS = path.join(__dirname, '..', '..', 'capturas', 'atendidos.json');
const hoy = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD (hora local)
let atendidos = 0;
try {
  const g = JSON.parse(fsAtendidos.readFileSync(ARCHIVO_ATENDIDOS, 'utf8'));
  if (g.fecha === hoy()) atendidos = Number(g.n) || 0;
} catch { /* primera vez: empieza en 0 */ }
function contarAtendido() {
  atendidos += 1;
  try {
    fsAtendidos.mkdirSync(path.dirname(ARCHIVO_ATENDIDOS), { recursive: true });
    fsAtendidos.writeFileSync(ARCHIVO_ATENDIDOS, JSON.stringify({ fecha: hoy(), n: atendidos }));
  } catch (err) { console.error('[atendidos]', err.message); }
}
let invitacionesHechas = 0;

ipcMain.handle('tami:invitar', () => {
  // 1 de cada 3 invitaciones usa el contador (desde la 3.ª persona: «1 personas» sonaría raro)
  invitacionesHechas += 1;
  const frase = atendidos >= 3 && invitacionesHechas % 3 === 0 ? tami.invitacionConContador(atendidos) : tami.invitacion();
  conversacion = tami.nuevaConversacion();
  tami.anotarTami(conversacion, frase);
  return frase;
});

// El estudiante se fue: conversación nueva para el siguiente
ipcMain.handle('tami:reiniciar', () => {
  enCurso?.abort();
  conversacion = tami.nuevaConversacion();
  return tami.despedida();
});

// Ctrl+Q / la X de la página: en feria no hacen nada (solo la combinación secreta, ver blindar())
ipcMain.handle('tami:cerrar', () => { if (!FERIA) app.quit(); });
ipcMain.handle('tami:minimizar', () => minimizar());

// --- La ventana «Así funciona Tami» -------------------------------------------------------------------
// La ÚNICA ventana extra que Tami puede abrir (lista cerrada, como pidió Juan: nada de abrir programas ni el
// navegador en la feria). Va a la izquierda de Tami; en el stand ocupa la parte izquierda de la pantalla.
const explicaDatos = require('./explica-datos');
let ventanaExplica = null;
let datosExplica = null;

async function abrirExplica() {
  if (ventanaExplica && !ventanaExplica.isDestroyed()) return ventanaExplica;
  // la pantalla donde está Tami (no la «principal»: puede ser el monitor girado)
  const { workArea, bounds } = ventana && !ventana.isDestroyed() ? screen.getDisplayMatching(ventana.getBounds()) : screen.getPrimaryDisplay();
  const fuera = process.argv.includes('--autoprueba');
  const vertical = ORIENTACION ? ORIENTACION === 'vertical' : bounds.height > bounds.width * 1.1;
  let lugar;
  if (fuera) lugar = { x: -4000 - 1700, y: 0, width: 1600, height: 900 };
  else if (STAND && vertical) {
    // monitor girado (25/11): la presentación (16:9) va ABAJO, a todo el ancho; arriba quedan la cara de Tami y
    // los subtítulos (app.js pone body.con-explica y la burbuja sube). Antes salía al 60 % de ancho y la cortaba.
    const alto = Math.round(bounds.width * 0.5625);
    lugar = { x: bounds.x, y: bounds.y + bounds.height - alto - Math.round(bounds.height * 0.03), width: bounds.width, height: alto };
  } else if (STAND) lugar = { x: bounds.x, y: bounds.y, width: Math.round(bounds.width * 0.6), height: bounds.height };
  else {
    const ancho = Math.min(1280, workArea.width - ANCHO_TAMI - 48);
    const alto = Math.min(Math.round(ancho * 0.5625), workArea.height - 40);
    lugar = { x: workArea.x + 16, y: workArea.y + workArea.height - alto - 20, width: ancho, height: alto };
  }
  ventanaExplica = new BrowserWindow({
    ...lugar, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#0b0b0b',
    title: 'Así funciona Tami',
    webPreferences: { preload: path.join(__dirname, 'explica-preload.js'), backgroundThrottling: false },
  });
  blindar(ventanaExplica);
  // en feria Tami está en el nivel «screen-saver»: la presentación va un escalón más arriba para verse
  if (FERIA) ventanaExplica.setAlwaysOnTop(true, 'screen-saver', 1);
  ventanaExplica.on('closed', () => { ventanaExplica = null; enviar('tami:explica-cerrada'); });
  ventanaExplica.webContents.on('console-message', (e) => console.log('[explica]', e.message ?? e));
  await ventanaExplica.loadFile(path.join(__dirname, 'explica.html'));
  ventanaExplica.webContents.send('explica:equipo', equipo.nombres); // la portada con los integrantes
  try {
    datosExplica ??= await explicaDatos.datosIniciales();
    ventanaExplica.webContents.send('explica:datos', datosExplica);
  } catch (err) {
    console.error('[explica] sin datos del mapa:', err.message); // la presentación igual funciona (sin galaxia)
  }
  return ventanaExplica;
}

ipcMain.handle('tami:explica', async (_e, { accion, n, pregunta } = {}) => {
  if (accion === 'cerrar') { ventanaExplica?.close(); return; }
  const v = await abrirExplica();
  if (accion === 'escena') {
    const datos = n === 5 ? { pregunta, ubicacion: await explicaDatos.ubicar(pregunta).catch(() => null) } : {};
    v.webContents.send('explica:escena', { n, datos });
  }
});
ipcMain.handle('explica:cerrar', () => ventanaExplica?.close());

// La página pregunta cómo está el cerebro cuando ELLA está lista (si solo se le avisara, el aviso
// podía llegar antes de que terminara de cargar el modelo 3D y se perdía).
let estadoCerebro = { listo: false, error: 'Despertando a Tami…' };
ipcMain.handle('tami:estado', () => estadoCerebro);
ipcMain.handle('tami:equipo', () => equipo.nombres); // para el guion de «Así funciona Tami» (app.js)
ipcMain.handle('tami:atendidos', () => atendidos);   // para pruebas y para mirarlo en la feria
// para la presentación del jurado: quién hizo qué (equipo_local.json) y cuántos visitantes atendió hoy
ipcMain.handle('tami:jurado-datos', () => ({ equipo: equipo.conAportes, atendidos }));

// --autoprueba "pregunta": la hace sola y saca fotos mientras responde (capturas/app_*.png).
// Sirve para revisar la app sin estar frente a la pantalla.
async function autoprueba(pregunta) {
  const fs = require('node:fs');
  const dir = path.join(__dirname, '..', '..', 'capturas');
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const foto = async (nombre) => {
    fs.writeFileSync(path.join(dir, `app_${nombre}.png`), (await ventana.webContents.capturePage()).toPNG());
    console.log('[autoprueba] foto', nombre, JSON.stringify(await ventana.webContents.executeJavaScript('window.tamiPrueba?.estado()')));
  };
  await espera(9000); // que termine la invitación
  await foto('1_invitando');
  const inicio = Date.now();
  if (OIDO_FALSO) {
    // «habla» por el micrófono falso unos segundos (el WAV) y suelta el botón
    await ventana.webContents.executeJavaScript('window.tamiPrueba.escuchar(4500)');
    console.log('[autoprueba] Whisper oyó:', await ventana.webContents.executeJavaScript('window.tamiPrueba.estado().burbuja'));
  } else {
    ventana.webContents.executeJavaScript(`window.tamiPrueba.preguntar(${JSON.stringify(pregunta)})`);
  }
  for (const ms of [1500, 3000, 4500, 6000, 7500, 9000, 11000]) {
    await espera(ms - (Date.now() - inicio));
    await foto(`2_${String(ms).padStart(5, '0')}ms`);
  }
  for (let i = 0; i < 40 && (await ventana.webContents.executeJavaScript('window.tamiPrueba.estado().hablando')); i++) await espera(500);
  console.log(`[autoprueba] terminó de hablar a los ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
  await espera(1000);
  await foto('3_final'); // con la ficha, si la mostró
  // si la pregunta abrió la presentación «Así funciona Tami», fotos de las dos ventanas mientras narra
  for (let i = 0; i < 30 && (await ventana.webContents.executeJavaScript('window.tamiPrueba.explicando()')); i++) {
    await espera(8000);
    if (ventanaExplica && !ventanaExplica.isDestroyed()) {
      fs.writeFileSync(path.join(dir, `app_explica_${String(i).padStart(2, '0')}.png`), (await ventanaExplica.capturePage()).toPNG());
    }
    await foto(`4_explicando_${String(i).padStart(2, '0')}`);
  }
  app.quit();
}

app.whenReady().then(async () => {
  // el micrófono: solo se permite «media» (audio) a la página de Tami; nada más (ni cámara de terceros, ni ubicación…)
  session.defaultSession.setPermissionRequestHandler((_wc, permiso, cb) => cb(permiso === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, permiso) => permiso === 'media');
  if (FERIA) {
    // Electron trae un menú invisible con atajos (Ctrl+R recargar, Ctrl+Shift+I…): en feria se quita entero
    Menu.setApplicationMenu(null);
    // que el monitor no se apague ni entre el protector de pantalla en 4 horas
    powerSaveBlocker.start('prevent-display-sleep');
    console.log('[feria] modo feria: sin salida salvo Ctrl+Alt+Shift+Q');
  }
  crearVentana();
  ventana.webContents.on('console-message', (e) => console.log('[pagina]', e.message ?? e));
  try {
    await tami.calentar(); // que lea su personalidad antes del primer estudiante
    estadoCerebro = { listo: true };
  } catch (err) {
    estadoCerebro = { listo: false, error: `No encuentro mi cerebro: ${err.message}` };
  }
  enviar('tami:estado', estadoCerebro);
  const i = process.argv.indexOf('--autoprueba');
  if (i > 0) autoprueba(process.argv[i + 1] || '¿Qué carrera me recomiendas si me gusta la tecnología?');
});

app.on('window-all-closed', () => app.quit());
