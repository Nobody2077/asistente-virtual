'use strict';
// explica-datos.js — junta los datos REALES que muestra la ventana «Así funciona Tami»:
//   mapa        los 8093 pedazos en 2D            (memoria 8766 /mapa)
//   pagina      el texto de la página de Becas      (datos/md/paginas/admisiones_becas.md)
//   documentos  los 535 documentos que recolectó Crawl4AI: su ruta y cuántos caracteres tienen
//   ubicar()    dónde cae una pregunta y sus pedazos más cercanos (memoria 8766 /ubicar)
// Nada de esto sale de la PC: se lee de disco o del servidor local.

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..', '..'); // G:\Desarrollo\LLMLocalUnifranz
const MD = path.join(RAIZ, 'datos', 'md');
const MEMORIA = process.env.TAMI_MEMORIA || 'http://127.0.0.1:8766';

function leerDocumentos() {
  const lista = [];
  for (const carpeta of ['paginas', 'noticias']) {
    const dir = path.join(MD, carpeta);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const texto = fs.readFileSync(path.join(dir, f), 'utf8');
      const url = /^url:\s*(\S+)/m.exec(texto)?.[1] || f;
      const cuerpo = texto.replace(/^---[\s\S]*?---/, '');
      lista.push({ ruta: url.replace(/^https?:\/\/(www\.)?unifranz\.edu\.bo/, ''), caracteres: cuerpo.length });
    }
  }
  // páginas y noticias intercaladas al azar (así se ve como un recorrido real, no en orden alfabético)
  for (let i = lista.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lista[i], lista[j]] = [lista[j], lista[i]]; }
  return lista;
}

async function datosIniciales() {
  const mapa = await (await fetch(`${MEMORIA}/mapa`)).json();
  const archivo = path.join(MD, 'paginas', 'admisiones_becas.md');
  const pagina = { texto: fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8') : '' };
  return { mapa, pagina, documentos: leerDocumentos() };
}

async function ubicar(pregunta) {
  const r = await fetch(`${MEMORIA}/ubicar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pregunta }),
  });
  return r.ok ? r.json() : null;
}

module.exports = { datosIniciales, ubicar, leerDocumentos };
