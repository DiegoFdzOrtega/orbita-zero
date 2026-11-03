/* =====================================================================
   DiegoFo Engine · grafo de escena
   ---------------------------------------------------------------------
   Todo lo que hay en el juego es un NODO. Los nodos forman un árbol:
   cada nodo puede tener hijos, y los hijos se mueven con su padre.

       Escena
       ├── Fondo
       └── Mundo
           ├── Jugador
           └── Enemigos
               ├── Enemigo 1
               └── Enemigo 2

   - Representación LÓGICA: el árbol (quién contiene a quién).
   - Representación ESPACIAL: la posición (x, y), la escala, la rotación,
     la capa (z) y la caja de colisión de cada nodo.

   Clases: Nodo, Escena, Sprite, Texto, CapaRepetida.
   ===================================================================== */
(function () {
  "use strict";

  const DFE = window.DFE;

  /* ===================================================================
     NODO: la pieza básica
     =================================================================== */
  class Nodo extends DFE.Emisor {
    constructor(opciones = {}) {
      super();
      // Identidad
      this.nombre = opciones.nombre || this.constructor.name;
      this.etiquetas = new Set(opciones.etiquetas || []);

      // Transformación LOCAL (relativa al padre)
      this.x = opciones.x || 0;
      this.y = opciones.y || 0;
      this.rotacion = opciones.rotacion || 0;  // radianes
      this.escalaX = opciones.escalaX ?? 1;
      this.escalaY = opciones.escalaY ?? 1;
      this.z = opciones.z || 0;                // capa: mayor = se dibuja encima

      // Tamaño y punto de anclaje (0,0 = esquina superior izquierda,
      // 0.5,1 = centro de los pies). Lo usan el dibujo y las colisiones.
      this.ancho = opciones.ancho || 0;
      this.alto = opciones.alto || 0;
      this.ancla = opciones.ancla || { x: 0, y: 0 };
      this.margen = opciones.margen || 0;      // encoge la caja de colisión

      // Física (la aplica DFE.Fisica si fisica = true)
      this.fisica = opciones.fisica || false;
      this.velocidadX = 0;
      this.velocidadY = 0;
      this.gravedad = opciones.gravedad ?? 1;  // multiplicador de la gravedad

      // Capa de parallax (solo para hijos directos de la escena):
      // 1 = se mueve con la cámara, 0 = fijo en pantalla, 0.3 = lejano
      this.parallax = opciones.parallax ?? 1;

      // Estado
      this.visible = opciones.visible ?? true;
      this.activo = opciones.activo ?? true;
      this.destruido = false;

      // Árbol
      this.padre = null;
      this.hijos = [];
      this._ordenar = false;
    }

    /* ---------- Árbol ---------- */

    /** Añade un hijo (y lo devuelve, para encadenar). */
    agregar(hijo) {
      if (hijo.padre) hijo.padre.quitar(hijo);
      hijo.padre = this;
      this.hijos.push(hijo);
      this._ordenar = true;
      if (hijo.alAgregar) hijo.alAgregar();
      return hijo;
    }

    quitar(hijo) {
      const i = this.hijos.indexOf(hijo);
      if (i >= 0) this.hijos.splice(i, 1);
      hijo.padre = null;
    }

    /** Marca el nodo para eliminarlo al final del fotograma. */
    destruir() {
      this.destruido = true;
    }

    /** La escena a la que pertenece (subiendo por los padres). */
    get escena() {
      let n = this;
      while (n.padre) n = n.padre;
      return n instanceof Escena ? n : null;
    }

    /** Busca un descendiente por su nombre. */
    buscar(nombre) {
      for (const h of this.hijos) {
        if (h.nombre === nombre) return h;
        const r = h.buscar(nombre);
        if (r) return r;
      }
      return null;
    }

    /** Todos los descendientes con una etiqueta. */
    buscarPorEtiqueta(etiqueta, resultado = []) {
      for (const h of this.hijos) {
        if (h.etiquetas.has(etiqueta) && !h.destruido) resultado.push(h);
        h.buscarPorEtiqueta(etiqueta, resultado);
      }
      return resultado;
    }

    /** Recorre el nodo y todos sus descendientes. */
    recorrer(funcion, profundidad = 0) {
      funcion(this, profundidad);
      this.hijos.forEach((h) => h.recorrer(funcion, profundidad + 1));
    }

    /* ---------- Espacio ---------- */

    /** Posición en el MUNDO (suma la de todos los padres).
        Nota: la rotación solo afecta al dibujo, no a la lógica. */
    posicionGlobal() {
      let x = this.x, y = this.y;
      let p = this.padre;
      while (p && !(p instanceof Escena)) {
        x = p.x + x * p.escalaX;
        y = p.y + y * p.escalaY;
        p = p.padre;
      }
      return { x, y };
    }

    /** Caja de colisión en el mundo (AABB: rectángulo sin girar). */
    caja() {
      const g = this.posicionGlobal();
      const w = this.ancho * Math.abs(this.escalaX);
      const h = this.alto * Math.abs(this.escalaY);
      return {
        x: g.x - w * this.ancla.x + this.margen,
        y: g.y - h * this.ancla.y + this.margen,
        w: w - this.margen * 2,
        h: h - this.margen * 2,
      };
    }

    /* ---------- Ciclo de vida (lo llama el motor) ---------- */

    _actualizar(dt) {
      if (!this.activo || this.destruido) return;
      if (this.fisica) DFE.Fisica.integrar(this, dt);
      this.actualizar(dt);
      for (let i = 0; i < this.hijos.length; i++) this.hijos[i]._actualizar(dt);
      // Quitamos los nodos destruidos (libera memoria)
      if (this.hijos.some((h) => h.destruido)) {
        this.hijos = this.hijos.filter((h) => {
          if (h.destruido) { h.padre = null; if (h.alDestruir) h.alDestruir(); }
          return !h.destruido;
        });
      }
    }

    _dibujar(ctx) {
      if (!this.visible || this.destruido) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.rotacion) ctx.rotate(this.rotacion);
      if (this.escalaX !== 1 || this.escalaY !== 1) ctx.scale(this.escalaX, this.escalaY);
      this.dibujar(ctx);
      this._dibujarHijos(ctx);
      ctx.restore();
    }

    _dibujarHijos(ctx) {
      if (this._ordenar) {
        // Orden por capa (z). sort es estable: a igual z, el orden de llegada
        this.hijos.sort((a, b) => a.z - b.z);
        this._ordenar = false;
      }
      for (let i = 0; i < this.hijos.length; i++) this.hijos[i]._dibujar(ctx);
    }

    /** Para reordenar si se cambia la z de un hijo. */
    reordenar() {
      this._ordenar = true;
    }

    /* ---------- Para sobrescribir en cada tipo de nodo ---------- */
    actualizar(dt) {}
    dibujar(ctx) {}
  }

  /* ===================================================================
     ESCENA: la raíz del árbol. Tiene su propia cámara.
     =================================================================== */
  class Escena extends Nodo {
    constructor(opciones = {}) {
      super({ nombre: opciones.nombre || "Escena" });
      this.camara = new DFE.Camara();
      this.motor = null;
      this.colorFondo = opciones.colorFondo || "#000";
    }

    // Ganchos que el motor llama
    alEntrar() {}
    alSalir() {}
    alRedimensionar(anchoVisible, altoVisible) {}

    _actualizar(dt) {
      super._actualizar(dt);
      this.camara.actualizar(dt);
    }

    /** Dibuja cada hijo directo aplicando la cámara según su parallax. */
    _dibujar(ctx) {
      if (this._ordenar) { this.hijos.sort((a, b) => a.z - b.z); this._ordenar = false; }
      const cam = this.camara;
      for (const hijo of this.hijos) {
        const p = hijo.parallax;
        ctx.save();
        // Redondeamos para evitar líneas borrosas entre píxeles
        ctx.translate(
          Math.round(-cam.x * p + cam.temblorX * p),
          Math.round(-cam.y * p + cam.temblorY * p)
        );
        hijo._dibujar(ctx);
        ctx.restore();
      }
    }
  }

  /* ===================================================================
     SPRITE: dibuja una imagen, un fotograma de una hoja de sprites
     o una función de dibujo propia.
     =================================================================== */
  class Sprite extends Nodo {
    constructor(opciones = {}) {
      super(opciones);
      this.imagen = opciones.imagen || null;   // Image, canvas o nombre de recurso
      this.pintar = opciones.pintar || null;   // function (ctx, nodo) { ... }
      // Hoja de sprites (opcional)
      this.columnas = opciones.columnas || 1;
      this.filas = opciones.filas || 1;
      this.fps = opciones.fps || 0;
      this.fila = opciones.fila || 0;
      this.fotograma = 0;
      this._tiempo = 0;
      this.voltearX = false;
      this.opacidad = opciones.opacidad ?? 1;
      this.mezcla = opciones.mezcla || null;   // p. ej. "lighter" para brillos
      this.destello = 0;                       // 0..1: parpadeo blanco al recibir daño
    }

    actualizar(dt) {
      if (this.destello > 0) this.destello = Math.max(0, this.destello - dt * 8);
      if (this.fps > 0 && this.columnas > 1) {
        this._tiempo += dt;
        this.fotograma = Math.floor(this._tiempo * this.fps) % this.columnas;
      }
    }

    dibujar(ctx) {
      const dx = -this.ancho * this.ancla.x;
      const dy = -this.alto * this.ancla.y;
      if (this.opacidad !== 1) ctx.globalAlpha *= this.opacidad;
      if (this.voltearX) ctx.scale(-1, 1);

      if (this.pintar) {
        ctx.translate(dx, dy);
        this.pintar(ctx, this);
        return;
      }
      let img = this.imagen;
      if (typeof img === "string") img = DFE.Recursos.obtener(img);
      if (!img) return;
      const fw = img.width / this.columnas;
      const fh = img.height / this.filas;
      // Modo de mezcla: "lighter" suma colores (brillos, láseres, fuego)
      if (this.mezcla) ctx.globalCompositeOperation = this.mezcla;
      ctx.drawImage(img, this.fotograma * fw, this.fila * fh, fw, fh, dx, dy, this.ancho, this.alto);
      // Destello al recibir un golpe: se vuelve a dibujar sumando color
      if (this.destello > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha *= this.destello;
        ctx.drawImage(img, this.fotograma * fw, this.fila * fh, fw, fh, dx, dy, this.ancho, this.alto);
      }
    }
  }

  /* ===================================================================
     TEXTO
     =================================================================== */
  class Texto extends Nodo {
    constructor(opciones = {}) {
      super(opciones);
      this.texto = opciones.texto || "";
      this.fuente = opciones.fuente || "16px system-ui";
      this.color = opciones.color || "#fff";
      this.alineacion = opciones.alineacion || "left";
    }
    dibujar(ctx) {
      ctx.font = this.fuente;
      ctx.fillStyle = this.color;
      ctx.textAlign = this.alineacion;
      ctx.textBaseline = "top";
      ctx.fillText(this.texto, 0, 0);
    }
  }

  /* ===================================================================
     CAPA REPETIDA: una imagen que se repite en horizontal hasta cubrir
     la pantalla. Ideal para fondos con parallax (edificios, montañas).
     =================================================================== */
  class CapaRepetida extends Nodo {
    constructor(opciones = {}) {
      super(opciones);
      this.imagen = opciones.imagen;  // Image, canvas o nombre de recurso
    }
    dibujar(ctx) {
      let img = this.imagen;
      if (typeof img === "string") img = DFE.Recursos.obtener(img);
      const escena = this.escena;
      if (!img || !escena || !escena.motor) return;
      const cam = escena.camara;
      const vista = escena.motor.pantalla;
      // Dónde empieza la vista en las coordenadas de esta capa
      const inicio = cam.x * this.parallax - this.x;
      const w = img.width;
      let xi = Math.floor(inicio / w) * w;
      for (let x = xi; x < inicio + vista.anchoVisible + w; x += w) {
        ctx.drawImage(img, Math.round(x), 0);
      }
    }
  }

  DFE.Nodo = Nodo;
  DFE.Escena = Escena;
  DFE.Sprite = Sprite;
  DFE.Texto = Texto;
  DFE.CapaRepetida = CapaRepetida;
})();
