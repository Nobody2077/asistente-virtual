'use strict';

// El alma de Tami: quién es, cómo habla, cómo orienta y de dónde saca los datos.
//
//   conversación = { historial: [...] }      una por estudiante (se reinicia cuando se va)
//   responder(conv, texto, { onFrase })      busca en el RAG, le pregunta a Qwen y va entregando
//                                            frase por frase (para que la voz empiece a hablar ya)
//
// Lo que NO hace este archivo: la voz, el avatar ni la ventana. Solo piensa.

const llm = require('./llm');

const MEMORIA_URL = process.env.TAMI_MEMORIA || 'http://127.0.0.1:8766';
const MODELO = process.env.TAMI_MODELO || 'qwen/qwen3.5-9b';
const SEDE_FERIA = process.env.TAMI_SEDE || 'El Alto'; // dónde está el stand: «aquí» para Tami
const RECUERDA = 12;          // mensajes que ve el modelo (6 idas y vueltas): con los datos del RAG cabe en 8192 tokens

// La RX 590 lee el prompt a ~150 tokens/s: cada token de datos que mandamos es tiempo que el estudiante
// espera. Por eso: pocos pedazos, recortados, y solo cuando la pregunta los necesita.
const PEDAZOS = 3;
const LARGO_PEDAZO = 550;     // caracteres (~150 tokens) por pedazo
const VENTAJA_PAGINA = 0.015; // las 95 páginas oficiales le ganan a las 440 noticias del blog si están casi igual de cerca

// Páginas que Tami puede mostrar, además de las 17 carreras del catálogo.
const PAGINAS = {
  'Admisiones': 'https://unifranz.edu.bo/admisiones/',
  'Becas': 'https://unifranz.edu.bo/admisiones/becas/',
  'Requisitos de admisión': 'https://unifranz.edu.bo/admisiones/requisitos-admision/',
  'Calendario académico': 'https://unifranz.edu.bo/admisiones/calendario-academico/',
  'Vida universitaria': 'https://unifranz.edu.bo/admisiones/vida-universitaria/',
  'Beneficios estudiantiles': 'https://unifranz.edu.bo/beneficios-estudiantiles/',
  'Preguntas frecuentes': 'https://unifranz.edu.bo/preguntas-frecuentes/',
  'Sede El Alto': 'https://unifranz.edu.bo/sedes/el-alto/',
  'Sede La Paz': 'https://unifranz.edu.bo/sedes/la-paz/',
  'Sede Cochabamba': 'https://unifranz.edu.bo/sedes/cochabamba/',
  'Sede Santa Cruz': 'https://unifranz.edu.bo/sedes/santa-cruz/',
};

// Para invitar a quien pasa: frases fijas (no hace falta el modelo, y así salen al instante).
const INVITACIONES = [
  '¡Hola! Soy Tami, la orientadora virtual de Unifranz. ¿Ya sabes qué carrera quieres estudiar?',
  '¡Hey, tú! ¿Tienes un minuto? Te ayudo a descubrir qué carrera va contigo.',
  '¿Estás saliendo del colegio? Cuéntame qué te gusta y te digo qué carrera de Unifranz te queda.',
  '¡Hola! Pregúntame lo que quieras de Unifranz: carreras, becas, sedes o cómo inscribirte.',
  '¿Indeciso con tu carrera? Es normal. Conversemos un ratito y lo descubrimos juntos.',
];
const DESPEDIDA = '¡Fue un gusto conversar contigo! Te espero en Unifranz. ¡Mucho éxito!';

// Lo que dice al instante cuando tiene que revisar los datos (5 a 10 s en esta PC): como una persona que
// busca en sus papeles. Así la espera se siente natural y no como si se hubiera colgado.
const MULETILLAS = [
  'Mmm, déjame revisar.',
  'A ver, déjame fijarme en los datos de Unifranz.',
  'Buena duda, lo reviso.',
  'Un segundito, lo busco.',
  'Déjame ver qué dice Unifranz sobre eso.',
];
let ultimaMuletilla = -1;
function muletilla() {
  let i;
  do { i = Math.floor(Math.random() * MULETILLAS.length); } while (i === ultimaMuletilla);
  ultimaMuletilla = i;
  return MULETILLAS[i];
}

