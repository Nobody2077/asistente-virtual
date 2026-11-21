'use strict';

// El puente entre la página (avatar, voz, subtítulos) y el proceso principal (el cerebro).
// La página SOLO puede hacer lo que está aquí: no tiene acceso a Node ni a los archivos.

const { contextBridge, ipcRenderer } = require('electron');

const escuchar = (canal) => (fn) => ipcRenderer.on(canal, (_e, datos) => fn(datos));

contextBridge.exposeInMainWorld('cerebro', {
  preguntar: (texto) => ipcRenderer.invoke('tami:preguntar', texto),
  invitar: () => ipcRenderer.invoke('tami:invitar'),
  reiniciar: () => ipcRenderer.invoke('tami:reiniciar'),
  cerrar: () => ipcRenderer.invoke('tami:cerrar'),
  estado: () => ipcRenderer.invoke('tami:estado'),
  ficha: (abierta) => ipcRenderer.invoke('tami:ficha', Boolean(abierta)), // la ventana crece / se achica
  alDecirFrase: escuchar('tami:frase'),   // { frase, muletilla }
  alEscribir: escuchar('tami:texto'),     // el texto acumulado (subtítulos)
  alMostrar: escuchar('tami:mostrar'),    // { tipo, titulo, detalle, puntos, trabajo, qr (svg), contacto }
  alEstado: escuchar('tami:estado'),      // { listo, error }
});
