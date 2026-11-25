// demo.js — «demos» que Tami muestra cuando está SOLA en el stand (idea de Juan, como Capri, 25/11):
// abre la mano hacia la izquierda y aparece una animación que explica cómo funciona, con un título grande.
//
//   const demo = crearDemo($('demo-lienzo'), $('demo-titulo'), $('demo-sub'))
//   await demo.mostrar('red' | 'memoria' | 'camino', ms)   → se ve ms milisegundos y se va sola
//   demo.ocultar()                                         → se va YA (llegó alguien)
//
// Todo dibujado con canvas 2D, sin imágenes. Solo anima mientras se ve (no gasta cuando está oculta).
// Los números son los mismos del guion de «Así funciona Tami»: nada inventado.

const NARANJA = '#ff5a1a';
const DEMOS = {
  red: {
    titulo: 'Así pienso: una red neuronal',
    sub: 'Cada pregunta viaja por miles de conexiones como estas hasta convertirse en respuesta.',
  },
  memoria: {
    titulo: 'Mi memoria: 8093 pedacitos de Unifranz',
    sub: 'Los que hablan de lo mismo quedan cerca, como estrellas de una constelación.',
  },
  camino: {
    titulo: 'Así te respondo',
    sub: 'Todo pasa aquí mismo, en esta computadora, sin internet.',
  },
};