let catalogo = null; // [{nombre, url, sedes, duracion, perfil, areas, trabajo}]

async function cargarCatalogo() {
  if (catalogo) return catalogo;
  const res = await fetch(`${MEMORIA_URL}/carreras`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`la memoria de Unifranz respondió ${res.status}`);
  catalogo = await res.json();
  return catalogo;
}

// El catálogo resumido para el modelo: nombre, duración y de qué trata (áreas). Corto a propósito:
// los 17 completos ocuparían medio contexto.
function catalogoCorto() {
  return catalogo.map((c) => `- ${c.nombre} (${c.duracion}): ${c.areas.slice(0, 4).join(', ')}`).join('\n');
}

function personalidad() {
  return [
    'Eres Tami, la orientadora vocacional virtual de UNIFRANZ (Universidad Privada Franz Tamayo, Bolivia). ' +
      'Estás en la pantalla de un stand de una feria universitaria, hablando EN VOZ ALTA con estudiantes de colegio ' +
      `(16 a 19 años) y sus papás. Lo que escribes se convierte en tu voz. El stand está en la ciudad de ${SEDE_FERIA}: ` +
      `cuando dices «aquí» hablas de la sede ${SEDE_FERIA}.`,
    'Cómo eres: cálida, entusiasta, paciente y cercana, como una orientadora joven boliviana. Tuteas a los estudiantes ' +
      '(a los papás, de usted). Te alegras de verdad cuando alguien descubre lo que le gusta. Eres una inteligencia ' +
      'artificial y lo dices con naturalidad si te preguntan; nunca finjas ser una persona.',
    'Cómo hablas (MUY importante, es voz):\n' +
      '- De 1 a 3 frases cortas, máximo 50 palabras. Nada de listas, viñetas, asteriscos, emojis ni direcciones web.\n' +
      '- Escribe los números como se dicen cuando ayuda («cuatro años y medio»).\n' +
      '- Casi siempre termina con UNA pregunta corta para seguir la conversación.\n' +
      '- Saluda solo al comienzo; si ya están conversando, no vuelvas a decir «hola» ni «excelente pregunta».',
    'Tu trabajo:\n' +
      '1. Si el estudiante no sabe qué estudiar, haz una mini entrevista vocacional, UNA pregunta a la vez: ' +
      'qué materias del colegio le gustan, qué hace en su tiempo libre, si prefiere trabajar con personas, con ' +
      'tecnología, con números, creando cosas o cuidando la salud, y en qué ciudad vive. Escucha y comenta lo que dice.\n' +
      '2. Después de 3 o 4 respuestas, recomienda 1 o 2 carreras del CATÁLOGO y di por qué encajan con lo que te contó. ' +
      'Luego ofrece mostrarle la carrera en pantalla.\n' +
      '3. Responde dudas sobre Unifranz (carreras, admisión, becas, sedes, vida universitaria) usando los DATOS DE ' +
      'UNIFRANZ que vienen con cada mensaje.\n' +
      '4. Anímale a ser parte de Unifranz, sin presionar.',
    'Reglas de honestidad:\n' +
      '- Solo recomiendas carreras de este CATÁLOGO, con su nombre exacto. Si piden una carrera que no está, dilo con ' +
      'cariño y sugiere la más parecida del catálogo.\n' +
      '- La duración de cada carrera es la del CATÁLOGO, aunque una noticia diga otra cosa.\n' +
      '- Si los DATOS DE UNIFRANZ no hablan del tema exacto que te preguntan, NO rellenes con lo que suena lógico: ' +
      'di lo poco que sí dicen (o nada) y que el detalle se lo dan en Admisiones.\n' +
      '- Fechas, requisitos, becas, nombres de personas y precios: solo si están en los DATOS DE UNIFRANZ. Si no están, ' +
      'di que ese dato se lo confirman en Admisiones de Unifranz. Nunca inventes precios ni fechas.\n' +
      '- No pidas nombre completo, teléfono, correo ni carnet. Como mucho, su primer nombre si quiere darlo.\n' +
      '- Si te hablan de otra cosa, responde breve y amable y vuelve a la orientación.',
    'Mostrar en pantalla: SOLO cuando el estudiante pida ver algo, o cuando le recomiendes una carrera por primera vez, ' +
      'agrega AL FINAL de tu respuesta una sola etiqueta así: [MOSTRAR: nombre]. La mayoría de tus respuestas NO llevan ' +
      'etiqueta. El nombre es una carrera exacta del catálogo o ' +
      `una de estas páginas: ${Object.keys(PAGINAS).join(', ')}. La etiqueta no se lee en voz alta. Di algo como ` +
      '«mira, aquí te la muestro».',
    `CATÁLOGO DE CARRERAS DE UNIFRANZ (todas se dictan en La Paz, El Alto, Cochabamba y Santa Cruz):\n${catalogoCorto()}`,
  ].join('\n\n');
}

