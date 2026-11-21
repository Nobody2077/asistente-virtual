// foto-explica.js — abre la ventana «Así funciona Tami» fuera de la pantalla y le saca fotos a cada escena.
// Necesita encendida la memoria (cerebro/servidor_tami.py, puerto 8766) con el mapa armado.
// Uso:  npx electron scripts/foto-explica.js            → todas las escenas
//       npx electron scripts/foto-explica.js 4 5        → solo esas
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');

const SALIDA = path.join(__dirname, '..', 'capturas');
const RAIZ = path.join(__dirname, '..', '..');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// cuánto esperar en cada escena antes de la foto (que se vea la animación en su mejor momento)
const MOMENTO = { 0: 1500, 1: 3500, 2: 4500, 3: 3500, 4: 6000, 5: 6000, 6: 4500, 7: 4000, 8: 2800 };

app.whenReady().then(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const win = new BrowserWindow({ width: 1600, height: 900, x: -4000, y: 0, show: true, frame: false, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, '..', 'src', 'tami', 'explica-preload.js'), backgroundThrottling: false } });
  win.webContents.on('console-message', (e) => console.log('[pagina]', e.message ?? e));
  await win.loadFile(path.join(__dirname, '..', 'src', 'tami', 'explica.html'));

  const datos = require('../src/tami/explica-datos');
  const ubicacion = await datos.ubicar('¿hay becas?');
  win.webContents.send('explica:datos', await datos.datosIniciales());
  await espera(500);

  const pedidas = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  const escenas = pedidas.length ? pedidas : [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (const n of escenas) {
    win.webContents.send('explica:escena', { n, datos: n === 5 ? { pregunta: '¿hay becas?', ubicacion } : {} });
    await espera(MOMENTO[n]);
    fs.writeFileSync(path.join(SALIDA, `explica_${n}.png`), (await win.webContents.capturePage()).toPNG());
    console.log('foto: escena', n);
  }
  app.quit();
});
