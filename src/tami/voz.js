// voz.js — Tami dice frases en voz alta, una detrás de otra, y avisa cuánto abrir la boca.
//
//   const voz = new Voz({ alVolumen: (v) => avatar.boca(v) })
//   voz.decir('Hola.'); voz.decir('¿Qué tal?')   → se piden YA las dos al servidor (en paralelo con
//                                                 lo que esté sonando) y suenan en orden
//   voz.callar()                                → corta todo (el estudiante la interrumpió)
//
// La boca sale del VOLUMEN del audio: 60 veces por segundo se mide qué tan fuerte suena (RMS).
// Fuerte = boca abierta, silencio = cerrada. No es perfecto como unos labios reales, pero a simple
// vista se ve que habla «al ritmo» de lo que dice, que es lo que importa.

const SERVIDOR = 'http://127.0.0.1:8767';

export class Voz {
  constructor({ alVolumen = () => {}, alEmpezar = () => {}, alTerminar = () => {} } = {}) {
    this.alVolumen = alVolumen;
    this.alEmpezar = alEmpezar;   // empezó a sonar la primera frase de una tanda
    this.alTerminar = alTerminar; // ya no queda nada por decir
    this.cola = [];               // [{ texto, audio: Promise<AudioBuffer|null> }]
    this.sonando = null;          // el AudioBufferSourceNode actual
    this.generacion = 0;          // sube con callar(): lo que llegue de antes se descarta
    this.ctx = null;
  }

  // El AudioContext se crea con la primera frase (Chrome no deja sonar audio antes de que haya actividad)
  asegurar() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.analizador = this.ctx.createAnalyser();
    this.analizador.fftSize = 1024;
    this.analizador.connect(this.ctx.destination);
    this.muestras = new Float32Array(this.analizador.fftSize);
    const medir = () => {
      let v = 0;
      if (this.sonando) {
        this.analizador.getFloatTimeDomainData(this.muestras);
        let suma = 0;
        for (const m of this.muestras) suma += m * m;
        const rms = Math.sqrt(suma / this.muestras.length);
        v = Math.min(1, Math.max(0, (rms - 0.015) * 7)); // ~0,015 es silencio; ~0,16 es voz fuerte
      }
      this.alVolumen(v);
      requestAnimationFrame(medir);
    };
    requestAnimationFrame(medir);
  }

  async pedir(texto) {
    try {
      const res = await fetch(`${SERVIDOR}/hablar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch (err) {
      console.warn('[voz] no pude decir:', texto, err.message);
      return null; // esa frase se salta (igual queda en los subtítulos)
    }
  }

  decir(texto) {
    this.asegurar();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.cola.push({ texto, audio: this.pedir(texto) });
    if (!this.sonando && this.cola.length === 1) this.siguiente(true);
  }

  async siguiente(primera = false) {
    const gen = this.generacion;
    const item = this.cola[0];
    if (!item) { this.sonando = null; this.alTerminar(); return; }
    const buffer = await item.audio;
    if (gen !== this.generacion) return; // la callaron mientras esperaba
    this.cola.shift();
    if (!buffer) return this.siguiente(primera);
    const fuente = this.ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(this.analizador);
    this.sonando = fuente;
    if (primera) this.alEmpezar();
    fuente.onended = () => {
      if (gen !== this.generacion) return;
      this.sonando = null;
      // pausita natural entre frases
      setTimeout(() => gen === this.generacion && this.siguiente(), 120);
    };
    fuente.start();
  }

  get hablando() {
    return Boolean(this.sonando) || this.cola.length > 0;
  }

  callar() {
    this.generacion++;
    this.cola = [];
    try { this.sonando?.stop(); } catch { /* ya había terminado */ }
    this.sonando = null;
  }
}
