'use strict';

// Quiénes hicieron a Tami. Lo usan «¿quién te hizo?», «¿qué hizo Brayan?», la personalidad, la presentación
// «Así funciona Tami» y la presentación para el jurado (F7).
//
// Por defecto: los autores que figuran en el repositorio público. Para agregar integrantes cuyo nombre NO debe
// quedar en GitHub, se crea `equipo_local.json` en la carpeta de Tami (está en .gitignore, ver
// equipo_local.ejemplo.json):
//   { "integrantes": ["Nombre Apellido", …], "aportes": { "Nombre Apellido": "hizo las animaciones del avatar" } }
// El aporte va en tercera persona y sin punto final: Tami dice «<nombre> <aporte>.»

const fs = require('node:fs');
const path = require('node:path');

const POR_DEFECTO = ['Juan Cristian Yujra', 'Brayan Quispe Mamani'];
const APORTES_POR_DEFECTO = {
  'Juan Cristian Yujra': 'alimentó al modelo con la información de Unifranz',
  'Brayan Quispe Mamani': 'hizo las animaciones del avatar',
};
const ARCHIVO = path.join(__dirname, '..', '..', 'equipo_local.json');

function leer() {
  try {
    const datos = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
    const lista = datos.integrantes;
    if (Array.isArray(lista) && lista.length && lista.every((n) => typeof n === 'string' && n.trim())) {
      return { nombres: lista.map((n) => n.trim()), aportes: { ...APORTES_POR_DEFECTO, ...(datos.aportes || {}) } };
    }
    console.error('[equipo] equipo_local.json no tiene una lista «integrantes» válida: uso la de siempre');
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[equipo] no pude leer equipo_local.json:', err.message);
  }
  return { nombres: POR_DEFECTO, aportes: APORTES_POR_DEFECTO };
}

const { nombres, aportes } = leer();
// «A y B» · «A, B y C»
const enFrase = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
// [{ nombre, aporte }] en el orden de la lista (sin aporte → '')
const conAportes = nombres.map((nombre) => ({ nombre, aporte: String(aportes[nombre] || '').trim() }));

// «¿Qué hizo Brayan?», «¿cuál fue el aporte de Ximena?», «¿qué hizo cada uno?» → respuesta FIJA (sin el modelo:
// frente al jurado no puede inventarle tareas a nadie). Devuelve null si la pregunta no es sobre eso.
const SOBRE_APORTE = /hizo|hicieron|hace|aport|trabaj|rol\b|parte|encarg|funci[oó]n de|tarea|se ocup/i;
const sinTilde = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function respuestaAporte(texto) {
  if (!SOBRE_APORTE.test(texto)) return null;
  const t = sinTilde(texto);
  const todos = /cada uno|cada integrante|cada quien|quien hizo que|los integrantes|el equipo|ustedes/.test(t);
  const elegidos = todos ? conAportes : conAportes.filter(({ nombre }) => new RegExp(`\\b${sinTilde(nombre.split(' ')[0])}\\b`).test(t));
  const conTexto = elegidos.filter((p) => p.aporte);
  if (!conTexto.length) return null;
  return conTexto.map(({ nombre, aporte }) => `${nombre} ${aporte}.`).join(' ') + (conTexto.length > 1 ? ' Juntos me dieron vida.' : '');
}

module.exports = { nombres, enFrase, conAportes, respuestaAporte };
