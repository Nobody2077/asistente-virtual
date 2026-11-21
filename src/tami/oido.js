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
const SILENCIO = 0.001;     // si el pico más alto no llega a esto, el micrófono no manda sonido (está mudo o es virtual)

// Micrófonos «de mentira» que crean otros programas: el de la cámara del celular (iVCam), el de Steam, cables
// virtuales... Windows a veces pone uno de estos como PREDETERMINADO y entonces Tami graba silencio.
const VIRTUALES = /ivcam|e2esoft|steam|virtual|vb-audio|cable|voicemeeter|stereo mix|mezcla est|droidcam|obs/i;

// Elige el micrófono: 1) el que pidieron con --mic "nombre", 2) el primero que NO sea virtual, 3) el predeterminado
async function elegirMicrofono(pedido) {
  const todos = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  const reales = todos.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications');
  const elegido = (pedido && reales.find((d) => d.label.toLowerCase().includes(pedido.toLowerCase())))
    || reales.find((d) => !VIRTUALES.test(d.label))
    || null;
  return { elegido, todos };
}

export class Oido {
  constructor({ alNivel = () => {}, pedido = '' } = {}) {
    this.alNivel = alNivel;
    this.pedido = pedido;   // parte del nombre del micrófono a usar (opcional)
    this.nombre = '';       // el micrófono que terminó usando (para mostrarlo si falla)
    this.grabando = false;
    this.trozos = [];
    this.flujo = null;
  }

  async empezar() {
    if (this.grabando) return;
    if (!this.flujo) {
      // el navegador limpia el ruido de la feria y nivela el volumen antes de que llegue a Whisper
      const filtros = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      // los nombres de los micrófonos solo se ven DESPUÉS de dar permiso: pedimos uno cualquiera y lo soltamos
      const permiso = await navigator.mediaDevices.getUserMedia({ audio: true });
      permiso.getTracks().forEach((t) => t.stop());
      const { elegido, todos } = await elegirMicrofono(this.pedido);
      console.log('[oido] micrófonos:', todos.map((d) => d.label).join(' | '), '→ uso:', elegido?.label || 'el predeterminado');
      this.flujo = await navigator.mediaDevices.getUserMedia({
        audio: elegido ? { ...filtros, deviceId: { exact: elegido.deviceId } } : filtros,
      });
      this.nombre = this.flujo.getAudioTracks()[0]?.label || '';
      this.ctx = new AudioContext({ sampleRate: HZ });
      this.fuente = this.ctx.createMediaStreamSource(this.flujo);
      this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
      this.proc.onaudioprocess = (e) => {
        if (!this.grabando) return;
        const datos = e.inputBuffer.getChannelData(0);
        this.trozos.push(new Float32Array(datos));
        let suma = 0;
        for (let i = 0; i < datos.length; i++) { suma += datos[i] * datos[i]; this.pico = Math.max(this.pico, Math.abs(datos[i])); }
        this.alNivel(Math.min(1, Math.sqrt(suma / datos.length) * 8));
        if (this.muestras() > MAX_SEGUNDOS * HZ) this.alLimite?.();
      };
      this.fuente.connect(this.proc);
      this.proc.connect(this.ctx.destination); // (sale en silencio: el procesador no copia nada a la salida)
    }
    await this.ctx.resume();
    this.trozos = [];
    this.pico = 0;
    this.grabando = true;
  }

  muestras() { return this.trozos.reduce((n, t) => n + t.length, 0); }

  // deja de grabar y devuelve lo que dijo ('' si no se entendió o fue muy corto)
  async terminar() {
    if (!this.grabando) return '';
    this.grabando = false;
    this.alNivel(0);
    if (this.muestras() < HZ * 0.4) return ''; // menos de 0,4 s: fue un toque sin querer
    if (this.pico < SILENCIO) throw Object.assign(new Error(`silencio total en «${this.nombre}»`), { mudo: true });
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
