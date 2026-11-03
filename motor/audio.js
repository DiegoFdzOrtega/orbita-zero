/* =====================================================================
   DiegoFo Engine · audio y vibración
   ---------------------------------------------------------------------
   Sonidos generados con la Web Audio API (osciladores y ruido): no hace
   falta descargar archivos, así el juego pesa poco y funciona sin red.

   Limitación de los móviles: el audio no puede sonar hasta que el
   usuario toca la pantalla. Por eso hay que llamar a desbloquear()
   dentro de un toque o clic (el motor lo hace solo en el primero).
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  class Audio {
    constructor() {
      this.ctx = null;
      this.activo = true;          // sonido encendido / apagado
      this.vibracion = true;       // vibración encendida / apagada
      this.volumen = 0.5;
      this.efectos = {};           // nombre → función que lo reproduce
      this.puedeVibrar = "vibrate" in navigator;
    }

    /** Crea el contexto de audio. Debe llamarse tras un gesto del usuario. */
    desbloquear() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.salida = this.ctx.createGain();
        this.salida.gain.value = this.volumen;
        this.salida.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    }

    /** Suspende el audio (al pausar o salir de la app ahorra batería). */
    suspender() {
      if (this.ctx && this.ctx.state === "running") this.ctx.suspend();
    }
    reanudar() {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    }

    /** Registra un efecto con nombre: audio.definir("salto", a => a.tono({...})) */
    definir(nombre, funcion) {
      this.efectos[nombre] = funcion;
    }

    reproducir(nombre) {
      if (!this.activo || !this.ctx || this.ctx.state !== "running") return;
      const f = this.efectos[nombre];
      if (f) f(this);
    }

    /** Un tono que puede deslizarse de una frecuencia a otra. */
    tono({ frecuencia = 440, hasta = null, duracion = 0.15, tipo = "square", volumen = 0.3, retraso = 0 } = {}) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + retraso;
      const osc = this.ctx.createOscillator();
      const gan = this.ctx.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(frecuencia, t);
      if (hasta) osc.frequency.exponentialRampToValueAtTime(hasta, t + duracion);
      // Envolvente: subida rápida y bajada suave (evita "clics")
      gan.gain.setValueAtTime(0.0001, t);
      gan.gain.exponentialRampToValueAtTime(volumen, t + 0.01);
      gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
      osc.connect(gan).connect(this.salida);
      osc.start(t);
      osc.stop(t + duracion + 0.02);
    }

    /** Ruido blanco (golpes, explosiones). */
    ruido({ duracion = 0.2, volumen = 0.3, filtro = 1200 } = {}) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const muestras = Math.floor(this.ctx.sampleRate * duracion);
      const buffer = this.ctx.createBuffer(1, muestras, this.ctx.sampleRate);
      const datos = buffer.getChannelData(0);
      for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;
      const fuente = this.ctx.createBufferSource();
      fuente.buffer = buffer;
      const pasoBajo = this.ctx.createBiquadFilter();
      pasoBajo.type = "lowpass";
      pasoBajo.frequency.value = filtro;
      const gan = this.ctx.createGain();
      gan.gain.setValueAtTime(volumen, t);
      gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
      fuente.connect(pasoBajo).connect(gan).connect(this.salida);
      fuente.start(t);
    }

    /** Programa una nota en un instante exacto del reloj de audio (para la música). */
    nota(midi, inicio, duracion, tipo = "square", volumen = 0.1) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gan = this.ctx.createGain();
      osc.type = tipo;
      osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);  // MIDI → hercios
      gan.gain.setValueAtTime(0.0001, inicio);
      gan.gain.exponentialRampToValueAtTime(volumen, inicio + 0.01);
      gan.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
      osc.connect(gan).connect(this.salidaMusica || this.salida);
      osc.start(inicio);
      osc.stop(inicio + duracion + 0.02);
    }

    /** Bombo: un tono grave que cae muy rápido. */
    bombo(inicio, volumen = 0.3) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gan = this.ctx.createGain();
      osc.frequency.setValueAtTime(130, inicio);
      osc.frequency.exponentialRampToValueAtTime(40, inicio + 0.12);
      gan.gain.setValueAtTime(volumen, inicio);
      gan.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.15);
      osc.connect(gan).connect(this.salidaMusica || this.salida);
      osc.start(inicio);
      osc.stop(inicio + 0.17);
    }

    /* ---------- Música: un secuenciador sencillo ----------
       Una canción es una lista de pistas; cada pista es una lista de
       notas MIDI por paso (semicorchea), con null para silencio.
       Se programan las notas un poco por adelantado con el reloj de la
       Web Audio API, que es mucho más preciso que setTimeout. */
    reproducirMusica(cancion) {
      if (!this.ctx) return;
      this.detenerMusica();
      if (!this.salidaMusica) {
        this.salidaMusica = this.ctx.createGain();
        this.salidaMusica.connect(this.salida);
      }
      this.salidaMusica.gain.value = this.musicaActiva ? 1 : 0;
      this.cancion = cancion;
      this._paso = 0;
      this._siguiente = this.ctx.currentTime + 0.1;
      this._reloj = setInterval(() => this._programarMusica(), 25);
    }

    detenerMusica() {
      clearInterval(this._reloj);
      this._reloj = null;
    }

    /** Enciende o apaga la música (sin parar el secuenciador). */
    set musicaActiva(valor) {
      this._musicaActiva = valor;
      if (this.salidaMusica) this.salidaMusica.gain.value = valor ? 1 : 0;
    }
    get musicaActiva() {
      return this._musicaActiva ?? true;
    }

    _programarMusica() {
      const ctx = this.ctx;
      if (!ctx || ctx.state !== "running" || !this.cancion) return;
      const duracionPaso = 60 / this.cancion.bpm / 4;
      // Si el reloj se ha quedado atrás (pestaña oculta), saltamos al presente
      if (this._siguiente < ctx.currentTime) this._siguiente = ctx.currentTime + 0.05;
      while (this._siguiente < ctx.currentTime + 0.15) {
        if (this.activo && this.musicaActiva) {
          for (const pista of this.cancion.pistas) {
            const n = pista.notas[this._paso % pista.notas.length];
            if (n === null || n === undefined) continue;
            if (pista.tipo === "bombo") this.bombo(this._siguiente, pista.volumen);
            else this.nota(n, this._siguiente, duracionPaso * (pista.duracion || 1), pista.tipo, pista.volumen);
          }
        }
        this._paso++;
        this._siguiente += duracionPaso;
      }
    }

    /** Vibra el móvil (Android). iPhone no lo permite desde la web. */
    vibrar(patron) {
      if (this.vibracion && this.puedeVibrar) {
        try { navigator.vibrate(patron); } catch (e) { /* sin vibración */ }
      }
    }
  }

  DFE.Audio = Audio;
})();
