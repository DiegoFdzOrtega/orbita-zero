/* =====================================================================
   DiegoFo Engine · pantalla (render) y cámara
   ---------------------------------------------------------------------
   El problema en móviles: cada pantalla tiene un tamaño, una
   orientación y una densidad de píxeles distinta.

   La solución: el juego trabaja en "unidades" y no en píxeles.
   Se define un área mínima (por ejemplo 480 × 270 unidades) que SIEMPRE
   se ve entera. La pantalla calcula la escala para que quepa y, si
   sobra sitio, se ve más mundo (no se deforma ni aparecen bandas negras).

   Tres sistemas de coordenadas:
     MUNDO    → donde viven los nodos (x crece a la derecha, y hacia abajo)
     CÁMARA   → la parte del mundo que se ve (cam.x, cam.y = esquina)
     PANTALLA → píxeles reales del canvas
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  class Pantalla {
    constructor(canvas, opciones = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.anchoMinimo = opciones.anchoMinimo || 480;
      this.altoMinimo = opciones.altoMinimo || 270;
      this.anchoMinimoVertical = opciones.anchoMinimoVertical || 0;
      // Límite de densidad: en móviles con 3× o 4× dibujar a resolución
      // completa gasta mucha batería y apenas se nota la diferencia.
      this.densidadMaxima = opciones.densidadMaxima || 2;

      this.escala = 1;          // unidades → píxeles CSS
      this.densidad = 1;        // píxeles CSS → píxeles reales
      this.anchoVisible = this.anchoMinimo;
      this.altoVisible = this.altoMinimo;
      this.ajustar();
    }

    /** Recalcula tamaños. Se llama al girar el móvil o cambiar la ventana. */
    ajustar() {
      const rect = this.canvas.getBoundingClientRect();
      const anchoCss = Math.max(1, rect.width);
      const altoCss = Math.max(1, rect.height);
      this.densidad = Math.min(window.devicePixelRatio || 1, this.densidadMaxima);

      this.canvas.width = Math.round(anchoCss * this.densidad);
      this.canvas.height = Math.round(altoCss * this.densidad);

      // En vertical se puede pedir un ancho mínimo menor; si no, en un
      // móvil de pie todo saldría diminuto
      const vertical = altoCss > anchoCss;
      const anchoMin = vertical && this.anchoMinimoVertical ? this.anchoMinimoVertical : this.anchoMinimo;
      this.escala = Math.min(anchoCss / anchoMin, altoCss / this.altoMinimo);
      this.anchoVisible = anchoCss / this.escala;
      this.altoVisible = altoCss / this.escala;
      this.anchoCss = anchoCss;
      this.altoCss = altoCss;
      this.vertical = altoCss > anchoCss;
    }

    /** Prepara el contexto para dibujar en unidades del juego. */
    comenzar(colorFondo) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = colorFondo || "#000";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const f = this.escala * this.densidad;
      ctx.setTransform(f, 0, 0, f, 0, 0);
      ctx.imageSmoothingEnabled = true;
      return ctx;
    }

    /** Convierte un punto de la pantalla (píxeles CSS) a unidades. */
    pantallaAUnidades(xCss, yCss) {
      return { x: xCss / this.escala, y: yCss / this.escala };
    }
  }

  /* ===================================================================
     CÁMARA 2D: decide qué parte del mundo se ve.
     =================================================================== */
  class Camara {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.objetivo = null;        // nodo al que sigue
      this.desfaseX = 0;           // dónde queda el objetivo en la pantalla
      this.suavizado = 0;          // 0 = sigue al instante; 0.9 = muy suave
      this.seguirY = false;
      this.limites = null;         // { minX, maxX, minY, maxY }
      // Temblor (por ejemplo al chocar)
      this.temblorX = 0;
      this.temblorY = 0;
      this._temblor = 0;
      this._temblorDuracion = 0;
    }

    seguir(nodo, opciones = {}) {
      this.objetivo = nodo;
      this.desfaseX = opciones.desfaseX ?? 0;
      this.suavizado = opciones.suavizado ?? 0;
      this.seguirY = opciones.seguirY ?? false;
    }

    temblar(intensidad = 6, duracion = 0.3) {
      this._temblor = intensidad;
      this._temblorDuracion = this._temblorRestante = duracion;
    }

    actualizar(dt) {
      if (this.objetivo) {
        const g = this.objetivo.posicionGlobal();
        const destinoX = g.x - this.desfaseX;
        const t = this.suavizado ? 1 - Math.pow(this.suavizado, dt * 60) : 1;
        this.x += (destinoX - this.x) * t;
        if (this.seguirY) this.y += (g.y - this.y) * t;
      }
      if (this.limites) {
        this.x = DFE.util.limitar(this.x, this.limites.minX, this.limites.maxX);
        this.y = DFE.util.limitar(this.y, this.limites.minY, this.limites.maxY);
      }
      if (this._temblorRestante > 0) {
        this._temblorRestante -= dt;
        const fuerza = this._temblor * (this._temblorRestante / this._temblorDuracion);
        this.temblorX = (Math.random() * 2 - 1) * fuerza;
        this.temblorY = (Math.random() * 2 - 1) * fuerza;
      } else {
        this.temblorX = this.temblorY = 0;
      }
    }

    /** Convierte coordenadas de pantalla (unidades) a coordenadas del mundo. */
    pantallaAMundo(x, y) {
      return { x: x + this.x, y: y + this.y };
    }
    /** Convierte coordenadas del mundo a la pantalla (unidades). */
    mundoAPantalla(x, y) {
      return { x: x - this.x, y: y - this.y };
    }
  }

  DFE.Pantalla = Pantalla;
  DFE.Camara = Camara;
})();