export function crearDemo(lienzo, tituloEl, subEl) {
  const g = lienzo.getContext('2d');
  let activa = null;     // nombre de la demo que se ve
  let t0 = 0;
  let cuadro = 0;
  let fin = null;        // setTimeout que la oculta
  let alTerminar = null; // resuelve la promesa de mostrar()
  let escena = null;     // datos de la demo (nodos, puntos…)

  function medir() {
    const r = lienzo.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    lienzo.width = Math.max(1, Math.round(r.width * dpr));
    lienzo.height = Math.max(1, Math.round(r.height * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: r.width, h: r.height };
  }

  // --- red neuronal: capas de nodos, líneas finas y pulsos naranjas que viajan de capa en capa ----------
  function armarRed({ w, h }) {
    const capas = [4, 6, 6, 3];
    const nodos = capas.map((n, c) => Array.from({ length: n }, (_, i) => ({
      x: w * (0.1 + 0.8 * c / (capas.length - 1)),
      y: h * (0.5 + (i - (n - 1) / 2) * Math.min(0.15, 0.8 / n)),
      brillo: 0,
    })));
    const pulsos = [];
    return { nodos, pulsos, proximo: 0 };
  }
  function dibujarRed(e, t, { w, h }) {
    const r = Math.max(6, Math.min(w, h) * 0.028);
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,255,255,.22)';
    for (let c = 0; c < e.nodos.length - 1; c++) {
      for (const a of e.nodos[c]) for (const b of e.nodos[c + 1]) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    }
    // nace un pulso cada ~0,25 s en la primera capa; al llegar, enciende el nodo y sigue a la siguiente capa
    if (t > e.proximo) {
      e.proximo = t + 0.25;
      e.pulsos.push({ c: 0, de: Math.floor(Math.random() * e.nodos[0].length), a: Math.floor(Math.random() * e.nodos[1].length), p: 0 });
    }
    for (const p of e.pulsos) {
      p.p += 0.022;
      const A = e.nodos[p.c][p.de], B = e.nodos[p.c + 1][p.a];
      if (p.p >= 1) {
        B.brillo = 1;
        if (p.c + 2 < e.nodos.length) { p.c += 1; p.de = p.a; p.a = Math.floor(Math.random() * e.nodos[p.c + 1].length); p.p = 0; }
        else p.muerto = true;
        continue;
      }
      g.fillStyle = NARANJA;
      g.beginPath(); g.arc(A.x + (B.x - A.x) * p.p, A.y + (B.y - A.y) * p.p, r * 0.45, 0, Math.PI * 2); g.fill();
    }
    e.pulsos = e.pulsos.filter((p) => !p.muerto);
    for (const capa of e.nodos) for (const n of capa) {
      n.brillo *= 0.94;
      g.fillStyle = '#141414';
      g.beginPath(); g.arc(n.x, n.y, r, 0, Math.PI * 2); g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = n.brillo > 0.05 ? `rgba(255,90,26,${0.4 + n.brillo * 0.6})` : 'rgba(255,255,255,.85)';
      g.stroke();
      if (n.brillo > 0.05) { g.fillStyle = `rgba(255,90,26,${n.brillo})`; g.beginPath(); g.arc(n.x, n.y, r * 0.55, 0, Math.PI * 2); g.fill(); }
    }
  }

  // --- memoria: puntos sueltos que se juntan en 5 constelaciones (los temas) ---------------------------
  function armarMemoria({ w, h }) {
    const centros = Array.from({ length: 5 }, (_, i) => ({
      x: w * (0.18 + 0.64 * ((i * 0.37) % 1)), y: h * (0.22 + 0.56 * ((i * 0.61 + 0.2) % 1)),
    }));
    const colores = ['#ffffff', '#ffd2b8', '#141414', '#ffe9a8', '#ffb18a'];
    const puntos = Array.from({ length: 150 }, (_, i) => {
      const k = i % 5, ang = Math.random() * Math.PI * 2, rad = Math.random() * Math.min(w, h) * 0.15;
      return { x: Math.random() * w, y: Math.random() * h, mx: centros[k].x + Math.cos(ang) * rad, my: centros[k].y + Math.sin(ang) * rad, k, col: colores[k] };
    });
    return { puntos, centros };
  }
  function dibujarMemoria(e, t, { w, h }) {
    const junta = Math.min(1, t / 2.2); // en ~2 s se ordenan
    const s = junta * junta * (3 - 2 * junta);
    g.lineWidth = 1;
    for (const p of e.puntos) {
      const x = p.x + (p.mx - p.x) * s + Math.sin(t * 1.3 + p.mx) * 2;
      const y = p.y + (p.my - p.y) * s + Math.cos(t * 1.1 + p.my) * 2;
      if (s > 0.8) { // hilos al centro de su constelación
        g.strokeStyle = 'rgba(255,255,255,.12)';
        g.beginPath(); g.moveTo(x, y); g.lineTo(e.centros[p.k].x, e.centros[p.k].y); g.stroke();
      }
      g.fillStyle = p.col;
      g.beginPath(); g.arc(x, y, Math.max(3.5, Math.min(w, h) * 0.014), 0, Math.PI * 2); g.fill();
    }
  }

  // --- camino: Escucha → Recuerda → Piensa → Habla, se encienden en orden ----------------------------
  const PASOS = [['Escucha', 'Whisper'], ['Recuerda', 'memoria de Unifranz'], ['Piensa', 'Qwen'], ['Habla', 'Kokoro']];
  function dibujarCamino(_e, t, { w, h }) {
    const n = PASOS.length, bw = w * 0.2, bh = Math.min(h * 0.4, bw * 0.85), y = h * 0.5 - bh / 2;
    const paso = Math.floor(t / 0.9) % (n + 2); // se encienden de a uno; al final quedan todos y vuelve a empezar
    const fuente = Math.max(16, Math.min(w, h) * 0.075);
    PASOS.forEach(([nombre, detalle], i) => {
      const x = w * 0.04 + i * (w * 0.92 - bw) / (n - 1);
      const on = i < paso;
      g.fillStyle = on ? NARANJA : '#141414';
      g.beginPath(); g.roundRect(x, y, bw, bh, 18); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center';
      g.font = `800 ${fuente}px "Segoe UI", sans-serif`;
      g.fillText(nombre, x + bw / 2, y + bh * 0.48);
      g.font = `700 ${fuente * 0.52}px "Segoe UI", sans-serif`;
      g.fillStyle = on ? '#fff' : 'rgba(255,255,255,.7)';
      g.fillText(detalle, x + bw / 2, y + bh * 0.75);
      if (i < n - 1) { // flecha
        const ax = x + bw + 4, bx = w * 0.04 + (i + 1) * (w * 0.92 - bw) / (n - 1) - 4, ay = h * 0.5;
        g.strokeStyle = i + 1 < paso ? '#141414' : 'rgba(20,20,20,.35)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx - 8, ay); g.stroke();
        g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(bx, ay); g.lineTo(bx - 12, ay - 8); g.lineTo(bx - 12, ay + 8); g.fill();
      }
    });
  }

  const DIBUJAR = { red: dibujarRed, memoria: dibujarMemoria, camino: dibujarCamino };
  const ARMAR = { red: armarRed, memoria: armarMemoria, camino: () => ({}) };

  function animar() {
    if (!activa) return;
    const tam = { w: lienzo.clientWidth, h: lienzo.clientHeight };
    g.clearRect(0, 0, tam.w, tam.h);
    DIBUJAR[activa](escena, (performance.now() - t0) / 1000, tam);
    cuadro = requestAnimationFrame(animar);
  }

  function ocultar() {
    clearTimeout(fin);
    cancelAnimationFrame(cuadro);
    if (activa) document.body.classList.remove('con-demo');
    activa = null;
    alTerminar?.(); alTerminar = null;
  }

  function mostrar(nombre, ms = 7000) {
    ocultar();
    if (!DEMOS[nombre]) return Promise.resolve();
    tituloEl.textContent = DEMOS[nombre].titulo;
    subEl.textContent = DEMOS[nombre].sub;
    document.body.classList.add('con-demo'); // primero se ve la caja (si no, mide 0 × 0)
    const tam = medir();
    activa = nombre;
    escena = ARMAR[nombre](tam);
    t0 = performance.now();
    cuadro = requestAnimationFrame(animar);
    fin = setTimeout(ocultar, ms);
    return new Promise((r) => { alTerminar = r; });
  }

  return { mostrar, ocultar, activa: () => activa, nombres: Object.keys(DEMOS) };
}
