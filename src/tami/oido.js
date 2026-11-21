// oido.js — el micrófono de Tami: graba mientras el estudiante habla y le pide a Whisper el texto.
//
//   const oido = new Oido({ alNivel: (v) => ... });   // v de 0 a 1, para dibujar el volumen
//   await oido.empezar();                               // pide el micrófono (la 1.ª vez) y graba
//   const texto = await oido.terminar();                // deja de grabar → Whisper → «¿hay becas?»
//
// Por qué grabamos «a mano» (números del micrófono → WAV) y no con MediaRecorder: MediaRecorder da WebM/Opus y
// habría que decodificarlo en Python con PyAV, cuya versión nueva rompe faster-whisper. Un WAV de 16 kHz mono es
// exactamente lo que Whisper usa por dentro, así que el servidor solo lo lee.

const ESCUCHAR_URL = 'http://127.0.0.1:8767/escuchar';
const HZ = 16000;           // lo que espera Whisper
const MAX_SEGUNDOS = 15;    // si se olvidan de soltar el botón

export class Oido {
  constructor({ alNivel = () => {} } = {}) {
    this.alNivel = alNivel;
    this.grabando = false;
    this.trozos = [];
    this.flujo = null;
  }

  async empezar() {
    if (this.grabando) return;
    if (!this.flujo) {
      // el navegador limpia el ruido de la feria y nivela el volumen antes de que llegue a Whisper
      this.flujo = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.ctx = new AudioContext({ sampleRate: HZ });
      this.fuente = this.ctx.createMediaStreamSource(this.flujo);
      this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
      this.proc.onaudioprocess = (e) => {
        if (!this.grabando) return;
        const datos = e.inputBuffer.getChannelData(0);
        this.trozos.push(new Float32Array(datos));
        let suma = 0;
        for (let i = 0; i < datos.length; i++) suma += datos[i] * datos[i];
        this.alNivel(Math.min(1, Math.sqrt(suma / datos.length) * 8));
        if (this.muestras() > MAX_SEGUNDOS * HZ) this.alLimite?.();
      };
      this.fuente.connect(this.proc);
      this.proc.connect(this.ctx.destination); // (sale en silencio: el procesador no copia nada a la salida)
    }
    await this.ctx.resume();
    this.trozos = [];
    this.grabando = true;
  }

  muestras() { return this.trozos.reduce((n, t) => n + t.length, 0); }

  // deja de grabar y devuelve lo que dijo ('' si no se entendió o fue muy corto)
  async terminar() {
    if (!this.grabando) return '';
    this.grabando = false;
    this.alNivel(0);
    if (this.muestras() < HZ * 0.4) return ''; // menos de 0,4 s: fue un toque sin querer
    const res = await fetch(ESCUCHAR_URL, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: aWav(this.trozos) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `oído ${res.status}`);
    return (await res.json()).texto || '';
  }
}

// Float32 (-1..1) → WAV PCM de 16 bits: 44 bytes de cabecera + las muestras
function aWav(trozos) {
  const n = trozos.reduce((s, t) => s + t.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, HZ, true); v.setUint32(28, HZ * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const t of trozos) for (let i = 0; i < t.length; i++, o += 2) {
    const m = Math.max(-1, Math.min(1, t[i]));
    v.setInt16(o, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
