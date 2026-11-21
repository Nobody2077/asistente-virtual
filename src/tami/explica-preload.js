'use strict';
// Puente de la ventana «Así funciona Tami»: solo recibe datos y escenas, y puede pedir cerrarse.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('explica', {
  alDatos: (fn) => ipcRenderer.on('explica:datos', (_e, d) => fn(d)),   // { mapa, pagina }
  alEscena: (fn) => ipcRenderer.on('explica:escena', (_e, d) => fn(d)), // { n, datos }
  cerrar: () => ipcRenderer.invoke('explica:cerrar'),
});
