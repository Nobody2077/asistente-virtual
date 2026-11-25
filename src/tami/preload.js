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
  minimizar: () => ipcRenderer.invoke('tami:minimizar'),
  alMinimizar: escuchar('tami:minimizada'), // true al minimizarse, false al volver
  estado: () => ipcRenderer.invoke('tami:estado'),
  equipo: () => ipcRenderer.invoke('tami:equipo'), // ['Juan Cristian Yujra', …] (ver src/main/equipo.js)
  ficha: (abierta) => ipcRenderer.invoke('tami:ficha', Boolean(abierta)), // la ventana crece / se achica
  explica: (pedido) => ipcRenderer.invoke('tami:explica', pedido),         // { accion: abrir|escena|cerrar, n, pregunta }
  alExplicar: escuchar('tami:explicar'),            // le preguntaron «¿cómo funcionas?»
  alFoto: escuchar('tami:foto'),                    // «te voy a tomar una foto» → modo foto
  alExplicaCerrada: escuchar('tami:explica-cerrada'),
  alDecirFrase: escuchar('tami:frase'),   // { frase, muletilla }
  alEscribir: escuchar('tami:texto'),     // el texto acumulado (subtítulos)
  alMostrar: escuchar('tami:mostrar'),    // { tipo, titulo, detalle, puntos, trabajo, qr (svg), contacto }
  alEstado: escuchar('tami:estado'),      // { listo, error }
});
