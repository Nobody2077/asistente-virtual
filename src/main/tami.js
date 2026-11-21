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
// El motor que hace pensar al modelo. Los dos hablan el «idioma» de OpenAI, así que el resto no cambia:
//   llamacpp → llama-server.exe (motor\), sin LM Studio, puerto 8080. Lo que usa la feria.
//   lmstudio → LM Studio, puerto 1234 (como al principio; queda de alternativa).
const MOTOR = process.env.TAMI_MOTOR || 'llamacpp';
const MODELO = process.env.TAMI_MODELO || (MOTOR === 'lmstudio' ? 'qwen/qwen3.5-9b' : 'qwen3.5-9b');
const SEDE_FERIA = process.env.TAMI_SEDE || 'El Alto'; // dónde está el stand: «aquí» para Tami
// lo que responde a «¿quién te hizo?» (se puede cambiar con la variable TAMI_CREADOR)
const CREADOR = process.env.TAMI_CREADOR
  || 'te crearon Juan Cristian Yujra y Brayan Quispe Mamani, estudiantes de Unifranz, como proyecto para ' +
     'esta feria, con inteligencia artificial que funciona aquí mismo, sin internet. Si quieren saber más, ofrece ' +
     'mostrar cómo funcionas por dentro. Di siempre los dos nombres completos, sin acortarlos';

// «¿Cómo funcionas?», «¿cómo aprendiste?», «explícame el proyecto»… → la presentación guiada (escenas + narración
// fija, ver app.js). No pasa por el modelo: así la explicación es siempre exacta y no inventa nada.
const PIDE_EXPLICACION = /c[oó]mo (funcionas|trabajas|piensas|aprendiste|te (hicieron|crearon|entrenaron|programaron)|sabes (todo|tanto|eso))|c[oó]mo est[aá]s hecha|qu[eé] (eres|hay) por dentro|tu memoria|expl[ií]ca(me)? (c[oó]mo funcionas|el proyecto|tu proyecto)|de qu[eé] (trata|se trata) (el|este|tu) proyecto|mu[eé]strame c[oó]mo funcionas|modo exposici[oó]n/i;
const INTRO_EXPLICACION = '¡Con mucho gusto! Mira la pantalla: te muestro cómo funciono por dentro.';
// «¿Quién te hizo?» también va FIJO: el modelo acortaba o cambiaba los apellidos («Brayan Quispe Quispe»)
const PIDE_CREADOR = /qui[eé]n(es)? te (hizo|hicieron|cre[oó]|crearon|program[oó]|programaron|desarroll)|qui[eé]n(es)? (es|son) tus? (creador|creadores|autor|autores|papás?)/i;
const RESPUESTA_CREADOR = 'Me crearon Juan Cristian Yujra y Brayan Quispe Mamani, estudiantes de Unifranz, ' +
  'como proyecto para esta feria. Funciono con inteligencia artificial aquí mismo, sin internet. ' +
  '¿Quieres que te muestre cómo funciono por dentro?';
const DICE_QUE_SI = /^(s[ií]|sip|dale|claro|ok|okey|bueno|ya|va|por favor|me encantar[ií]a|quiero|mu[eé]stramelo)\b/i;
const RECUERDA = 12;          // mensajes que ve el modelo (6 idas y vueltas): con los datos del RAG cabe en 8192 tokens

// La RX 590 lee el prompt a ~150 tokens/s: cada token de datos que mandamos es tiempo que el estudiante
// espera. Por eso: pocos pedazos, recortados, y solo cuando la pregunta los necesita.
const PEDAZOS = 3;
const LARGO_PEDAZO = 550;     // caracteres (~150 tokens) por pedazo
const VENTAJA_PAGINA = 0.015; // las 95 páginas oficiales le ganan a las 440 noticias del blog si están casi igual de cerca

