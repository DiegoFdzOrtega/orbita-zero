/* =====================================================================
   DiegoFo Engine · física y colisiones
   ---------------------------------------------------------------------
   Física sencilla para juegos 2D:
     - Integración de Euler: la velocidad cambia la posición y la
       gravedad cambia la velocidad, en cada paso.
     - Colisiones AABB (Axis-Aligned Bounding Box): rectángulos sin girar.
       Es la forma más rápida de detectar choques y basta para la mayoría
       de juegos 2D. Los motores 3D usan esferas, cápsulas o mallas.
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  const Fisica = {
    /** Gravedad en unidades por segundo al cuadrado (hacia abajo). */
    gravedad: 2000,
    /** Velocidad máxima de caída. */
    velocidadMaximaCaida: 1600,

    /** Aplica gravedad y velocidad a un nodo (si nodo.fisica = true). */
    integrar(nodo, dt) {
      nodo.velocidadY += this.gravedad * nodo.gravedad * dt;
      if (nodo.velocidadY > this.velocidadMaximaCaida) nodo.velocidadY = this.velocidadMaximaCaida;
      nodo.x += nodo.velocidadX * dt;
      nodo.y += nodo.velocidadY * dt;
    },

    /** ¿Se solapan dos rectángulos {x, y, w, h}? */
    solapan(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x &&
             a.y < b.y + b.h && a.y + a.h > b.y;
    },

    /** ¿Chocan dos nodos? */
    chocan(nodoA, nodoB) {
      return this.solapan(nodoA.caja(), nodoB.caja());
    },

    /** Busca choques entre un nodo y todos los nodos con una etiqueta.
        Llama a alChocar(otro) por cada choque. */
    comprobar(escena, nodo, etiqueta, alChocar) {
      const caja = nodo.caja();
      for (const otro of escena.buscarPorEtiqueta(etiqueta)) {
        if (otro !== nodo && this.solapan(caja, otro.caja())) alChocar(otro);
      }
    },

    /** Mantiene un nodo sobre un suelo horizontal. Devuelve true si lo toca. */
    apoyarEnSuelo(nodo, ySuelo) {
      if (nodo.y >= ySuelo) {
        nodo.y = ySuelo;
        if (nodo.velocidadY > 0) nodo.velocidadY = 0;
        return true;
      }
      return false;
    },
  };

  DFE.Fisica = Fisica;
})();
