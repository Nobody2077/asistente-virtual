'use strict';

// Quiénes hicieron a Tami. Lo usan «¿quién te hizo?», la personalidad y la presentación «Así funciona Tami».
//
// Por defecto: los autores que figuran en el repositorio público. Para agregar integrantes cuyo nombre NO debe
// quedar en GitHub, se crea `equipo_local.json` en la carpeta de Tami (está en .gitignore, ver
// equipo_local.ejemplo.json):
//   { "integrantes": ["Juan Cristian Yujra", "Brayan Quispe Mamani", "Nombre Apellido"] }

const fs = require('node:fs');
const path = require('node:path');

const POR_DEFECTO = ['Juan Cristian Yujra', 'Brayan Quispe Mamani'];
const ARCHIVO = path.join(__dirname, '..', '..', 'equipo_local.json');

function leer() {
  try {
    const lista = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')).integrantes;
    if (Array.isArray(lista) && lista.length && lista.every((n) => typeof n === 'string' && n.trim())) {
      return lista.map((n) => n.trim());
    }
    console.error('[equipo] equipo_local.json no tiene una lista «integrantes» válida: uso la de siempre');
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[equipo] no pude leer equipo_local.json:', err.message);
  }
  return POR_DEFECTO;
}

const nombres = leer();
// «A y B» · «A, B y C»
const enFrase = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;

module.exports = { nombres, enFrase };
