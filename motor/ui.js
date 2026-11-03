/* =====================================================================
   DiegoFo Engine · puente con diegofo-ui
   ---------------------------------------------------------------------
   Integración con Desarrollo de Interfaces: el motor dibuja el juego en
   un <canvas>, y los menús, el marcador y los avisos se hacen con la
   librería de componentes diegofo-ui (RA3 de Interfaces).

   ¿Por qué separarlo así?
     - El canvas es rapidísimo para dibujar 60 veces por segundo.
     - Los componentes HTML son accesibles (lectores de pantalla,
       teclado, foco) y ya están hechos y probados.
   Es lo que hacen los motores grandes: Unity tiene UI Toolkit y Godot
   tiene sus nodos Control, separados del mundo del juego.

   Si diegofo-ui no está cargada, todo sigue funcionando con
   alternativas nativas del navegador.
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  const UI = {
    /** ¿Está cargada la librería diegofo-ui? */
    get disponible() {
      return !!window.DiegofoUI;
    },

    /** Notificación flotante (df-toast-stack). */
    notificar(mensaje, tipo = "info") {
      if (this.disponible) return window.DiegofoUI.DfToastStack.notify(mensaje, tipo);
      console.log("[" + tipo + "] " + mensaje);
    },

    /** Pregunta sí/no (DfModal.confirm). Devuelve una promesa. */
    confirmar(opciones) {
      if (this.disponible) return window.DiegofoUI.DfModal.confirm(opciones);
      return Promise.resolve(window.confirm(opciones.message || opciones.heading));
    },

    /** Abre un <df-modal> del HTML y espera a que se cierre.
        Devuelve el valor del botón pulsado (data-valor) o "cerrar". */
    abrir(modal) {
      return new Promise((resolver) => {
        let valor = "cerrar";
        const botones = modal.querySelectorAll("[data-valor]");
        const alPulsar = (e) => {
          valor = e.currentTarget.dataset.valor;
          modal.close("method");
        };
        botones.forEach((b) => b.addEventListener("click", alPulsar));
        modal.addEventListener("df-close", function fin() {
          modal.removeEventListener("df-close", fin);
          botones.forEach((b) => b.removeEventListener("click", alPulsar));
          resolver(valor);
        });
        modal.show();
      });
    },

    /** Enlaza un <df-switch> con una propiedad de un objeto y la guarda. */
    vincularInterruptor(interruptor, objeto, propiedad, guardado, clave) {
      if (guardado && clave) objeto[propiedad] = guardado.leer(clave, objeto[propiedad]);
      interruptor.checked = !!objeto[propiedad];
      interruptor.addEventListener("df-change", (e) => {
        objeto[propiedad] = e.detail.checked;
        if (guardado && clave) guardado.escribir(clave, e.detail.checked);
      });
    },

    /** Cambia el texto de un elemento solo si ha cambiado
        (tocar el DOM 60 veces por segundo es caro). */
    texto(elemento, valor) {
      const v = String(valor);
      if (elemento.textContent !== v) elemento.textContent = v;
    },
  };

  DFE.UI = UI;
})();
