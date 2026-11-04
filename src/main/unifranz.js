'use strict';
// Datos de Unifranz (RAG, rama juan/capri-usb). Cuando tu mensaje dice «unifranz», antes de
// mandarlo al modelo se le pide al servidor de la USB (servidor_capri.py, /v1/unifranz/buscar)
// los pedazos más parecidos de la DB de Chroma, y van junto a tu pregunta con su fuente.
// Sirve con cualquier cerebro (el 3B o LM Studio) mientras el servidor de la USB esté encendido.

const RAG_URL = process.env.CAPRI_RAG_URL || 'http://127.0.0.1:8765/v1/unifranz/buscar';
const TRIGGER = /unifranz/i;
const NOTE = '\n\n(Note for you'; // la nota de ánimo/idioma que chat.js pega al final

async function search(question, signal) {
  const res = await fetch(RAG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pregunta: question, k: 4 }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.resultados)) throw new Error(data.error || `HTTP ${res.status}`);
  return data.resultados;
}

const CARGO = /\b(director|directora|jef[ea]|encargad[oa]|responsable|cabeza|autoridad|manda)\b/i;

function contextBlock(hits, question) {
  const parts = hits.map((h) => {
    const date = h.publicado ? `, publicado ${h.publicado}` : '';
    return `Página «${h.titulo.split(' | ')[0]}» (${h.url}${date}):\n${h.texto}`;
  });
  return [
    'Datos oficiales de la web de Unifranz (unifranz.edu.bo), descargados el ' + (hits[0]?.descargado || '') + ':',
    ...parts,
    'Responde la pregunta usando SOLO estos datos.' +
      (CARGO.test(question) ? ' En Unifranz la persona a cargo de una sede es el vicerrector o la vicerrectora de esa sede.' : ''),
    'Si los datos no lo dicen, di que no lo sabes; nunca inventes nombres. Al final di el nombre de la página de Unifranz de donde lo sacaste (no un número).',
  ].join('\n\n');
}

// messages tal como los arma chat.js → una copia con los datos de Unifranz en tu último mensaje
// (no como mensaje "system" aparte: la plantilla de Qwen solo acepta el system al principio).
async function withUnifranz(messages, signal) {
  const last = messages.at(-1);
  if (last?.role !== 'user' || typeof last.content !== 'string') return messages;
  const question = last.content.split(NOTE)[0];
  if (!TRIGGER.test(question)) return messages;
  let block;
  try {
    const hits = await search(question, signal);
    block = hits.length ? contextBlock(hits, question) : 'No encontré nada sobre eso en los datos de Unifranz. Dilo así; no inventes.';
  } catch (err) {
    if (signal.aborted) throw err;
    console.warn('[unifranz]', err.message);
    block = 'No pudiste abrir los datos de Unifranz (el servidor de la USB no responde). Dilo así; no inventes.';
  }
  return [...messages.slice(0, -1), { ...last, content: `${block}\n\nPregunta: ${last.content}` }];
}

module.exports = { withUnifranz };
