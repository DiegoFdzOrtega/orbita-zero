/* =====================================================================
   DiegoFo Engine · entrada
   ---------------------------------------------------------------------
   Une teclado, ratón y pantalla táctil en ACCIONES con nombre.
   El juego no pregunta "¿se ha pulsado Espacio?" sino "¿se ha pulsado
   saltar?". Así el mismo código funciona en el ordenador y en el móvil.

     entrada.definir("saltar", ["Space", "ArrowUp", "toque"]);
     if (entrada.seAcabaDePulsar("saltar")) ...

   Usa Pointer Events: un único tipo de evento para ratón, dedo y lápiz.
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  class Entrada {
    constructor(elemento) {
      this.elemento = elemento;
      this.acciones = {};            // nombre → lista de teclas / "toque"
      this.teclas = new Set();       // teclas mantenidas ahora
      this.pulsadasAhora = new Set();// teclas pulsadas en este fotograma
      this.puntero = { x: 0, y: 0, pulsado: false, acabaDePulsar: false };
      this.bloqueada = false;        // p. ej. mientras hay un menú abierto

      // Evita que el navegador haga scroll, zoom o seleccione texto al
      // tocar el juego (muy importante en móviles)
      elemento.style.touchAction = "none";
      elemento.style.userSelect = "none";
      elemento.style.webkitUserSelect = "none";

      window.addEventListener("keydown", (e) => {
        if (this.bloqueada || this._enCampoDeTexto(e)) return;
        if (!this.teclas.has(e.code)) this.pulsadasAhora.add(e.code);
        this.teclas.add(e.code);
        // Que Espacio y las flechas no muevan la página
        if (this._teclaUsada(e.code)) e.preventDefault();
      });
      window.addEventListener("keyup", (e) => this.teclas.delete(e.code));
      window.addEventListener("blur", () => this.soltarTodo());

      elemento.addEventListener("pointerdown", (e) => {
        if (this.bloqueada) return;
        const r = elemento.getBoundingClientRect();
        this.puntero.x = e.clientX - r.left;
        this.puntero.y = e.clientY - r.top;
        this.puntero.pulsado = true;
        this.puntero.acabaDePulsar = true;
        elemento.setPointerCapture?.(e.pointerId);
      });
      elemento.addEventListener("pointermove", (e) => {
        const r = elemento.getBoundingClientRect();
        this.puntero.x = e.clientX - r.left;
        this.puntero.y = e.clientY - r.top;
      });
      const soltar = () => { this.puntero.pulsado = false; };
      elemento.addEventListener("pointerup", soltar);
      elemento.addEventListener("pointercancel", soltar);
      elemento.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    /** Asocia una acción a teclas (códigos KeyboardEvent.code) y/o "toque". */
    definir(accion, entradas) {
      this.acciones[accion] = entradas;
    }

    /** ¿Se mantiene pulsada la acción? */
    estaPulsada(accion) {
      return (this.acciones[accion] || []).some((t) =>
        t === "toque" ? this.puntero.pulsado : this.teclas.has(t));
    }

    /** ¿Se ha pulsado la acción justo en este fotograma? */
    seAcabaDePulsar(accion) {
      return (this.acciones[accion] || []).some((t) =>
        t === "toque" ? this.puntero.acabaDePulsar : this.pulsadasAhora.has(t));
    }

    /** Lo llama el motor al final de cada paso de lógica. */
    finDePaso() {
      this.pulsadasAhora.clear();
      this.puntero.acabaDePulsar = false;
    }

    soltarTodo() {
      this.teclas.clear();
      this.pulsadasAhora.clear();
      this.puntero.pulsado = false;
      this.puntero.acabaDePulsar = false;
    }

    _teclaUsada(codigo) {
      return Object.values(this.acciones).some((lista) => lista.includes(codigo));
    }
    _enCampoDeTexto(e) {
      const t = e.target;
      return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    }
  }

  DFE.Entrada = Entrada;
})();
