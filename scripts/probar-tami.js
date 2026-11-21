// probar-tami.js — un estudiante de mentira conversa con Tami, sin interfaz ni voz.
// Sirve para revisar su personalidad, la entrevista vocacional y el RAG, y medir cuánto tarda.
//
// Necesita encendidos: LM Studio con qwen/qwen3.5-9b (puerto 1234) y cerebro/servidor_tami.py (8766).
// Uso:  node scripts/probar-tami.js               (la conversación de ejemplo)
//       node scripts/probar-tami.js "pregunta"     (una sola pregunta)

const tami = require('../src/main/tami');

const GUION = [
  'hola, la verdad no sé qué estudiar',
  'me gusta biología y ayudar a la gente',
  'en mi tiempo libre veo videos de cómo funciona el cuerpo humano',
  'vivo en El Alto',
  '¿y cuánto dura esa carrera?',
  '¿hay becas?',
  '¿cuánto cuesta la mensualidad?',
  '¿quién es la directora de la sede El Alto?',
];

async function main() {
  const preguntas = process.argv.length > 2 ? [process.argv.slice(2).join(' ')] : GUION;
  let s = Date.now();
  await tami.calentar();
  console.log(`(calentamiento: ${((Date.now() - s) / 1000).toFixed(1)} s — en la feria pasa una sola vez, al encender)`);
  const conv = tami.nuevaConversacion();
  const inv = tami.invitacion();
  tami.anotarTami(conv, inv);
  console.log(`\nTAMI (invita): ${inv}`);

  for (const p of preguntas) {
    console.log(`\nESTUDIANTE: ${p}`);
    const inicio = Date.now();
    let primera = null;
    const frases = [];
    const r = await tami.responder(conv, p, {
      onFrase: (f, info) => {
        if (info?.muletilla) return console.log(`TAMI (al instante): ${f}`);
        primera ??= Date.now() - inicio;
        frases.push(f);
      },
    });
    const total = Date.now() - inicio;
    console.log(`TAMI: ${r.texto}`);
    console.log(`   ⏱ 1.ª frase ${(primera / 1000).toFixed(1)} s · total ${(total / 1000).toFixed(1)} s · ${frases.length} frases · ${r.texto.split(/\s+/).length} palabras`);
    console.log(`   📚 RAG: ${r.datos.map((h) => `${h.distancia} «${h.titulo.split(' | ')[0].slice(0, 40)}»`).join(' | ') || '(nada cerca)'}`);
    if (r.mostrar) console.log(`   🖥 MOSTRAR: ${r.mostrar.tipo === 'carrera' ? r.mostrar.carrera.nombre : r.mostrar.nombre}`);
  }
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1); });
