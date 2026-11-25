// foto-stand.js — fotos del MODO STAND en varios tamaños de pantalla (sin cerebro ni voz: solo la página).
// Sirve para ver si el texto se lee igual en una laptop, un monitor o una TV.
//   npx electron scripts/foto-stand.js                    → laptop 1366×768, monitor 1920×1080, TV 2560×1440
//   npx electron scripts/foto-stand.js 1280x720 3840x2160 → los tamaños que digas
// Fotos en capturas/stand_<ancho>x<alto>_<caso>.png  (caso: espera · habla · ficha)
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');

const SALIDA = path.join(__dirname, '..', 'capturas');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const TAMANOS = (process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a)).length
  ? process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a))
  : ['1366x768', '1920x1080', '2560x1440']).map((t) => t.split('x').map(Number));

const RESPUESTA = '¡Qué buena pregunta! En Ingeniería de Sistemas e Innovación Digital aprendes a programar, ' +
  'a crear aplicaciones y a trabajar con inteligencia artificial. Desde el primer semestre haces proyectos reales, ' +
  'como yo, que me hicieron estudiantes de la carrera. ¿Quieres que te muestre la ficha con el plan de estudios?';

app.on('window-all-closed', () => {}); // al cerrar la ventana de un tamaño, NO salir: falta el siguiente
app.whenReady().then(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  for (const [ancho, alto] of TAMANOS) {
    // Pantallas más altas que la del PC (p. ej. 1080×1920 vertical): Windows achicaría la ventana. Truco: ventana
    // a la mitad y zoom 0,5 → la página «ve» el tamaño completo (las fotos salen a la mitad de resolución).
    const f = alto > 1000 ? 0.5 : 1;
    const win = new BrowserWindow({ width: Math.round(ancho * f), height: Math.round(alto * f), x: -6000, y: 0, show: true,
      frame: false, skipTaskbar: true, useContentSize: true, backgroundColor: '#0b0b0b',
      webPreferences: { preload: path.join(__dirname, '..', 'src', 'tami', 'preload.js'), backgroundThrottling: false, zoomFactor: f } });
    win.setContentSize(Math.round(ancho * f), Math.round(alto * f)); // por si Windows achica la ventana a su pantalla
    await win.loadFile(path.join(__dirname, '..', 'src', 'tami', 'index.html'), { query: { modo: 'stand' } });
    win.webContents.setZoomFactor(f); // Chromium recuerda el zoom por sitio: sin esto, la 2.ª ventana hereda el de la 1.ª
    await espera(300);
    console.log('la página ve:', await win.webContents.executeJavaScript('innerWidth + "x" + innerHeight + (document.body.classList.contains("vertical") ? " (vertical)" : "")'));
    for (let i = 0; i < 60 && !(await win.webContents.executeJavaScript('!!document.querySelector("#avatar")?.width')); i++) await espera(250);
    await espera(2500); // que cargue el modelo 3D
    const foto = async (caso) => {
      fs.writeFileSync(path.join(SALIDA, `stand_${ancho}x${alto}_${caso}.png`), (await win.webContents.capturePage()).toPNG());
      console.log('foto:', ancho, 'x', alto, caso);
    };
    await win.webContents.executeJavaScript("document.getElementById('estado').textContent = ''");
    await foto('espera');
    await win.webContents.executeJavaScript(`(() => {
      const b = document.getElementById('burbuja'); b.classList.remove('oculta', 'estudiante');
      document.getElementById('burbuja-texto').textContent = ${JSON.stringify(RESPUESTA)};
      b.scrollTop = b.scrollHeight; b.classList.toggle("desborda", b.scrollHeight > b.clientHeight + 2);
    })()`);
    await espera(600);
    await foto('habla');
    await win.webContents.executeJavaScript(`(() => {
      document.getElementById('burbuja').classList.add('oculta');
      document.getElementById('ficha-titulo').textContent = 'Ingeniería de Sistemas e Innovación Digital';
      document.getElementById('ficha-detalle').textContent = '10 semestres · Licenciatura';
      document.getElementById('ficha-puntos').innerHTML = '<span>Programación</span><span>Inteligencia artificial</span><span>Redes</span>';
      document.getElementById('ficha-trabajo').innerHTML = '<span>Desarrollador</span><span>Analista de datos</span>';
      document.getElementById('ficha-qr').innerHTML = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#111"/></svg>';
      document.getElementById('ficha').classList.remove('oculta'); document.body.classList.add('con-ficha');
    })()`);
    await espera(700);
    await foto('ficha');
    // con la ficha abierta Tami sigue hablando: la burbuja sube (en vertical, arriba de la cabeza)
    await win.webContents.executeJavaScript(`(() => {
      const b = document.getElementById('burbuja'); b.classList.remove('oculta', 'estudiante');
      document.getElementById('burbuja-texto').textContent = ${JSON.stringify(RESPUESTA.slice(0, 160))};
    })()`);
    await espera(600);
    await foto('ficha_burbuja');
    // la presentación «Así funciona Tami» abierta (en vertical esa ventana va abajo y la burbuja arriba)
    await win.webContents.executeJavaScript(`(() => {
      document.getElementById('ficha').classList.add('oculta'); document.body.classList.remove('con-ficha');
      document.body.classList.add('con-explica');
    })()`);
    await espera(700);
    await foto('explica');
    win.destroy();
  }
  app.quit();
});
