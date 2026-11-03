/* =====================================================================
   DiegoFo Engine · sistema de partículas
   ---------------------------------------------------------------------
   Muchos puntos pequeños con vida corta (chispas, polvo, migas...).
   Usa un número máximo de partículas: en un móvil la memoria y el
   procesador son limitados, así que nunca crece sin control.
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;
  const { aleatorio, elegir } = DFE.util;

  class Particulas extends DFE.Nodo {
    constructor(opciones = {}) {
      super(Object.assign({ nombre: "Particulas" }, opciones));
      this.maximo = opciones.maximo || 200;
      this.lista = [];
    }

    /** Lanza un grupo de partículas desde (x, y). */
    emitir(x, y, {
      cantidad = 12, colores = ["#fff"], velocidad = 160, angulo = -Math.PI / 2,
      apertura = Math.PI, vida = 0.6, tamano = 3, gravedad = 600,
    } = {}) {
      for (let i = 0; i < cantidad; i++) {
        if (this.lista.length >= this.maximo) this.lista.shift(); // quita la más vieja
        const a = angulo + aleatorio(-apertura / 2, apertura / 2);
        const v = velocidad * aleatorio(0.4, 1);
        this.lista.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          vida, vidaMax: vida,
          tamano: tamano * aleatorio(0.6, 1.3),
          color: elegir(colores),
          gravedad,
        });
      }
    }

    actualizar(dt) {
      for (const p of this.lista) {
        p.vy += p.gravedad * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vida -= dt;
      }
      this.lista = this.lista.filter((p) => p.vida > 0);
    }

    dibujar(ctx) {
      for (const p of this.lista) {
        ctx.globalAlpha = Math.max(0, p.vida / p.vidaMax);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.tamano / 2, p.y - p.tamano / 2, p.tamano, p.tamano);
      }
      ctx.globalAlpha = 1;
    }
  }

  DFE.Particulas = Particulas;
})();