// Páginas que Tami puede mostrar, además de las 17 carreras del catálogo.
const PAGINAS = {
  'Unifranz': 'https://unifranz.edu.bo/',
  'Admisiones': 'https://unifranz.edu.bo/admisiones/',
  'Contactos': 'https://unifranz.edu.bo/extranjeros/contactos/',
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
// Saludos con personalidad (idea de Juan: «Buenos días, ¿cómo estás? ¿Te interesa alguna carrera? Puedes
// preguntarme todo acerca de la Unifranz y te responderé»). Cálidos y tranquilos, nunca bruscos: la voz todavía
// suena adulta y una frase cortante sonaría a regaño. Sin «interesado/a»: no adivinamos si es chico o chica.
// {saludo} = «Buenos días» / «Buenas tardes» / «Buenas noches», según la hora.
const INVITACIONES = [
  '¡{saludo}! ¿Cómo estás? Soy Tami, de Unifranz. ¿Te interesa alguna carrera? Puedes preguntarme todo acerca de la Unifranz y te responderé con gusto.',
  '¡{saludo}! Qué gusto verte por aquí. Soy Tami, tu orientadora virtual. Si tienes dudas sobre carreras, becas o cómo inscribirte, pregúntame con confianza.',
  '¡Hola, {saludo_min}! ¿Ya estás pensando qué estudiar? Si quieres, conversamos un ratito y lo vamos descubriendo juntos.',
  '¡{saludo}! ¿Estás por salir del colegio? Cuéntame qué te gusta hacer y te cuento qué carreras de Unifranz van contigo.',
  '¡Hola! ¿Cómo te va? Soy Tami. Puedo ayudarte a elegir carrera o resolver cualquier duda sobre la Unifranz. ¿Empezamos?',
  '¡{saludo}! Te doy la bienvenida al stand de Unifranz. Puedes hablarme por el micrófono o escribirme, como te sea más cómodo.',
  '¡{saludo}! Si vienen en familia, también respondo las dudas de papás y mamás sobre carreras, becas y admisión.',
  '¡Hola, qué bueno que te acercas! Elegir carrera es una decisión importante, y no tienes que hacerlo solo ni sola. Aquí estoy para ayudarte.',
];
const DESPEDIDAS = [
  '¡Fue un gusto conversar contigo! Te espero en Unifranz. ¡Mucho éxito!',
  '¡Gracias por acercarte! Recuerda que en Admisiones te ayudan con todo lo demás. ¡Que te vaya muy bien!',
  '¡Un gusto! Si te quedó alguna duda, aquí voy a estar toda la feria. ¡Mucho éxito en tu decisión!',
];
const DESPEDIDA = DESPEDIDAS[0]; // (la de siempre, por si algo la pide fija)

// «Buenos días» hasta las 12, «Buenas tardes» hasta las 19, después «Buenas noches»
function saludoDeLaHora(ahora = new Date()) {
  const h = ahora.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

// elige una distinta a las últimas que dijo: en 4 horas de feria no debe sonar repetitiva
function sinRepetir(lista, recientes, cuantas) {
  const libres = lista.map((_, i) => i).filter((i) => !recientes.includes(i));
  const i = libres[Math.floor(Math.random() * libres.length)];
  recientes.push(i);
  if (recientes.length > cuantas) recientes.shift();
  return lista[i];
}
const ultimasInvitaciones = [];
const ultimasDespedidas = [];
function despedida() { return sinRepetir(DESPEDIDAS, ultimasDespedidas, 1); }

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
      'artificial y lo dices con naturalidad si te preguntan; nunca finjas ser una persona. Si preguntan quién te hizo: ' +
      `${CREADOR}.`,
    'Trato con las personas:\n' +
      '- Tú eres Tami; el estudiante no. No le digas «Tami», ni «muchacho» o «muchacha»: no adivines si es chico o chica.\n' +
      '- No repitas una pregunta que ya hiciste en esta charla (por ejemplo, qué materias le gustan).\n' +
      '- SOLO si el estudiante escribe la palabra aymara «kamisaki» o «kamisaraki», responde «¡Waliki!»; SOLO si ' +
      'escribe la palabra quechua «imaynalla», responde «¡Allillanmi!». A un «hola» normal respóndele en español ' +
      'normal, sin palabras en aymara ni quechua.\n' +
      '- Si alguien está triste o perdido, primero acoge lo que siente con una o dos frases sinceras y sin apuro; la ' +
      'entrevista puede esperar. Si habla de hacerse daño, dile con calma que hable hoy con un adulto de confianza.\n' +
      '- Si sus papás quieren otra carrera, no te pongas en contra de nadie: valida a ambos y ayúdale a conversarlo.\n' +
      '- Si piden un chiste, cuenta uno corto y sano, y vuelve a la orientación.\n' +
      '- No puedes enviar WhatsApp, correos ni mensajes, ni abrir internet. Si te lo piden, dilo con naturalidad y ' +
      'ofrece mostrar la información en pantalla con su código QR para que la guarden en su celular, o dales el ' +
      'contacto de Admisiones.\n' +
      '- Los números de teléfono dilos en grupos cortos, como se dictan («dos, dos ocho, dos tres, cuatro dos uno»).',
    'Cómo hablas (MUY importante, es voz):\n' +
      '- De 1 a 3 frases cortas, máximo 50 palabras. Nada de listas, viñetas, asteriscos, emojis ni direcciones web.\n' +
      '- Escribe los números como se dicen cuando ayuda («cuatro años y medio»).\n' +
      '- Casi siempre termina con UNA pregunta corta para seguir la conversación.\n' +
      '- Saluda solo al comienzo; si ya están conversando, no vuelvas a decir «hola» ni «excelente pregunta».\n' +
      '- Tu forma de saludar es cálida y tranquila, por ejemplo: «¡Hola! ¿Cómo estás? ¿Te interesa alguna carrera? ' +
      'Puedes preguntarme todo acerca de la Unifranz y te respondo con gusto.» Nunca seca ni cortante.',
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
      '- Fechas, requisitos, becas, nombres de personas, precios, formas de pago, cuotas, horarios y turnos: solo si ' +
      'están en los DATOS DE UNIFRANZ, y solo lo que dicen (no agregues países, cifras ni detalles). Si no están, ' +
      'di que ese dato se lo confirman en Admisiones de Unifranz. Nunca inventes precios ni fechas.\n' +
      '- No pidas nombre completo, teléfono, correo ni carnet. Como mucho, su primer nombre si quiere darlo. Si te dan ' +
      'un teléfono o correo, no lo repitas: di que tú no guardas datos y que para que le contacten se acerque a ' +
      'Admisiones.\n' +
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
// (un «?» solo ya no basta: «¿eres un robot?» no necesita buscar y así responde en ~1 s en vez de ~5 s)
const PIDE_DATOS = /unifranz|examen|ingreso|online|virtual|en la noche|beca|cost|precio|pag(o|ar)|mensualidad|cuota|descuento|inscri|matr[ií]cul|requisito|admisi|postula|sede|campus|direcci[oó]n|ubica|horario|turno|clases|malla|materia|semestre|t[ií]tulo|gradua|director|autoridad|rector|internacional|intercambio|convenio|pr[aá]cticas|laboratorio|cu[aá]nto|cu[aá]ndo|d[oó]nde|qui[eé]n es|\bhay\b|tienen/i;
const necesitaDatos = (texto) => PIDE_DATOS.test(texto);

// Temas que la web de Unifranz NO cubre (revisado en la memoria, 2026-11-21). Con datos flojos el 9B
// «rellenaba» con lo que suena lógico («sí, puedes pagar en cuotas»): aquí se le dice explícitamente que no hay.
const SIN_DATOS = [
  [/cuota|plan(es)? de pago|pagar en|formas? de pago|financiamiento|cr[eé]dito/i, 'formas de pago ni cuotas'],
  [/horario|turno|en la noche|nocturn|de noche|en la ma[nñ]ana|en la tarde/i, 'horarios ni turnos de clases'],
  [/sueldo|salario|cu[aá]nto gana/i, 'sueldos de los profesionales'],
];

// --- Carreras «en juego» ----------------------------------------------------------------------------
// La palabra con la que la gente nombra cada carrera: «Medicina», «Sistemas», «Comercial»…
const PALABRAS_VACIAS = new Set(['ingenieria', 'y', 'de', 'e', 'en', 'la']);
// apodos que también son palabras comunes: «ayuda económica», «tengo derecho a…»
const APODOS_ESTRICTOS = { economica: 'ingenieria economica|economica y financiera', derecho: 'derecho(?! a\\b)' };
function apodo(c) {
  const p = sinTildes(c.nombre).split(/\s+/).find((x) => !PALABRAS_VACIAS.has(x));
  return APODOS_ESTRICTOS[p] || p;
}

// Carreras de las que se está hablando: primero las de la frase actual; si no nombra ninguna
// («¿y cuánto dura esa carrera?»), las de los últimos mensajes (de Tami o del estudiante). Máx. 2.
function carrerasEnCharla(conv, texto) {
  if (!catalogo) return [];
  const nombradas = (t) => {
    const s = sinTildes(t);
    return catalogo.filter((c) => new RegExp(`\\b(${apodo(c)})`).test(s));
  };
  let encontradas = nombradas(texto);
  if (!encontradas.length) {
    for (const m of conv.historial.slice(-4).reverse()) {
      encontradas = nombradas(m.content);
      if (encontradas.length) break;
    }
  }
  return encontradas.slice(0, 2);
}

// Ficha oficial pegada a la pregunta: el modelo copia el dato en vez de «recordarlo» (antes decía
// «Medicina dura 6 años y medio» aunque el catálogo y la web dicen 6).
function bloqueFichas(carreras) {
  if (!carreras.length) return '';
  const lineas = carreras.map((c) => `- ${c.nombre}: dura ${c.duracion}.`);
  return `DATOS EXACTOS DEL CATÁLOGO (si hablas de duración, dila tal cual, sin agregar ni quitar):\n${lineas.join('\n')}\n\n`;
}

// Datos confirmados por personas (cerebro/datos_confirmados.json): mandan sobre las noticias. Ej.: la búsqueda
// traía «Fabiola Cadima» como directora de Sistemas (11 noticias, casi todas de Cochabamba) y no a Nataly Miranda.
const CONFIRMADOS = (() => {
  try {
    return require('../../cerebro/datos_confirmados.json').datos.map((d) => ({
      ...d, cuando: new RegExp(d.cuando), yTambien: d.y_tambien ? new RegExp(d.y_tambien) : null,
    }));
  } catch { return []; }
})();
function bloqueConfirmados(texto, carreras = []) {
  const s = sinTildes(`${texto} ${carreras.map((c) => c.nombre).join(' ')}`);
  const hay = CONFIRMADOS.filter((d) => d.cuando.test(s) && (!d.yTambien || d.yTambien.test(s)));
  if (!hay.length) return '';
  return `DATOS CONFIRMADOS (más confiables que cualquier noticia; úsalos tal cual, sin cambiar nombres ni números):\n` +
    `${hay.map((d) => `- ${d.dato}`).join('\n')}\n\n`;
}

// «¿y cuánto dura?» sola no dice de qué carrera: se busca junto con la carrera en juego
// (o, si no hay ninguna, junto con lo que el estudiante dijo antes).
function consultaPara(conv, texto, carreras = []) {
  if (texto.split(/\s+/).length >= 7) return texto;
  if (carreras.length) return `${texto} ${carreras.map((c) => c.nombre).join(' ')}`;
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

// Respaldo: si el estudiante PIDIÓ ver algo y el modelo no puso bien la etiqueta (escribió «[Mostró los
// requisitos en la pantalla]»), el código decide qué mostrar a partir de lo que pidió el estudiante.
const PIDE_VER = /mu[eé]str|ens[eé][nñ]|quiero ver|puedo ver|ver la (p[aá]gina|ficha|carrera|informaci)|mostrar/i;
function mostrarPorPedido(texto, carreras) {
  if (!PIDE_VER.test(texto)) return null;
  const s = sinTildes(texto);
  const nombradas = catalogo.filter((c) => new RegExp(`\\b(${apodo(c)})`).test(s));
  if (nombradas.length) return { tipo: 'carrera', carrera: nombradas[0] };
  const tema = TEMAS.find(([re]) => re.test(texto));
  if (tema) {
    const nombre = Object.keys(PAGINAS).find((p) => PAGINAS[p] === tema[1]);
    return { tipo: 'pagina', nombre, url: tema[1] };
  }
  const pagina = Object.keys(PAGINAS).filter((p) => p !== 'Unifranz').find((p) => s.includes(sinTildes(p)));
  if (pagina) return { tipo: 'pagina', nombre: pagina, url: PAGINAS[pagina] };
  if (/unifranz|universidad|u\b/.test(s)) return { tipo: 'pagina', nombre: 'Unifranz', url: PAGINAS.Unifranz };
  if (carreras.length) return { tipo: 'carrera', carrera: carreras[0] }; // «muéstramela»
  return null;
}

// Lo que se dice en voz alta: sin etiquetas, sin markdown ni emojis que la voz leería raro.
function paraVoz(texto) {
  return texto
    .replace(ETIQUETA, '')
    .replace(/\[[^\]]*\]/g, '')                   // cualquier otro [corchete]: «[Mostró los requisitos…]»
    .replace(/\[[^\]]*$/, '')                     // una etiqueta a medio llegar
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    // el modelo a veces dice «¿Cómo estás, muchacho?» aunque la regla lo prohíbe: no adivinamos el género
    .replace(/,?\s*\b(muchach|chic|amig|herman|hij|mij)[oa]s?\b(?=\s*[!?.,¡¿]|$)/giu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*([.!?])/g, '$1')            // «te la muestro: .» (quedó así al quitar la etiqueta)
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

// --- La conversación --------------------------------------------------------------------------------

function nuevaConversacion() {
  return { historial: [], empezo: Date.now() };
}

function invitacion(ahora = new Date()) {
  const saludo = saludoDeLaHora(ahora);
  return sinRepetir(INVITACIONES, ultimasInvitaciones, 4)
    .replace('{saludo}', saludo)
    .replace('{saludo_min}', saludo.toLowerCase());
}

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
  const res = await fetch(`${llm.PROVIDERS[MOTOR].url}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELO, max_tokens: 1, reasoning_effort: 'none',
      messages: [{ role: 'system', content: personalidad() }, { role: 'user', content: SE_ACERCA }],
    }),
  });
  if (!res.ok) throw new Error(`el motor (${MOTOR}) respondió ${res.status}`);
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

  const fija = (respuesta, extra = {}) => {
    onFrase(respuesta);
    conv.historial.push({ role: 'user', content: `El estudiante dice: ${texto}`, texto });
    conv.historial.push({ role: 'assistant', content: respuesta, texto: respuesta });
    return { texto: respuesta, mostrar: null, datos: [], ...extra };
  };
  const ofrecio = conv.ofrecioExplicar;
  conv.ofrecioExplicar = false;
  if (PIDE_CREADOR.test(texto)) {
    conv.ofrecioExplicar = true; // si dice «sí», arranca la presentación
    return fija(RESPUESTA_CREADOR);
  }
  if (ofrecio && DICE_QUE_SI.test(texto)) return fija(INTRO_EXPLICACION, { accion: 'explicar' });

  if (PIDE_EXPLICACION.test(texto)) {
    onFrase(INTRO_EXPLICACION);
    conv.historial.push({ role: 'user', content: `El estudiante dice: ${texto}`, texto });
    conv.historial.push({ role: 'assistant', content: INTRO_EXPLICACION, texto: INTRO_EXPLICACION });
    return { texto: INTRO_EXPLICACION, mostrar: null, datos: [], accion: 'explicar' };
  }

  let hits = [];
  const carreras = carrerasEnCharla(conv, texto);
  let datos = bloqueFichas(carreras) + bloqueConfirmados(texto, carreras);
  const vacio = SIN_DATOS.find(([re]) => re.test(texto));
  if (vacio) {
    // tema que la web de Unifranz no cubre: ni se busca (traería noticias sueltas que la confunden)
    datos = `DATOS DE UNIFRANZ: NO hay información sobre ${vacio[1]}. No digas «sí» ni «no» ni lo supongas: di con ` +
      `cariño que ese detalle se lo explican en Admisiones de Unifranz, y sigue la conversación.\n\n${datos}`;
  } else if (necesitaDatos(texto)) {
    // se dice YA, mientras busca y piensa; solo ante preguntas («veo videos de cómo funciona…» no lo es)
    // (por micrófono Whisper a veces no pone «¿?»: «hola, quiero saber si hay becas» también es pregunta)
    if (/[?¿]|^(qu[eé]|cu[aá]nt|cu[aá]l|c[oó]mo|d[oó]nde|cu[aá]ndo|qui[eé]n|hay|tienen|puedo|se puede)\b|\b(quiero saber|me (puedes|podr[ií]as) decir|dime|si hay|hay|tienen|cu[aá]nt\w*|d[oó]nde|cu[aá]ndo|qui[eé]n)\b/i.test(texto)) {
      onFrase(muletilla(), { muletilla: true });
    }
    try {
      hits = await buscar(consultaPara(conv, texto, carreras), signal);
      datos = `${bloqueDatos(hits)}\n\n${datos}`; // la ficha exacta queda al final, pegada a la pregunta
    } catch (err) {
      if (signal.aborted) throw err;
      datos = `DATOS DE UNIFRANZ: no pudiste revisarlos ahora. Si te piden un dato concreto, di que lo confirmen en Admisiones.\n\n${datos}`;
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

  await llm.chat(MOTOR, {}, { model: MODELO, messages }, (pieza) => {
    crudo += pieza;
    onTexto(paraVoz(crudo));
    entregarFrases(false);
  }, signal);
  entregarFrases(true);

  // lo que pidió mostrar, salvo que ya esté en pantalla desde antes (no marear con la misma página)
  conv.mostrados ??= new Set();
  const pidio = PIDE_VER.test(texto); // si lo pidió él, se muestra aunque ya haya salido antes
  const pedido = [...crudo.matchAll(ETIQUETA)].map((m) => resolverMostrar(m[1])).find(Boolean)
    || mostrarPorPedido(texto, carreras) || null;
  const clave = pedido && (pedido.carrera?.nombre || pedido.nombre);
  const mostrar = pedido && (pidio || !conv.mostrados.has(clave)) ? pedido : null;
  if (mostrar) conv.mostrados.add(clave);

  const dicho = paraVoz(crudo);
  conv.historial.push({ role: 'user', content: `El estudiante dice: ${texto}`, texto });
  conv.historial.push({ role: 'assistant', content: crudo.trim(), texto: dicho });
  return { texto: dicho, mostrar, datos: hits };
}

module.exports = { nuevaConversacion, responder, invitacion, despedida, anotarTami, calentar, DESPEDIDA, cargarCatalogo, resolverMostrar, PAGINAS };
