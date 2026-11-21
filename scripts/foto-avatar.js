// foto-avatar.js — abre el avatar en una ventana oculta y le saca fotos (sirve para revisar
// cómo se ve sin tener que mirar la pantalla).  Uso:  npx electron scripts/foto-avatar.js
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');

const SALIDA = path.join(__dirname, '..', 'capturas');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  // backgroundThrottling: false → aunque esté oculta, sigue animando (si no, la boca no llega a moverse)
  // y se muestra FUERA de la pantalla (x negativo): una ventana oculta igual anima a pocos cuadros por segundo
  const win = new BrowserWindow({ width: 520, height: 720, x: -4000, y: 0, show: true, skipTaskbar: true, frame: false,
    webPreferences: { backgroundThrottling: false } });
  win.webContents.on('console-message', (e) => console.log('[pagina]', e.message ?? e));
  await win.loadFile(path.join(__dirname, '..', 'src', 'tami', 'prueba-avatar.html'));
  for (let i = 0; i < 60 && !(await win.webContents.executeJavaScript('!!window.tamiLista')); i++) await espera(250);

  // colores del logo de Unifranz: negro, blanco y naranja
  const fotos = [
    ['4_uniforme_negro', "tami.vestir({ Tops: '#1b1b1b', Bottoms: '#2a2a2a' }); tami.boca(0.5); tami.emocion('happy', 0.5)"],
    ['5_uniforme_naranja', "tami.vestir({ Tops: '#ff5a1a', Bottoms: '#1b1b1b' }); tami.boca(0); tami.emocion('happy', 0.4)"],
  ];
  for (const [nombre, js] of fotos) {
    await win.webContents.executeJavaScript(js);
    await espera(900);
    const valores = await win.webContents.executeJavaScript(
      "(() => { const e = tami.vrm.expressionManager; return ['aa','happy','surprised','blink'].map(n => n + '=' + e.getValue(n).toFixed(2)).join(' ') })()");
    console.log('  ', nombre, valores);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SALIDA, `avatar_${nombre}.png`), img.toPNG());
    console.log('foto:', nombre);
  }
  app.quit();
});