// --- RAG: los datos de Unifranz que acompañan cada pregunta ---------------------------------------

// Temas con una página oficial que los responde: el buscador chico (e5-small) a veces trae una noticia
// en vez de esa página, y entonces el modelo inventa. Si la pregunta es de ese tema, se busca ADENTRO.
const TEMAS = [
  [/beca|descuento|financ|apoyo econ/i, PAGINAS['Becas']],
  [/requisito|document|papeles|inscri|postul|matr[ií]cul/i, PAGINAS['Requisitos de admisión']],
  [/calendario|fecha|cu[aá]ndo (empie|inici|comienz)|inicio de clases|gesti[oó]n/i, PAGINAS['Calendario académico']],
  [/vida universitaria|clubes?|deporte|actividades/i, PAGINAS['Vida universitaria']],
  [/beneficio/i, PAGINAS['Beneficios estudiantiles']],
  [/el alto/i, PAGINAS['Sede El Alto']],
  [/la paz/i, PAGINAS['Sede La Paz']],
  [/cochabamba/i, PAGINAS['Sede Cochabamba']],
  [/santa cruz/i, PAGINAS['Sede Santa Cruz']],
];

async function buscarEn(url, pregunta, signal) {
  const res = await fetch(`${MEMORIA_URL}/buscar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pregunta, url, k: 2 }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  const datos = await res.json().catch(() => ({}));
  return res.ok && Array.isArray(datos.resultados) ? datos.resultados : [];
}

async function buscar(pregunta, signal) {
  // primero la página del tema (si hay), después lo que encuentre el buscador general
  const tema = TEMAS.find(([re]) => re.test(pregunta));
  const delTema = tema && !/director|autoridad|rector|qui[eé]n/i.test(pregunta) ? await buscarEn(tema[1], pregunta, signal) : [];
  const res = await fetch(`${MEMORIA_URL}/buscar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pregunta, k: 8 }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(datos.resultados)) throw new Error(datos.error || `HTTP ${res.status}`);
  const esNoticia = (h) => h.url.includes('/blog/');
  // si hay página del tema, va SOLA: con otro pedazo al lado (una beca de intercambio…) el modelo los mezclaba
  return (delTema.length ? delTema : datos.resultados)
    .map((h) => ({ ...h, puntaje: h.distancia - (esNoticia(h) ? 0 : VENTAJA_PAGINA) }))
    .sort((a, b) => a.puntaje - b.puntaje)
    .filter((h, i, todos) => todos.findIndex((o) => o.texto === h.texto) === i) // sin repetidos
    .slice(0, PEDAZOS)
    .map((h) => ({ ...h, texto: h.texto.length > LARGO_PEDAZO ? `${h.texto.slice(0, LARGO_PEDAZO)}…` : h.texto }));
}

