/* =====================================================================
   DiegoFo Engine · núcleo
   ---------------------------------------------------------------------
   Crea el espacio de nombres DFE (todo el motor cuelga de aquí) y las
   piezas básicas que usan los demás módulos:
     - DFE.util     funciones matemáticas pequeñas
     - DFE.Emisor   sistema de eventos (escuchar / emitir)
   Se carga con <script> normal, así funciona abriendo el HTML con doble
   clic (los módulos ES no funcionan desde file://).
   ===================================================================== */
(function () {
  "use strict";

  const DFE = (window.DFE = window.DFE || {});
  DFE.VERSION = "1.0.0";

  /* ---------- Utilidades matemáticas ---------- */
  DFE.util = {
    /** Mantiene un valor entre un mínimo y un máximo. */
    limitar(valor, min, max) {
      return Math.max(min, Math.min(max, valor));
    },
    /** Número decimal aleatorio entre min y max. */
    aleatorio(min, max) {
      return min + Math.random() * (max - min);
    },
    /** Número entero aleatorio entre min y max (los dos incluidos). */
    aleatorioEntero(min, max) {
      return Math.floor(min + Math.random() * (max - min + 1));
    },
    /** Elige un elemento al azar de una lista. */
    elegir(lista) {
      return lista[Math.floor(Math.random() * lista.length)];
    },
    /** Interpolación lineal: de a hasta b según t (0..1). */
    lerp(a, b, t) {
      return a + (b - a) * t;
    },
  };

  /* ---------- Emisor de eventos ----------
     Permite que las piezas se avisen sin conocerse entre sí.
     Ejemplo: el juego emite "fin" y la interfaz lo escucha. */
  class Emisor {
    constructor() {
      this._oyentes = {};
    }
    /** Escucha un evento. Devuelve una función para dejar de escuchar. */
    on(nombre, funcion) {
      (this._oyentes[nombre] = this._oyentes[nombre] || []).push(funcion);
      return () => this.off(nombre, funcion);
    }
    off(nombre, funcion) {
      const lista = this._oyentes[nombre];
      if (lista) this._oyentes[nombre] = lista.filter((f) => f !== funcion);
    }
    emit(nombre, datos) {
      (this._oyentes[nombre] || []).slice().forEach((f) => f(datos));
    }
  }

  DFE.Emisor = Emisor;
})();
