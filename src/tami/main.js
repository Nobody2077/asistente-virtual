'use strict';

// main.js — el proceso principal de Tami (Electron).
//   - abre su ventana: transparente, sin marco, siempre encima, en la esquina inferior derecha
//   - conversa: la página manda lo que dijo el estudiante, aquí se llama al alma (tami.js) y se le
//     devuelven las frases una por una (para la voz) y el texto (para los subtítulos)
//
// Uso:  npx electron src/tami/main.js        (con LM Studio, servidor_tami.py y servidor_voz.py encendidos)

const path = require('node:path');
const { app, BrowserWindow, ipcMain, screen, session } = require('electron');
const tami = require('../main/tami');

// Tami habla sola (invita a quien pasa) sin que nadie haya tocado la pantalla antes
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// --oido-falso archivo.wav: el micrófono «escucha» ese archivo (para probar Whisper sin hablarle de verdad)
const OIDO_FALSO = (() => { const i = process.argv.indexOf('--oido-falso'); return i > 0 ? path.resolve(process.argv[i + 1]) : null; })();
if (OIDO_FALSO) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-file-for-fake-audio-capture', OIDO_FALSO);
}

let ventana = null;
let conversacion = tami.nuevaConversacion();
let enCurso = null; // AbortController de la respuesta que se está generando

function crearVentana() {
  const { workArea } = screen.getPrimaryDisplay();
  const ancho = 560;
  const alto = Math.min(860, workArea.height);
  ventana = new BrowserWindow({
    width: ancho,
    height: alto,
    x: workArea.x + workArea.width - ancho - 16,
    y: workArea.y + workArea.height - alto,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    title: 'Tami — orientadora de Unifranz',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false, // que siga animando aunque otra ventana tenga el foco
    },
  });
  ventana.loadFile(path.join(__dirname, 'index.html'));
  if (process.argv.includes('--dev')) ventana.webContents.openDevTools({ mode: 'detach' });
}

const enviar = (canal, datos) => ventana && !ventana.isDestroyed() && ventana.webContents.send(canal, datos);

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
    if (r.mostrar) enviar('tami:mostrar', r.mostrar);
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
  return tami.DESPEDIDA;
});

ipcMain.handle('tami:cerrar', () => app.quit());

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
  for (const ms of [1500, 4000, 7000, 11000]) {
    await espera(ms - (Date.now() - inicio));
    await foto(`2_${String(ms).padStart(5, '0')}ms`);
  }
  for (let i = 0; i < 40 && (await ventana.webContents.executeJavaScript('window.tamiPrueba.estado().hablando')); i++) await espera(500);
  console.log(`[autoprueba] terminó de hablar a los ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
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
