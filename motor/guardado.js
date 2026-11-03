/* =====================================================================
   DiegoFo Engine · guardado
   ---------------------------------------------------------------------
   Guarda datos pequeños (récord, ajustes) en el dispositivo con
   localStorage. Va dentro de try/catch: en modo incógnito o con el
   almacenamiento bloqueado falla, y el juego tiene que seguir igual.
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  class Guardado {
    constructor(prefijo = "dfe") {
      this.prefijo = prefijo + ":";
      this.memoria = {};  // copia por si localStorage no funciona
    }

    leer(clave, porDefecto) {
      try {
        const texto = localStorage.getItem(this.prefijo + clave);
        if (texto !== null) return JSON.parse(texto);
      } catch (e) { /* sin almacenamiento */ }
      return clave in this.memoria ? this.memoria[clave] : porDefecto;
    }

    escribir(clave, valor) {
      this.memoria[clave] = valor;
      try {
        localStorage.setItem(this.prefijo + clave, JSON.stringify(valor));
      } catch (e) { /* sin almacenamiento: se queda en memoria */ }
    }
  }

  DFE.Guardado = Guardado;
})();
