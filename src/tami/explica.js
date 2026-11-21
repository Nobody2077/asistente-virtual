// explica.js — la animación «Así funciona Tami». Tami (app.js) narra; main.js manda aquí qué escena mostrar.
//
//   escena 0 equipo · 1 leer la web · 2 limpiar · 3 partir en pedazos · 4 convertir en vectores (galaxia) ·
//   5 buscar una pregunta · 6 la cadena completa · 7 el camino en clases · 8 resultados
//
// Lo que se ve es REAL: el texto de la página de Becas, los 8093 pedazos de la memoria ubicados en 2D
// (cerebro/armar_mapa.py) y los vecinos verdaderos de la pregunta (servidor de memoria, /ubicar).
'use strict';

const $ = (id) => document.getElementById(id);
const cielo = $('cielo');
const ctx = cielo.getContext('2d');
const COLOR_TIPO = ['#ff5a1a', '#ffd166', '#4cc9f0', '#6b7a99', '#c77dff']; // carreras, admisión, sedes, noticias, universidad
const TITULOS = [
  'El equipo', 'Leer la web de Unifranz', 'Limpiar la basura', 'Partir en pedazos', 'Convertir en vectores',
  'Buscar tu pregunta', 'Responder con voz', 'El camino en clases', 'Resultados',
];

let W = 0, H = 0, dpr = 1;
let mapa = null;          // { puntos: [[x,y,grupo,tipo]...], etiquetas, tipos }
let orden = [];           // orden en que «nacen» las estrellas
let ubicacion = null;     // { x, y, vecinos, titulos, vector }
let escena = -1, t0 = performance.now();
const particulas = [];    // tarjetas, chispas y estrellas que viajan

