// foto-gestos.js — saca una foto de Tami en la mitad de cada gesto (para ajustar las poses mirando).
// Uso:  npx electron scripts/foto-gestos.js                → todos los gestos
//       npx electron scripts/foto-gestos.js pensar saludar → solo esos
//       npx electron scripts/foto-gestos.js --pose '{"rightUpperArm":[-0.9,0.3,1.05]}'  → probar una pose cruda
// Fotos en capturas/gesto_<nombre>.png
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');

const SALIDA = path.join(__dirname, '..', 'capturas');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const win = new BrowserWindow({ width: 560, height: 760, x: -4000, y: 0, show: true, skipTaskbar: true, frame: false,
    webPreferences: { backgroundThrottling: false } });
  win.webContents.on('console-message', (e) => console.log('[pagina]', e.message ?? e));
  await win.loadFile(path.join(__dirname, '..', 'src', 'tami', 'prueba-avatar.html'));
  for (let i = 0; i < 60 && !(await win.webContents.executeJavaScript('!!window.tamiLista')); i++) await espera(250);
  await win.webContents.executeJavaScript("tami.vestir({ Tops: '#1b1b1b', Bottoms: '#2a2a2a' })");

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--') || a === '--pose');
  const iPose = args.indexOf('--pose');
  const casos = iPose >= 0
    ? [['pose', `tami.gesto('prueba', { pose: ${args[iPose + 1]}, orden: ${process.env.ORDEN || '{}'} })`, 800]]
    : (args.length ? args : await win.webContents.executeJavaScript('tami.gestos'))
      .map((g) => [g, `tami.gesto(${JSON.stringify(g)})`, g === 'asentir' ? 350 : 900]);

  for (const [nombre, js, ms] of casos) {
    await win.webContents.executeJavaScript('tami.soltarGesto()');
    await espera(800);
    await win.webContents.executeJavaScript(js);
    await espera(ms);
    fs.writeFileSync(path.join(SALIDA, `gesto_${nombre}.png`), (await win.webContents.capturePage()).toPNG());
    console.log('foto:', nombre);
  }
  app.quit();
});
