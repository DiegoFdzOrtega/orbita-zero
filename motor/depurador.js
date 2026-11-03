/* =====================================================================
   DiegoFo Engine · depurador
   ---------------------------------------------------------------------
   Capa que se dibuja encima del juego para ver lo que normalmente es
   invisible:
     - FPS y tiempo por fotograma (rendimiento)
     - cámara, tamaño visible, escala y densidad de la pantalla
     - el ÁRBOL de la escena (representación lógica)
     - las CAJAS de colisión y el origen de cada nodo (representación espacial)
   Se activa con la tecla F2 o desde los ajustes del juego.
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  class Depurador {
    constructor(motor) {
      this.motor = motor;
      this.activo = false;
      this.fps = 60;
      this.msFotograma = 16;
      this.lineasArbol = 18;
      window.addEventListener("keydown", (e) => {
        if (e.code === "F2") { this.activo = !this.activo; e.preventDefault(); }
      });
    }

    medir(dtReal) {
      if (dtReal <= 0) return;
      // Media móvil: suaviza el número para que se pueda leer
      this.fps += (1 / dtReal - this.fps) * 0.05;
      this.msFotograma += (dtReal * 1000 - this.msFotograma) * 0.05;
    }

    dibujar(ctx, escena) {
      if (!this.activo || !escena) return;
      const pantalla = this.motor.pantalla;

      // 1) Cajas de colisión y orígenes, en coordenadas del mundo
      const cam = escena.camara;
      for (const capa of escena.hijos) {
        ctx.save();
        ctx.translate(-cam.x * capa.parallax, -cam.y * capa.parallax);
        capa.recorrer((n) => {
          if (n === capa && capa.hijos.length) return;
          if (!n.visible || n.destruido) return;
          const g = n.posicionGlobal();
          if (n.ancho > 0 && n.alto > 0) {
            const c = n.caja();
            ctx.strokeStyle = n.etiquetas.size ? "#ff4d6d" : "#3ddc97";
            ctx.lineWidth = 1;
            ctx.strokeRect(c.x, c.y, c.w, c.h);
          }
          // Origen del nodo (cruz)
          ctx.strokeStyle = "#ffd43b";
          ctx.beginPath();
          ctx.moveTo(g.x - 3, g.y); ctx.lineTo(g.x + 3, g.y);
          ctx.moveTo(g.x, g.y - 3); ctx.lineTo(g.x, g.y + 3);
          ctx.stroke();
        });
        ctx.restore();
      }

      // 2) Panel de información, fijo en la pantalla
      let nodos = 0;
      escena.recorrer(() => nodos++);
      const lineas = [
        `DiegoFo Engine ${DFE.VERSION}  ·  F2 oculta`,
        `FPS ${this.fps.toFixed(0)}  ·  ${this.msFotograma.toFixed(1)} ms`,
        `Nodos ${nodos}`,
        `Cámara x ${cam.x.toFixed(0)}  y ${cam.y.toFixed(0)}`,
        `Vista ${pantalla.anchoVisible.toFixed(0)}×${pantalla.altoVisible.toFixed(0)} u  ·  escala ${pantalla.escala.toFixed(2)}  ·  densidad ${pantalla.densidad}×`,
        "",
        "Árbol de la escena:",
      ];
      let contador = 0;
      escena.recorrer((n, prof) => {
        if (contador++ >= this.lineasArbol) return;
        const g = n.posicionGlobal();
        const sangria = "  ".repeat(prof) + (prof ? "└ " : "");
        const extra = n.hijos.length ? `  [${n.hijos.length}]` : "";
        lineas.push(`${sangria}${n.nombre}  (${g.x.toFixed(0)}, ${g.y.toFixed(0)})  z${n.z}${extra}`);
      });
      if (contador > this.lineasArbol) lineas.push(`  … y ${contador - this.lineasArbol} nodos más`);

      ctx.save();
      // El panel se dibuja en píxeles de pantalla (no en unidades del
      // juego) para que el texto tenga el mismo tamaño en cualquier móvil
      ctx.setTransform(pantalla.densidad, 0, 0, pantalla.densidad, 0, 0);
      ctx.font = "10px ui-monospace, Consolas, monospace";
      ctx.textBaseline = "top";
      const ancho = Math.min(pantalla.anchoCss - 16, 330);
      // Arriba a la derecha: el jugador suele estar a la izquierda
      const x = pantalla.anchoCss - ancho - 8;
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(x, 48, ancho, lineas.length * 12 + 10);
      ctx.fillStyle = "#e9f5ff";
      lineas.forEach((l, i) => ctx.fillText(l, x + 6, 53 + i * 12, ancho - 12));
      ctx.restore();
    }
  }

  DFE.Depurador = Depurador;
})();