// --- tamaño y coordenadas -----------------------------------------------------------------------------
function ajustar() {
  dpr = window.devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  cielo.width = W * dpr; cielo.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', ajustar);
ajustar();

const centroGalaxia = () => ({ x: W * 0.75, y: H * 0.54, r: Math.min(W * 0.21, H * 0.36) });
function aPantalla(x, y) {
  const g = centroGalaxia();
  return { x: g.x + x * g.r * 0.86, y: g.y + y * g.r * 0.86 };
}
const centroDe = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
const azar = (a, b) => a + Math.random() * (b - a);
const suave = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// --- la página web (escenas 1-3) -------------------------------------------------------------------------
// Texto REAL de unifranz.edu.bo/admisiones/becas (incluye su aviso de cookies: basura de verdad) + el «chrome»
// típico de una web (menú, etiquetas, pie) para mostrar qué se limpia.
let palabras = [];
function armarWeb(pagina) {
  const cuerpo = $('web-cuerpo');
  cuerpo.querySelectorAll(':scope > :not(#haz)').forEach((n) => n.remove());
  const agregar = (tag, texto, clase = '') => {
    const el = document.createElement(tag);
    if (clase) el.className = clase;
    for (const p of texto.split(/(\s+)/)) {
      if (!p.trim()) { el.append(p); continue; }
      const s = document.createElement('span');
      s.className = 'pal';
      s.textContent = p;
      el.append(s);
    }
    cuerpo.append(el);
    return el;
  };
  const menu = document.createElement('div');
  menu.className = 'basura menu';
  menu.innerHTML = '<b>UNIFRANZ</b><span>Inicio</span><span>Carreras</span><span>Admisión</span><span>Contacto</span><span>☰</span>';
  cuerpo.append(menu);
  agregar('div', '<div class="navbar"> <script src="analytics.js">', 'basura etiqueta');
  const lineas = (pagina?.texto || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of lineas) {
    if (/^---|^(titulo|url|fuente|descargado):|^# /.test(l)) continue;
    const limpio = l.replace(/\*\*/g, '').replace(/^#+\s*/, '');
    if (/cookies|^aceptar/i.test(limpio)) agregar('div', limpio, 'basura');             // basura REAL de la página
    else if (/^\*\s/.test(l)) agregar('li', limpio.replace(/^\*\s*/, ''));
    else if (/^##/.test(l)) agregar('h5', limpio);
    else agregar('p', limpio);
  }
  agregar('div', '© 2026 Unifranz · Política de privacidad · Síguenos en redes · Volver arriba ↑', 'basura');
  agregar('div', '</div> <footer> <script>', 'basura etiqueta');
  palabras = [...cuerpo.querySelectorAll('p .pal, li .pal, h5 .pal')];
}

// --- el recolector: el registro de lo que Crawl4AI guardó (rutas y tamaños reales) ------------------------
let documentos = [];   // [{ ruta, caracteres }]
let anotados = 0;
function anotar(d) {
  const li = document.createElement('li');
  li.innerHTML = '<b>✓</b> ';
  li.append(d.ruta, Object.assign(document.createElement('i'), { textContent: `  · ${d.caracteres.toLocaleString('es-BO')} caracteres` }));
  const lista = $('registro');
  lista.append(li);
  while (lista.children.length > 16) lista.firstElementChild.remove();
}

// --- contadores que suben -----------------------------------------------------------------------------
function contar(el, hasta, ms, dec = 0) {
  const ini = performance.now();
  const paso = () => {
    const f = suave((performance.now() - ini) / ms);
    el.textContent = (hasta * f).toLocaleString('es-BO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (f < 1) requestAnimationFrame(paso);
  };
  paso();
}

// --- partículas ---------------------------------------------------------------------------------------
// tipo 'tarjeta' (pedazo de texto), 'estrella' (vector que vuela a su lugar), 'chispa', 'polvo', 'pregunta'
function lanzar(p) { particulas.push({ nace: performance.now(), dura: 1200, ...p }); }
function curva(a, b, c, t) { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y }; }

function dibujarParticulas(ahora) {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    const t = (ahora - p.nace) / p.dura;
    if (t >= 1) { p.alLlegar?.(); particulas.splice(i, 1); continue; }
    const e = suave(t);
    const pos = p.desde && p.hasta ? curva(p.desde, p.control || { x: (p.desde.x + p.hasta.x) / 2, y: Math.min(p.desde.y, p.hasta.y) - 80 }, p.hasta, e)
      : { x: p.x + (p.vx || 0) * t, y: p.y + (p.vy || 0) * t + 40 * t * t };
    ctx.save();
    if (p.tipo === 'tarjeta') {
      const s = 1 - 0.75 * e;
      ctx.translate(pos.x, pos.y); ctx.rotate((p.giro || 0) * (1 - e)); ctx.scale(s, s);
      ctx.globalAlpha = 1 - Math.max(0, (t - 0.85) / 0.15);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff5a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-46, -28, 92, 56, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#bbb';
      for (let k = 0; k < 4; k++) ctx.fillRect(-36, -18 + k * 11, k === 3 ? 40 : 72, 4);
      ctx.fillStyle = '#ff5a1a'; ctx.font = 'bold 9px Segoe UI'; ctx.fillText(`#${p.n}`, 22, 22);
    } else if (p.tipo === 'estrella' || p.tipo === 'pregunta') {
      const r = p.tipo === 'pregunta' ? 9 : 3.2;
      ctx.shadowColor = p.color; ctx.shadowBlur = 16;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.35; ctx.strokeStyle = p.color; ctx.lineWidth = r * 0.8;   // estela
      const atras = curva(p.desde, p.control || { x: (p.desde.x + p.hasta.x) / 2, y: Math.min(p.desde.y, p.hasta.y) - 80 }, p.hasta, Math.max(0, e - 0.08));
      ctx.beginPath(); ctx.moveTo(atras.x, atras.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (p.tipo === 'palabra') { // una palabra leída que vuela al recolector
      ctx.globalAlpha = 1 - Math.max(0, (t - 0.8) / 0.2);
      ctx.font = `700 ${Math.round(14 - 6 * e)}px Segoe UI`; ctx.fillStyle = '#ff8a50';
      ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 10;
      ctx.fillText(p.texto, pos.x, pos.y);
    } else { // chispa / polvo
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color || '#ff8a50';
      ctx.fillRect(pos.x, pos.y, p.tam || 3, p.tam || 3);
    }
    ctx.restore();
  }
}

// --- la galaxia (la memoria) ----------------------------------------------------------------------------
let visibles = 0;         // cuántas estrellas ya «nacieron» (escena 4 las va encendiendo)
let destacados = [];      // vecinos de la pregunta (escena 5)
function dibujarGalaxia(ahora, alfaBase) {
  if (!mapa) return;
  const n = Math.floor(visibles);
  const porTipo = [[], [], [], [], []];
  for (let k = 0; k < n; k++) porTipo[mapa.puntos[orden[k]][3]].push(orden[k]);
  // noticias primero (atrás y más tenues), páginas oficiales encima
  for (const tipo of [3, 4, 0, 1, 2]) {
    ctx.fillStyle = COLOR_TIPO[tipo];
    ctx.globalAlpha = alfaBase * (tipo === 3 ? 0.45 : 0.95);
    const tam = tipo === 3 ? 1.6 : 2.6;
    for (const i of porTipo[tipo]) {
      const p = mapa.puntos[i];
      const s = aPantalla(p[0], p[1]);
      ctx.fillRect(s.x - tam / 2, s.y - tam / 2, tam, tam);
    }
  }
  // titilar: algunas estrellas brillan un instante
  ctx.globalAlpha = alfaBase;
  for (let k = 0; k < 14 && n; k++) {
    const i = orden[Math.floor((Math.sin(ahora / 900 + k * 7.3) * 0.5 + 0.5) * (n - 1))];
    const p = mapa.puntos[i]; const s = aPantalla(p[0], p[1]);
    ctx.fillStyle = '#fff'; ctx.shadowColor = COLOR_TIPO[p[3]]; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  // nombres de los temas más grandes
  if (escena === 4 || escena === 5) {
    ctx.globalAlpha = alfaBase * 0.85 * Math.min(1, n / mapa.puntos.length * 1.6);
    ctx.font = '600 12px Segoe UI'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8e8e8';
    for (const e of mapa.etiquetas.filter((x) => x.nombre).sort((a, b) => b.n - a.n).slice(0, 12)) {
      const s = aPantalla(e.x, e.y);
      ctx.fillText(e.nombre, s.x, s.y - 14);
    }
  }
  ctx.globalAlpha = 1;
}

function dibujarBusqueda(ahora) {
  if (!ubicacion || !ubicacion.llego) return;
  const q = aPantalla(ubicacion.x, ubicacion.y);
  const t = (ahora - ubicacion.llego) / 1000;
  // radar: ondas que salen de la pregunta
  for (let k = 0; k < 3; k++) {
    const f = ((t + k * 0.6) % 1.8) / 1.8;
    ctx.globalAlpha = 1 - f; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(q.x, q.y, 10 + f * 90, 0, Math.PI * 2); ctx.stroke();
  }
  // hilos hacia los vecinos VERDADEROS (los más cercanos en los 384 números)
  destacados.forEach((i, k) => {
    const f = suave((t - 0.4 - k * 0.35) / 0.5);
    if (f <= 0) return;
    const p = mapa.puntos[i]; const s = aPantalla(p[0], p[1]);
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -ahora / 40;
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + (s.x - q.x) * f, q.y + (s.y - q.y) * f); ctx.stroke();
    ctx.setLineDash([]);
    if (f >= 1) {
      ctx.fillStyle = '#ffd166'; ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(s.x, s.y, 6 + Math.sin(ahora / 200 + k) * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#111'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText(k + 1, s.x, s.y + 3.5);
    }
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
}

// fondo: estrellitas que se mueven despacio en todas las escenas
const polvoFondo = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), v: azar(0.002, 0.008), a: azar(0.1, 0.5) }));
function dibujarFondo(ahora) {
  for (const p of polvoFondo) {
    const x = ((p.x + (ahora / 1000) * p.v) % 1) * W;
    ctx.globalAlpha = p.a; ctx.fillStyle = '#fff'; ctx.fillRect(x, p.y * H, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

// --- lo que pasa en cada escena (cada cuadro) -------------------------------------------------------------
let ultimoLanzamiento = 0;
let leidas = 0;
function cuadro(ahora) {
  ctx.clearRect(0, 0, W, H);
  dibujarFondo(ahora);
  const t = (ahora - t0) / 1000;
  const motor = centroDe($('motor'));
  const web = $('web').getBoundingClientRect();

  const boca = centroDe($('boca'));
  if (escena === 1) { // el haz lee: las palabras se iluminan y VUELAN al recolector, que anota cada documento
    const meta = Math.min(palabras.length, Math.floor(t * 22));
    for (; leidas < meta; leidas++) {
      const w = palabras[leidas]; w.classList.add('leida');
      if (leidas % 2 === 0) {
        const r = w.getBoundingClientRect();
        lanzar({ tipo: 'palabra', texto: w.textContent, dura: 1300, desde: { x: r.left, y: r.top + r.height * 0.8 },
          control: { x: (r.right + boca.x) / 2, y: r.top - azar(60, 200) }, hasta: boca });
      }
    }
    const docs = Math.min(documentos.length, Math.floor(suave(t / 9) * documentos.length));
    for (; anotados < docs; anotados++) anotar(documentos[anotados]);
    $('tanque-nivel').style.width = `${(anotados / Math.max(1, documentos.length)) * 100}%`;
    $('tanque-texto').textContent = `${anotados} / ${documentos.length} documentos`;
  }
  if (escena === 3 && ahora - ultimoLanzamiento > 200) { // pedazos: del recolector salen tarjetas hacia el motor
    ultimoLanzamiento = ahora;
    const rec = $('recolector').getBoundingClientRect();
    lanzar({ tipo: 'tarjeta', n: Math.floor(azar(1, 8093)), dura: 1500, giro: azar(-0.5, 0.5),
      desde: { x: azar(rec.left + 60, rec.right - 60), y: azar(rec.top + 140, rec.bottom - 40) },
      control: { x: (rec.left + motor.x) / 2, y: azar(H * 0.1, H * 0.9) }, hasta: motor });
  }
  if (escena === 4 && mapa) { // vectores: del motor salen estrellas a su lugar real en la galaxia
    visibles = Math.min(mapa.puntos.length, visibles + mapa.puntos.length / (60 * 7)); // ~7 s para encender las 8093
    if (ahora - ultimoLanzamiento > 70) {
      ultimoLanzamiento = ahora;
      const i = orden[Math.floor(Math.min(visibles, mapa.puntos.length - 1))];
      const p = mapa.puntos[i];
      lanzar({ tipo: 'estrella', color: COLOR_TIPO[p[3]], dura: 1100, desde: motor,
        control: { x: (motor.x + W * 0.75) / 2, y: motor.y - azar(80, 220) }, hasta: aPantalla(p[0], p[1]) });
      if (Math.random() < 0.5) {
        lanzar({ tipo: 'tarjeta', n: Math.floor(azar(1, 8093)), dura: 900, giro: azar(-0.4, 0.4),
          desde: { x: azar(W * 0.05, W * 0.3), y: azar(H * 0.2, H * 0.8) }, hasta: motor });
      }
      const v = Array.from({ length: 6 }, () => (Math.random() * 0.2 - 0.1).toFixed(3));
      $('vector-cinta').textContent = `[ ${v.join(', ')}, … ]  384 números`;
    }
  }

  const alfaGalaxia = escena === 4 || escena === 5 ? 1 : escena >= 6 || escena === 0 ? 0.18 : 0;
  dibujarGalaxia(ahora, alfaGalaxia);
  if (escena === 5) dibujarBusqueda(ahora);
  if (escena === 6) { // un pulso de luz recorre la cadena
    const f = (t % 3) / 3;
    ctx.globalAlpha = 0.8; ctx.fillStyle = '#ff8a50'; ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(W * (0.08 + f * 0.84), H * 0.5, 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  dibujarParticulas(ahora);
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

// --- cambiar de escena ---------------------------------------------------------------------------------
function irA(n, datos = {}) {
  escena = n; t0 = performance.now();
  document.body.dataset.escena = String(n);
  $('paso').textContent = n >= 0 ? `${n + 1} / ${TITULOS.length}` : '';
  $('titulo').textContent = n >= 0 ? TITULOS[n] : 'Así funciona Tami';
  if (n === 1) {
    leidas = 0; palabras.forEach((w) => w.classList.remove('leida'));
    anotados = 0; $('registro').replaceChildren(); $('limpieza').textContent = '';
    contar($('c-paginas'), 95, 7000); contar($('c-noticias'), 440, 7000);
  }
  if (n === 2) { // limpiar: se marca la basura y sale volando, dejando solo el contenido
    const basura = [...document.querySelectorAll('.basura')];
    basura.forEach((b, k) => setTimeout(() => b.classList.add('marcada'), 300 + k * 350));
    // cuánta basura tenía ESTA página (medido aquí mismo, no inventado)
    const total = $('web-cuerpo').textContent.replace(/\s+/g, ' ').length;
    const sucio = basura.reduce((s, b) => s + b.textContent.replace(/\s+/g, ' ').length, 0);
    basura.forEach((b, k) => setTimeout(() => {
      b.classList.add('fuera');
      setTimeout(() => b.classList.add('ida'), 850); // y se cierra el hueco
      const r = b.getBoundingClientRect();
      for (let j = 0; j < 18; j++) lanzar({ tipo: 'polvo', x: azar(r.left, r.right), y: azar(r.top, r.bottom), vx: azar(-80, 40), vy: azar(-30, 60), dura: 900, color: '#e55', tam: 2 });
      const li = Object.assign(document.createElement('li'), { className: 'nota', textContent: `🧹 quitado: ${b.textContent.trim().slice(0, 48)}…` });
      $('registro').append(li);
    }, 1600 + k * 450));
    setTimeout(() => {
      palabras.forEach((w) => w.classList.add('recogida'));
      $('limpieza').textContent = `Esta página: ${total.toLocaleString('es-BO')} → ${(total - sucio).toLocaleString('es-BO')} caracteres útiles ` +
        `(${Math.round((sucio / total) * 100)} % era basura)`;
    }, 1600 + basura.length * 450 + 300);
  }
  if (n === 3) contar($('c-pedazos'), 8093, 8000);
  if (n === 4) { visibles = 0; $('motor-nombre').textContent = 'e5'; }
  if (n === 5) {
    if (mapa) visibles = mapa.puntos.length;
    destacados = []; $('encontrados-lista').replaceChildren();
    ubicacion = datos.ubicacion || null;
    $('pregunta-texto').textContent = datos.pregunta || '¿hay becas?';
    if (ubicacion) {
      const desde = centroDe($('pregunta'));
      setTimeout(() => lanzar({ tipo: 'pregunta', color: '#ffffff', dura: 1400, desde, hasta: aPantalla(ubicacion.x, ubicacion.y),
        control: { x: W * 0.45, y: H * 0.15 },
        alLlegar: () => {
          ubicacion.llego = performance.now();
          destacados = ubicacion.vecinos.slice(0, 5);
          ubicacion.titulos.slice(0, 5).forEach((tt, k) => setTimeout(() => {
            const li = Object.assign(document.createElement('li'), { textContent: tt });
            $('encontrados-lista').append(li);
            requestAnimationFrame(() => li.classList.add('ver'));
          }, 500 + k * 350));
        } }), 700);
    }
  }
  if (n === 8) document.querySelectorAll('#resultados b[data-hasta]').forEach((b) => contar(b, Number(b.dataset.hasta), 2200, Number(b.dataset.dec || 0)));
}

function cargar(datos) {
  if (datos.mapa) {
    mapa = datos.mapa;
    orden = mapa.puntos.map((_, i) => i).sort(() => Math.random() - 0.5);
    const cuenta = [0, 0, 0, 0, 0];
    mapa.puntos.forEach((p) => cuenta[p[3]]++);
    $('leyenda').innerHTML = mapa.tipos.map((t, i) => `<span><i style="background:${COLOR_TIPO[i]}"></i>${t} · ${cuenta[i].toLocaleString('es-BO')}</span>`).join('');
  }
  if (datos.pagina) armarWeb(datos.pagina);
  if (datos.documentos) documentos = datos.documentos;
}

window.explica?.alDatos(cargar);
window.explica?.alEscena(({ n, datos }) => irA(n, datos));
$('cerrar').addEventListener('click', () => window.explica?.cerrar());
window.explicaPrueba = { irA, cargar }; // para las fotos de prueba
