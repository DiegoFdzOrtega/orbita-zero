/* =====================================================================
   DiegoFo Engine · motor (bucle de juego)
   ---------------------------------------------------------------------
   Une todos los módulos y ejecuta el BUCLE DE JUEGO:

       ┌──────────────────────────────────────────────┐
       │  requestAnimationFrame (≈60 veces/segundo)    │
       │   1. medir el tiempo pasado                   │
       │   2. LÓGICA en pasos fijos de 1/60 s          │
       │        entrada → escena.actualizar → física   │
       │   3. RENDER una vez                           │
       │        escena.dibujar → depurador             │
       └──────────────────────────────────────────────┘

   Paso fijo: la lógica avanza siempre en trozos de 1/60 s aunque el
   móvil vaya a 30 FPS o la pantalla a 120 Hz. Así el juego se comporta
   igual en todos los dispositivos (un salto llega siempre a la misma
   altura).
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  class Motor extends DFE.Emisor {
    constructor(opciones = {}) {
      super();
      this.canvas = typeof opciones.canvas === "string"
        ? document.querySelector(opciones.canvas) : opciones.canvas;

      // Subsistemas
      this.pantalla = new DFE.Pantalla(this.canvas, opciones);
      this.entrada = new DFE.Entrada(this.canvas);
      this.audio = new DFE.Audio();
      this.guardado = new DFE.Guardado(opciones.nombre || "dfe");
      this.depurador = new DFE.Depurador(this);
      this.recursos = DFE.Recursos;

      // Estado del bucle
      this.escena = null;
      this.paso = 1 / (opciones.pasosPorSegundo || 60);
      this.acumulado = 0;
      this.ultimo = 0;
      this.tiempo = 0;            // segundos de juego transcurridos
      this.escalaTiempo = 1;      // 0.3 = cámara lenta
      this.pausado = false;
      this.enMarcha = false;

      this._bucle = this._bucle.bind(this);
      this._configurarDispositivo();
    }

    /* ---------- Eventos del dispositivo ---------- */
    _configurarDispositivo() {
      // Girar el móvil o cambiar el tamaño de la ventana
      const ajustar = () => {
        this.pantalla.ajustar();
        if (this.escena) this.escena.alRedimensionar(this.pantalla.anchoVisible, this.pantalla.altoVisible);
        this.emit("redimensionar", this.pantalla);
      };
      window.addEventListener("resize", ajustar);
      window.addEventListener("orientationchange", () => setTimeout(ajustar, 150));
      if (window.ResizeObserver) new ResizeObserver(ajustar).observe(this.canvas);

      // Cambiar de app, bloquear el móvil o cambiar de pestaña:
      // pausamos para no gastar batería ni perder la partida
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.audio.suspender();
          if (!this.pausado) { this.pausar(); this.emit("pausa-automatica"); }
        }
      });

      // El primer toque desbloquea el audio (norma de los navegadores móviles)
      const desbloquear = () => this.audio.desbloquear();
      window.addEventListener("pointerdown", desbloquear, { once: true });
      window.addEventListener("keydown", desbloquear, { once: true });
    }

    /* ---------- Control ---------- */

    /** Arranca el bucle con una escena. */
    iniciar(escena) {
      this.cambiarEscena(escena);
      if (!this.enMarcha) {
        this.enMarcha = true;
        this.ultimo = performance.now();
        requestAnimationFrame(this._bucle);
      }
    }

    cambiarEscena(escena) {
      if (this.escena) this.escena.alSalir();
      this.escena = escena;
      escena.motor = this;
      this.entrada.soltarTodo();
      escena.alEntrar();
      escena.alRedimensionar(this.pantalla.anchoVisible, this.pantalla.altoVisible);
      this.emit("escena", escena);
    }

    pausar() {
      this.pausado = true;
      this.entrada.soltarTodo();
      this.emit("pausa");
    }

    reanudar() {
      this.pausado = false;
      this.acumulado = 0;
      this.ultimo = performance.now(); // que no cuente el tiempo en pausa
      this.audio.reanudar();
      this.emit("reanudar");
    }

    /* ---------- El bucle ---------- */
    _bucle(ahora) {
      if (!this.enMarcha) return;
      let dtReal = (ahora - this.ultimo) / 1000;
      this.ultimo = ahora;
      this.depurador.medir(dtReal);
      // Si el móvil se ha quedado colgado un rato, no intentamos
      // recuperar todo el tiempo de golpe ("espiral de la muerte")
      if (dtReal > 0.25) dtReal = 0.25;

      if (!this.pausado && this.escena) {
        this.acumulado += dtReal * this.escalaTiempo;
        while (this.acumulado >= this.paso) {
          this.escena._actualizar(this.paso);
          this.entrada.finDePaso();
          this.tiempo += this.paso;
          this.acumulado -= this.paso;
        }
      }

      if (this.escena) {
        const ctx = this.pantalla.comenzar(this.escena.colorFondo);
        this.escena._dibujar(ctx);
        this.depurador.dibujar(ctx, this.escena);
      }
      requestAnimationFrame(this._bucle);
    }
  }

  DFE.Motor = Motor;
})();