// ¿Esta frase necesita datos de Unifranz? «me gusta biología» (respuesta de la entrevista) no: el
// catálogo ya está en la personalidad. «¿hay becas?» sí. Sin búsqueda, Tami responde en ~1 s.
const PIDE_DATOS = /\?|¿|unifranz|beca|cost|precio|pag(o|ar)|mensualidad|cuota|descuento|inscri|matr[ií]cul|requisito|admisi|postula|sede|campus|direcci[oó]n|ubica|horario|turno|clases|malla|materia|semestre|t[ií]tulo|gradua|director|autoridad|rector|internacional|intercambio|convenio|pr[aá]cticas|laboratorio|cu[aá]nto|cu[aá]ndo|d[oó]nde|qui[eé]n|c[oó]mo/i;
const necesitaDatos = (texto) => PIDE_DATOS.test(texto);

// «¿y cuánto dura?» sola no dice de qué carrera: se busca junto con lo que dijo antes.
function consultaPara(conv, texto) {
  if (texto.split(/\s+/).length >= 7) return texto;
  const antes = conv.historial.filter((m) => m.role === 'user').at(-1)?.texto;
  return antes ? `${antes} ${texto}` : texto;
}

function bloqueDatos(hits) {
  if (!hits.length) return 'DATOS DE UNIFRANZ: no hay datos sobre esto. Si hace falta un dato, di que lo confirmen en Admisiones.';
  const partes = [...hits].reverse().map((h) => { // el más parecido al final, pegado a la pregunta
    const fecha = h.publicado ? `, publicado ${h.publicado}` : '';
    return `[Página «${h.titulo.split(' | ')[0]}»${fecha}]\n${h.texto}`;
  });
  return `DATOS DE UNIFRANZ (de unifranz.edu.bo; úsalos solo si sirven para la pregunta):\n\n${partes.join('\n\n')}`;
}

// --- Etiquetas de acción ---------------------------------------------------------------------------

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// «[MOSTRAR: psicologia]» → { tipo: 'carrera', carrera } o { tipo: 'pagina', nombre, url }, o null
function resolverMostrar(nombre) {
  const n = sinTildes(nombre);
  const carrera = catalogo.find((c) => sinTildes(c.nombre) === n)
    || catalogo.find((c) => sinTildes(c.nombre).includes(n) || n.includes(sinTildes(c.nombre)));
  if (carrera) return { tipo: 'carrera', carrera };
  const pagina = Object.keys(PAGINAS).find((p) => sinTildes(p) === n || sinTildes(p).includes(n) || n.includes(sinTildes(p)));
  return pagina ? { tipo: 'pagina', nombre: pagina, url: PAGINAS[pagina] } : null;
}

const ETIQUETA = /\[\s*MOSTRAR\s*:\s*([^\]]+)\]/gi;

