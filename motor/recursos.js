/* =====================================================================
   DiegoFo Engine · gestor de recursos
   ---------------------------------------------------------------------
   Carga todo lo que el juego necesita ANTES de empezar y avisa del
   progreso (para una barra de carga). Así no hay tirones a mitad de
   partida.

   Tipos de recurso:
     { nombre, tipo: "imagen",   url }
     { nombre, tipo: "generada", ancho, alto, pintar(ctx, ancho, alto) }

   Las imágenes "generadas" se dibujan una sola vez con código en un
   canvas oculto. Después se reutilizan: dibujar una imagen ya hecha es
   mucho más barato que repetir cientos de órdenes de dibujo en cada
   fotograma (importante en móviles).
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;
  const almacen = {};

  const Recursos = {
    obtener(nombre) {
      return almacen[nombre] || null;
    },

    /** Carga una lista de recursos. alProgreso(cargados, total). */
    cargar(lista, alProgreso) {
      let cargados = 0;
      const total = lista.length;
      const avisar = () => { cargados++; if (alProgreso) alProgreso(cargados, total); };

      const promesas = lista.map((r) => {
        if (r.tipo === "generada") {
          // Damos un respiro al navegador entre recurso y recurso
          return new Promise((ok) => setTimeout(() => {
            almacen[r.nombre] = Recursos.generar(r.ancho, r.alto, r.pintar);
            avisar();
            ok();
          }, 0));
        }
        if (r.tipo === "imagen") {
          return new Promise((ok, fallo) => {
            const img = new Image();
            img.onload = () => { almacen[r.nombre] = img; avisar(); ok(); };
            img.onerror = () => fallo(new Error("No se pudo cargar " + r.url));
            img.src = r.url;
          });
        }
        return Promise.reject(new Error("Tipo de recurso desconocido: " + r.tipo));
      });
      return Promise.all(promesas);
    },

    /** Dibuja una imagen con código y la devuelve como canvas. */
    generar(ancho, alto, pintar) {
      const c = document.createElement("canvas");
      c.width = Math.ceil(ancho);
      c.height = Math.ceil(alto);
      pintar(c.getContext("2d"), c.width, c.height);
      return c;
    },

    /** Lista de recursos cargados (para el depurador). */
    nombres() {
      return Object.keys(almacen);
    },
  };

  DFE.Recursos = Recursos;
})();
