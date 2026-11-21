'use strict';

// probar-feria.js — comprueba el blindaje del modo feria SIN tapar la pantalla (ventana fuera de la vista).
// No necesita el cerebro ni la voz: Tami abre igual (dice «no encuentro mi cerebro») y eso basta.
//   npx electron scripts/probar-feria.js
// Intenta cerrarla como lo haría un visitante, la tumba a propósito y al final usa la salida secreta.

process.argv.push('--feria', '--fuera');
const { app, BrowserWindow } = require('electron');
require('../src/tami/main.js');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallas = 0;
const revisar = (nombre, bien) => { console.log(`${bien ? 'OK   ' : 'FALLA'} ${nombre}`); if (!bien) fallas++; };

// seguro: si algo se traba, la prueba se apaga sola (app.exit no pasa por el blindaje)
setTimeout(() => { console.log('FALLA la prueba se quedó trabada'); app.exit(2); }, 90000);

const tecla = (v, keyCode, modifiers = []) => {
  v.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  v.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
};

app.whenReady().then(async () => {
  await espera(6000);
  const v = BrowserWindow.getAllWindows()[0];
  const viva = () => !v.isDestroyed();

  v.close(); // lo mismo que hace Windows con Alt+F4 o «cerrar ventana» en la barra de tareas
  await espera(800);
  revisar('cerrar la ventana (Alt+F4 de Windows) no la cierra', viva());

  await v.webContents.executeJavaScript('window.cerebro.cerrar()'); // la X y el Ctrl+Q de la página
  await espera(800);
  revisar('Ctrl+Q / la X de la página no la cierran', viva());

  for (const [k, m] of [['F4', ['alt']], ['W', ['control']], ['Q', ['control']], ['R', ['control']], ['F5'], ['I', ['control', 'shift']], ['F12']]) {
    tecla(v, k, m);
  }
  await espera(1500);
  revisar('Alt+F4, Ctrl+W, Ctrl+Q, Ctrl+R, F5, Ctrl+Shift+I, F12 no la cierran ni recargan', viva() && !v.webContents.isDevToolsOpened());

  const antes = Date.now();
  let recargo = false;
  v.webContents.once('did-finish-load', () => { recargo = true; });
  v.webContents.forcefullyCrashRenderer(); // como si la página se cayera en plena feria
  for (let i = 0; i < 20 && !recargo; i++) await espera(500);
  revisar(`si la página se cae, vuelve sola (${((Date.now() - antes) / 1000).toFixed(1)} s)`, recargo && !v.webContents.isCrashed());

  await espera(2000);
  // minimizar: con un clic suelto NO (hay que mantener 1 s); con el botón mantenido o Ctrl+Alt+Shift+M, sí
  await v.webContents.executeJavaScript(`(() => { const b = document.getElementById('minimizar');
    b.dispatchEvent(new PointerEvent('pointerdown')); setTimeout(() => b.dispatchEvent(new PointerEvent('pointerup')), 150); })()`);
  await espera(1500);
  revisar('un clic suelto en minimizar no la esconde', !v.isMinimized());
  revisar('el botón minimizar se ve en modo feria', await v.webContents.executeJavaScript(
    "getComputedStyle(document.getElementById('minimizar')).display !== 'none'"));
  await v.webContents.executeJavaScript("document.getElementById('minimizar').dispatchEvent(new PointerEvent('pointerdown'))");
  await espera(1600);
  revisar('mantener 1 s el botón la minimiza', v.isMinimized());
  revisar('minimizada ya no está siempre encima', !v.isAlwaysOnTop());
  await espera(2500);
  revisar('minimizada, NO vuelve sola al frente (se pueden usar otras ventanas)', v.isMinimized());
  v.restore(); // como hacer clic en Tami en la barra de tareas
  await espera(1000);
  revisar('al restaurarla vuelve blindada (siempre encima)', !v.isMinimized() && v.isAlwaysOnTop());
  tecla(v, 'M', ['control', 'alt', 'shift']);
  await espera(1200);
  revisar('Ctrl+Alt+Shift+M también la minimiza', v.isMinimized());
  v.restore();
  await espera(1000);

  console.log('…probando la salida secreta Ctrl+Alt+Shift+Q');
  app.once('will-quit', () => {
    revisar('la salida secreta Ctrl+Alt+Shift+Q sí la cierra', true);
    console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO BIEN');
  });
  tecla(v, 'Q', ['control', 'alt', 'shift']);
  await espera(4000);
  revisar('la salida secreta Ctrl+Alt+Shift+Q sí la cierra', false);
  app.exit(1);
});