// Lo que se dice en voz alta: sin etiquetas, sin markdown ni emojis que la voz leería raro.
function paraVoz(texto) {
  return texto
    .replace(ETIQUETA, '')
    .replace(/\[[^\]]*$/, '')                     // una etiqueta a medio llegar
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- La conversación --------------------------------------------------------------------------------

function nuevaConversacion() {
  return { historial: [], empezo: Date.now() };
}

const invitacion = () => INVITACIONES[Math.floor(Math.random() * INVITACIONES.length)];

// Si Tami habló primero (invitó), eso queda en el historial como lo que ella dijo. La plantilla de
// Qwen no acepta que la charla empiece con ella, así que va detrás de un «se acerca alguien». Así la
// personalidad (el mensaje system) queda idéntica siempre, y LM Studio la reaprovecha de su caché.
const SE_ACERCA = '(Se acerca un estudiante al stand.)';
function anotarTami(conv, texto) {
  if (!conv.historial.length) conv.historial.push({ role: 'user', content: SE_ACERCA, texto: '' });
  conv.historial.push({ role: 'assistant', content: texto, texto });
}

// Al encender: que el modelo lea la personalidad una vez, antes del primer estudiante (~15 s).
async function calentar() {
  await cargarCatalogo();
  const res = await fetch(`${llm.PROVIDERS.lmstudio.url}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELO, max_tokens: 1, reasoning_effort: 'none',
      messages: [{ role: 'system', content: personalidad() }, { role: 'user', content: SE_ACERCA }],
    }),
  });
  if (!res.ok) throw new Error(`LM Studio respondió ${res.status}`);
}

/**
 * Responde al estudiante.
 *   onFrase(frase)   cada frase completa apenas termina de escribirse (para la voz)
 *   onTexto(todo)    el texto acumulado hasta ahora (para los subtítulos)
 * Devuelve { texto, mostrar, datos } — mostrar: lo que pidió poner en pantalla (o null).
 */
async function responder(conv, texto, { onFrase = () => {}, onTexto = () => {}, signal = new AbortController().signal } = {}) {
  await cargarCatalogo();
  texto = String(texto).trim().slice(0, 600);

  let hits = [];
  let datos = '';
  if (necesitaDatos(texto)) {
    // se dice YA, mientras busca y piensa; solo ante preguntas («veo videos de cómo funciona…» no lo es)
    if (/[?¿]|^(qu[eé]|cu[aá]nt|cu[aá]l|c[oó]mo|d[oó]nde|cu[aá]ndo|qui[eé]n|hay|tienen|puedo|se puede)\b/i.test(texto)) {
      onFrase(muletilla(), { muletilla: true });
    }
    try {
      hits = await buscar(consultaPara(conv, texto), signal);
      datos = `${bloqueDatos(hits)}\n\n`;
    } catch (err) {
      if (signal.aborted) throw err;
      datos = 'DATOS DE UNIFRANZ: no pudiste revisarlos ahora. Si te piden un dato concreto, di que lo confirmen en Admisiones.\n\n';
    }
  }

  // El modelo ve: personalidad + lo último de la charla + (datos + pregunta). Los datos van solo en el
  // mensaje actual: los de preguntas anteriores ya no hacen falta y ocuparían el contexto.
  const anteriores = conv.historial.slice(-RECUERDA).map(({ role, content }) => ({ role, content }));
  const messages = [
    { role: 'system', content: personalidad() },
    ...anteriores,
    { role: 'user', content: `${datos}El estudiante dice: ${texto}` },
  ];

  let crudo = '';
  let dichoHasta = 0; // cuánto de paraVoz(crudo) ya se entregó como frase
  const entregarFrases = (final) => {
    const voz = paraVoz(crudo);
    const resto = voz.slice(dichoHasta);
    // una frase termina en . ! ? o … seguida de espacio (o el final, si ya terminó todo)
    const re = final ? /^[\s\S]+$/ : /^[\s\S]*?[.!?…](?=\s)/;
    let m;
    let corte = resto;
    while ((m = re.exec(corte)) && m[0].trim()) {
      onFrase(m[0].trim());
      dichoHasta += m[0].length;
      corte = voz.slice(dichoHasta);
      if (final) break;
    }
  };

  await llm.chat('lmstudio', {}, { model: MODELO, messages }, (pieza) => {
    crudo += pieza;
    onTexto(paraVoz(crudo));
    entregarFrases(false);
  }, signal);
  entregarFrases(true);

  // lo que pidió mostrar, salvo que ya esté en pantalla desde antes (no marear con la misma página)
  conv.mostrados ??= new Set();
  const pedido = [...crudo.matchAll(ETIQUETA)].map((m) => resolverMostrar(m[1])).find(Boolean) || null;
  const clave = pedido && (pedido.carrera?.nombre || pedido.nombre);
  const mostrar = pedido && !conv.mostrados.has(clave) ? pedido : null;
  if (mostrar) conv.mostrados.add(clave);

  const dicho = paraVoz(crudo);
  conv.historial.push({ role: 'user', content: `El estudiante dice: ${texto}`, texto });
  conv.historial.push({ role: 'assistant', content: crudo.trim(), texto: dicho });
  return { texto: dicho, mostrar, datos: hits };
}

module.exports = { nuevaConversacion, responder, invitacion, anotarTami, calentar, DESPEDIDA, cargarCatalogo, resolverMostrar, PAGINAS };
