'use strict';

// main.js — el proceso principal de Tami (Electron).
//   - abre su ventana: transparente, sin marco, siempre encima, en la esquina inferior derecha
//   - conversa: la página manda lo que dijo el estudiante, aquí se llama al alma (tami.js) y se le
//     devuelven las frases una por una (para la voz) y el texto (para los subtítulos)
//
// Uso:  npx electron src/tami/main.js        (con LM Studio, servidor_tami.py y servidor_voz.py encendidos)

const path = require('node:path');
const { app, BrowserWindow, ipcMain, screen, session } = require('electron');
const QRCode = require('qrcode');
const tami = require('../main/tami');

// Tami habla sola (invita a quien pasa) sin que nadie haya tocado la pantalla antes
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// --oido-falso archivo.wav: el micrófono «escucha» ese archivo (para probar Whisper sin hablarle de verdad)
// --mic "parte del nombre": obliga a usar ese micrófono (si no, Tami elige el primero que no sea virtual)
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
const STAND = process.argv.includes('--stand');

function crearVentana() {
  const { workArea, bounds } = screen.getPrimaryDisplay();
  const ancho = ANCHO_TAMI;
  const alto = Math.min(860, workArea.height);
  const fotoFuera = STAND && process.argv.includes('--autoprueba'); // la prueba no tapa la pantalla de Juan
  const lugar = STAND
    ? (fotoFuera ? { x: -4000, y: 0, width: 1920, height: 1080 } : { ...bounds, fullscreen: true })
    : { width: ancho, height: alto, x: workArea.x + workArea.width - ancho - 16, y: workArea.y + workArea.height - alto };
  ventana = new BrowserWindow({
    ...lugar,
    backgroundColor: STAND ? '#0b0b0b' : '#00000000',
    transparent: !STAND,
    frame: false,
    resizable: false,
    alwaysOnTop: !STAND,
    skipTaskbar: false,
    hasShadow: false,
    title: 'Tami — orientadora de Unifranz',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false, // que siga animando aunque otra ventana tenga el foco
    },
  });
  ventana.loadFile(path.join(__dirname, 'index.html'), { query: { modo: STAND ? 'stand' : 'escritorio', mic: MIC } });
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
  try {
    const r = await tami.responder(conversacion, texto, {
      signal: control.signal,
      onFrase: (frase, info) => enviar('tami:frase', { frase, muletilla: Boolean(info?.muletilla) }),
      onTexto: (todo) => enviar('tami:texto', todo),
    });
    if (r.mostrar) enviar('tami:mostrar', await armarFicha(r.mostrar));
    if (r.accion === 'explicar') enviar('tami:explicar'); // «¿cómo funcionas?» → la presentación guiada
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
ipcMain.handle('tami:invitar', () => {
  const frase = tami.invitacion();
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

ipcMain.handle('tami:cerrar', () => app.quit());

// --- La ventana «Así funciona Tami» -------------------------------------------------------------------
// La ÚNICA ventana extra que Tami puede abrir (lista cerrada, como pidió Juan: nada de abrir programas ni el
// navegador en la feria). Va a la izquierda de Tami; en el stand ocupa la parte izquierda de la pantalla.
const explicaDatos = require('./explica-datos');
let ventanaExplica = null;
let datosExplica = null;

async function abrirExplica() {
  if (ventanaExplica && !ventanaExplica.isDestroyed()) return ventanaExplica;
  const { workArea, bounds } = screen.getPrimaryDisplay();
  const fuera = process.argv.includes('--autoprueba');
  let lugar;
  if (fuera) lugar = { x: -4000 - 1700, y: 0, width: 1600, height: 900 };
  else if (STAND) lugar = { x: bounds.x, y: bounds.y, width: Math.round(bounds.width * 0.6), height: bounds.height };
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
  ventanaExplica.on('closed', () => { ventanaExplica = null; enviar('tami:explica-cerrada'); });
  ventanaExplica.webContents.on('console-message', (e) => console.log('[explica]', e.message ?? e));
  await ventanaExplica.loadFile(path.join(__dirname, 'explica.html'));
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
